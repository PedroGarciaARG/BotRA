// Handle post-sale message notifications from MercadoLibre.
// Implements the conversation flow: welcome -> SI -> instructions -> LISTO -> code -> final

import { getPackMessages, sendMessage, sendMessages, getOrderDetails, markShipmentDelivered, mlFetch } from "./api";
import { getAccessToken, getSellerId } from "./auth";
import {
  detectProductType,
  getProductByKey,
  WELCOME_MESSAGE,
  CANCEL_MESSAGE,
  HUMAN_MESSAGE,
  REMINDER_MESSAGE,
} from "@/lib/product-config";
import {
  getPackState,
  setPackState,
  updatePackState,
  addActivityLog,
  getAllPackStates,
} from "@/lib/storage";
import { getAvailableCode, markCodeDelivered } from "@/lib/google-sheets";
import { notifyHumanRequested, notifyCodeDelivered, notifyError } from "@/lib/telegram";

/**
 * Fetch a single message by ID to find its associated pack.
 * ML notification resource is /messages/{messageId}, not /messages/{packId}.
 */
async function getMessageById(messageId: string) {
  try {
    return await mlFetch<{
      id: string;
      resource: string; // e.g. "packs/12345/sellers/67890"
      from: { user_id: string };
      to: { user_id: string };
      text: string;
      created_at: string;
    }>(`/messages/${messageId}`);
  } catch (err) {
    console.log(`[v0] getMessageById failed for ${messageId}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Reconstruct pack state from ML data when lost due to serverless cold start.
 * Fetches the order, determines the product, checks existing messages to
 * figure out which stage of the conversation we're in.
 */
async function reconstructStateFromML(
  packId: string,
  sellerId: string,
  buyerId: string
): Promise<ReturnType<typeof getPackState> | null> {
  try {
    // Try to get order info - packId might be an order_id
    let orderId = packId;
    let itemTitle = "";
    let realBuyerId = buyerId;

    try {
      // First try as order
      const order = await mlFetch<{
        id: number;
        status: string;
        order_items: Array<{ item: { id: string; title: string } }>;
        buyer: { id: number; nickname: string };
        pack_id: number | null;
      }>(`/orders/${packId}`);
      itemTitle = order.order_items?.[0]?.item?.title || "";
      orderId = String(order.id);
      realBuyerId = String(order.buyer.id);
    } catch {
      // packId might be a real pack, try to get orders from pack
      try {
        const packData = await mlFetch<{
          orders: Array<{ id: number }>;
        }>(`/packs/${packId}`);
        if (packData.orders?.[0]?.id) {
          const order = await mlFetch<{
            id: number;
            order_items: Array<{ item: { id: string; title: string } }>;
            buyer: { id: number };
          }>(`/orders/${packData.orders[0].id}`);
          itemTitle = order.order_items?.[0]?.item?.title || "";
          orderId = String(order.id);
          realBuyerId = String(order.buyer.id);
        }
      } catch {
        console.log(`[v0] Could not fetch pack or order for ${packId}`);
      }
    }

    const product = detectProductType(itemTitle);
    if (!product && !itemTitle) {
      console.log(`[v0] No product detected for reconstruction, title="${itemTitle}"`);
      return null;
    }

    // Check existing messages to determine conversation status
    const msgsData = await getPackMessages(packId, sellerId);
    const messages = msgsData.messages || [];

    const sellerMsgs = messages.filter(m => String(m.from.user_id) === String(sellerId));
    const buyerMsgs = messages.filter(m => String(m.from.user_id) !== String(sellerId));

    // Determine status based on message count and content
    let status = "initial_sent";
    if (sellerMsgs.length === 0) {
      status = "initial_sent"; // Welcome should have been sent by order handler
    } else if (sellerMsgs.length === 1) {
      status = "initial_sent"; // Only welcome sent
    } else if (sellerMsgs.length >= 2) {
      // Check if code was delivered (look for "Tu codigo:" in seller messages)
      const codeDelivered = sellerMsgs.some(m => 
        m.text.toLowerCase().includes("tu codigo:") || m.text.toLowerCase().includes("tu código:")
      );
      if (codeDelivered) {
        status = "code_sent";
      } else {
        // Instructions were sent
        status = "instructions_sent";
      }
    }

    console.log(`[v0] Reconstructed: product=${product?.key || "unknown"}, status=${status}, sellerMsgs=${sellerMsgs.length}, buyerMsgs=${buyerMsgs.length}`);

    const newState = {
      packId,
      orderId,
      sellerId,
      buyerId: realBuyerId,
      productType: product?.key || "unknown",
      productTitle: itemTitle,
      status,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setPackState(packId, newState);
    return newState;
  } catch (err) {
    console.log(`[v0] reconstructStateFromML error:`, err instanceof Error ? err.message : err);
    return null;
  }
}

export async function handleMessageNotification(
  resource: string,
  userId: string
): Promise<void> {
  // CRITICAL: On serverless (Netlify), sellerId is lost on each cold start.
  await getAccessToken();
  const sellerId = getSellerId();
  if (!sellerId) {
    throw new Error("Seller ID not available after auth");
  }

  // ML sends: { resource: "/messages/{messageId}", ... }
  // We need to GET that message first to find the pack_id
  const messageId = resource.replace("/messages/", "").split("/")[0];
  console.log(`[v0] handleMessageNotification: messageId=${messageId}, userId=${userId}`);

  let packId: string | null = null;

  // Strategy 1: GET the message to find the pack from its "resource" field
  const messageDetail = await getMessageById(messageId);
  if (messageDetail) {
    // message.resource is like "packs/12345/sellers/67890"
    const packMatch = (messageDetail.resource || "").match(/packs\/(\d+)/);
    if (packMatch) {
      packId = packMatch[1];
      console.log(`[v0] Found packId=${packId} from message resource`);
    }

    // If the message is FROM the seller (us), skip - we don't respond to ourselves
    if (String(messageDetail.from?.user_id) === String(sellerId)) {
      console.log(`[v0] Message is from seller, skipping`);
      return;
    }
  }

  // Strategy 2: Try using the messageId directly as packId (legacy behavior)
  if (!packId) {
    packId = messageId;
    console.log(`[v0] Using messageId as packId fallback: ${packId}`);
  }

  // Find state for this pack
  let state = getPackState(packId);

  if (!state) {
    // Strategy 3: Search all known states for matching buyer or packId
    const allStates = getAllPackStates();
    for (const s of allStates) {
      if (s.buyerId === userId || s.packId === packId) {
        state = s;
        packId = s.packId;
        console.log(`[v0] Found state via search: packId=${packId}`);
        break;
      }
    }
  }

  if (!state) {
    console.log(`[v0] No state found for pack ${packId}, trying to reconstruct from ML`);
    // On serverless, packStates are always empty on cold start.
    // Reconstruct state by fetching the order associated with this pack.
    state = await reconstructStateFromML(packId, sellerId, userId);
    if (!state) {
      console.log(`[v0] Could not reconstruct state for pack ${packId}`);
      addActivityLog({
        type: "message",
        message: `Mensaje recibido sin estado previo`,
        details: `Pack: ${packId} | Buyer: ${userId}`,
      });
      return;
    }
    console.log(`[v0] Reconstructed state for pack ${packId}: status=${state.status}, product=${state.productType}`);
  }

  // Fetch messages for this pack
  const messagesData = await getPackMessages(packId, sellerId);
  const messages = messagesData.messages || [];

  if (messages.length === 0) return;

  // Find the last message from the buyer
  const buyerMessages = messages
    .filter((m) => m.from.user_id !== sellerId)
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

  const lastBuyerMessage = buyerMessages[0];
  if (!lastBuyerMessage) return;

  // Check if we already responded to this message by comparing timestamps
  const sellerMessages = messages
    .filter((m) => m.from.user_id === sellerId)
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

  const lastSellerMessage = sellerMessages[0];
  if (
    lastSellerMessage &&
    new Date(lastSellerMessage.created_at) >
      new Date(lastBuyerMessage.created_at)
  ) {
    // We already responded after the buyer's last message
    console.log(`[v0] Already responded to last buyer message in pack ${packId}`);
    return;
  }

  const text = lastBuyerMessage.text.toLowerCase().trim();
  console.log(`[v0] Processing buyer message in pack ${packId}: "${text}"`);

  // Route based on current state and buyer response
  await processResponse(packId, state, text, lastBuyerMessage.text);
}

async function processResponse(
  packId: string,
  state: ReturnType<typeof getPackState> & {},
  normalizedText: string,
  originalText: string
): Promise<void> {
  const { sellerId, productType, orderId, buyerId } = state;

  // Already delivered code - don't process further automatic messages
  if (state.status === "code_sent") {
    // Only respond to specific keywords after code delivery
    if (
      normalizedText.includes("humano") ||
      normalizedText.includes("persona") ||
      normalizedText.includes("ayuda")
    ) {
      await sendMessage(packId, sellerId, HUMAN_MESSAGE, buyerId);
      updatePackState(packId, { status: "human_requested" });
      await notifyHumanRequested(packId, originalText);
      addActivityLog({
        type: "human",
        message: "Atencion humana post-entrega",
        details: `Pack: ${packId} | Msg: "${originalText.slice(0, 100)}"`,
      });
    }
    return;
  }

  // Human already requested - don't auto-respond
  if (state.status === "human_requested") {
    return;
  }

  // Cancelled - don't auto-respond
  if (state.status === "cancelled") {
    return;
  }

  // ---- SI / Confirm ----
  if (
    state.status === "initial_sent" &&
    (normalizedText === "si" ||
      normalizedText === "sí" ||
      normalizedText === "confirmo" ||
      normalizedText === "dale" ||
      normalizedText.startsWith("si ") ||
      normalizedText.startsWith("si,"))
  ) {
    const product = getProductByKey(productType);
    if (!product) {
      await sendMessage(packId, sellerId, REMINDER_MESSAGE, buyerId);
      return;
    }

    await sendMessages(packId, sellerId, product.instructions, buyerId);
    updatePackState(packId, { status: "instructions_sent" });

    addActivityLog({
      type: "message",
      message: `Instrucciones enviadas: ${product.label}`,
      details: `Pack: ${packId}`,
    });
    return;
  }

  // ---- LISTO / Ready for code ----
  if (
    state.status === "instructions_sent" &&
    (normalizedText === "listo" ||
      normalizedText.includes("listo") ||
      normalizedText === "dale" ||
      normalizedText === "ok" ||
      normalizedText === "ready")
  ) {
    const product = getProductByKey(productType);
    if (!product) {
      await notifyError("code_delivery", `Product not found: ${productType}`);
      return;
    }

    // Get code from Google Sheets
    const codeResult = await getAvailableCode(product.sheetName);

    if (!codeResult) {
      await sendMessage(
        packId,
        sellerId,
        "Estamos preparando tu codigo. Un asesor te lo enviara en breve.",
        buyerId
      );
      updatePackState(packId, { status: "human_requested" });
      await notifyError(
        "stock",
        `Sin stock para ${product.label} - Pack: ${packId}`
      );
      addActivityLog({
        type: "error",
        message: `Sin stock: ${product.label}`,
        details: `Pack: ${packId}`,
      });
      return;
    }

    // Send code with product-specific format
    const codeMessage = product.codeMessage(codeResult.code, state.productTitle);
    await sendMessage(packId, sellerId, codeMessage, buyerId);

    // Mark code as delivered in the sheet
    await markCodeDelivered(product.sheetName, codeResult.row, orderId);

    // Send consolidated final message (single message to avoid spam - ML best practice)
    await new Promise((r) => setTimeout(r, 800));
    const finalText = product.finalMessage.join("\n\n");
    // Respect ML 350 char limit per message
    if (finalText.length <= 350) {
      await sendMessage(packId, sellerId, finalText, buyerId);
    } else {
      await sendMessages(packId, sellerId, product.finalMessage, buyerId);
    }

    updatePackState(packId, {
      status: "code_sent",
      codeDelivered: codeResult.code,
    });

    addActivityLog({
      type: "code_delivery",
      message: `Codigo entregado: ${product.label}`,
      details: `Pack: ${packId} | Code: ${codeResult.code.slice(0, 4)}...`,
    });

    await notifyCodeDelivered(packId, product.label, codeResult.code);

    // Auto-mark as delivered in ML
    try {
      const orderData = await getOrderDetails(orderId);
      if (orderData.shipping?.id) {
        await markShipmentDelivered(orderData.shipping.id);
        addActivityLog({
          type: "message",
          message: `Marcado como entregado en ML`,
          details: `Pack: ${packId} | Shipment: ${orderData.shipping.id}`,
        });
      }
    } catch (err) {
      console.log("[v0] Auto-deliver failed (non-blocking):", err);
      addActivityLog({
        type: "error",
        message: `No se pudo marcar entregado automaticamente`,
        details: `Pack: ${packId} | Error: ${err instanceof Error ? err.message : "unknown"}`,
      });
    }
    return;
  }

  // ---- NO / Cancel ----
  if (
    normalizedText === "no" ||
    normalizedText.startsWith("no ") ||
    normalizedText.includes("cancelar")
  ) {
    await sendMessage(packId, sellerId, CANCEL_MESSAGE, buyerId);
    updatePackState(packId, { status: "cancelled" });

    addActivityLog({
      type: "message",
      message: "Compra cancelada por comprador",
      details: `Pack: ${packId}`,
    });
    return;
  }

  // ---- HUMANO / Human handoff ----
  if (
    normalizedText.includes("humano") ||
    normalizedText.includes("persona") ||
    normalizedText.includes("atencion") ||
    normalizedText.includes("ayuda")
  ) {
    await sendMessage(packId, sellerId, HUMAN_MESSAGE, buyerId);
    updatePackState(packId, { status: "human_requested" });

    await notifyHumanRequested(packId, originalText);
    addActivityLog({
      type: "human",
      message: "Atencion humana solicitada",
      details: `Pack: ${packId} | Msg: "${originalText.slice(0, 100)}"`,
    });
    return;
  }

  // ---- Unrecognized ----
  await sendMessage(packId, sellerId, REMINDER_MESSAGE, buyerId);

  addActivityLog({
    type: "message",
    message: "Respuesta no reconocida",
    details: `Pack: ${packId} | Msg: "${originalText.slice(0, 100)}"`,
  });
}
