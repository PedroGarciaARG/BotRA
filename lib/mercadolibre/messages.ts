// Handle post-sale message notifications from MercadoLibre.
// Implements the conversation flow: welcome -> SI -> instructions -> LISTO -> code -> final

import { getPackMessages, sendMessage, sendMessages, getOrderDetails, markShipmentDelivered } from "./api";
import { getSellerId } from "./auth";
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

export async function handleMessageNotification(
  resource: string,
  userId: string
): Promise<void> {
  // resource format: messages can come as various paths
  // We need to extract the pack ID from the resource or message itself
  const sellerId = getSellerId();
  if (!sellerId) {
    throw new Error("Seller ID not available");
  }

  // Resource is typically like /messages/{messageId} but we need to find the pack
  // The notification body contains user_id which helps us identify messages
  // We'll need to check existing packs for this user or find from message details

  // Try to extract pack info from the resource path
  // ML sends notifications like: { resource: "/messages/PACK_ID", ... }
  const resourceParts = resource.replace("/messages/", "").split("/");
  let packId = resourceParts[0];

  // If we can't find the pack directly, check all known packs
  let state = getPackState(packId);

  if (!state) {
    // Try to find the pack by checking all states for this buyer
    const allStates = getAllPackStates();
    for (const s of allStates) {
      if (s.buyerId === userId || s.packId === packId) {
        state = s;
        packId = s.packId;
        break;
      }
    }
  }

  if (!state) {
    console.log(`[v0] No state found for pack ${packId}, fetching messages to bootstrap`);
    // Try to bootstrap state from messages
    try {
      const msgs = await getPackMessages(packId, sellerId);
      if (!msgs.messages || msgs.messages.length === 0) {
        console.log(`[v0] No messages found for pack ${packId}`);
        return;
      }
      // We don't know the product type yet, so we can't fully bootstrap
      // Just log and return - the order webhook should handle initial setup
      return;
    } catch {
      console.log(`[v0] Could not fetch messages for pack ${packId}`);
      return;
    }
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
  const { sellerId, productType, orderId } = state;

  // Already delivered code - don't process further automatic messages
  if (state.status === "code_sent") {
    // Only respond to specific keywords after code delivery
    if (
      normalizedText.includes("humano") ||
      normalizedText.includes("persona") ||
      normalizedText.includes("ayuda")
    ) {
      await sendMessage(packId, sellerId, HUMAN_MESSAGE);
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
      await sendMessage(packId, sellerId, REMINDER_MESSAGE);
      return;
    }

    await sendMessages(packId, sellerId, product.instructions);
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
        "Estamos preparando tu codigo. Un asesor te lo enviara en breve."
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
    await sendMessage(packId, sellerId, codeMessage);

    // Mark code as delivered in the sheet
    await markCodeDelivered(product.sheetName, codeResult.row, orderId);

    // Send final message
    await new Promise((r) => setTimeout(r, 500));
    await sendMessages(packId, sellerId, product.finalMessage);

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
    await sendMessage(packId, sellerId, CANCEL_MESSAGE);
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
    await sendMessage(packId, sellerId, HUMAN_MESSAGE);
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
  await sendMessage(packId, sellerId, REMINDER_MESSAGE);

  addActivityLog({
    type: "message",
    message: "Respuesta no reconocida",
    details: `Pack: ${packId} | Msg: "${originalText.slice(0, 100)}"`,
  });
}
