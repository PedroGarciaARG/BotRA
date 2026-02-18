// Handle post-sale message notifications from MercadoLibre.
// NEW FLOW: Bot waits for buyer's first message, then sends welcome + instructions.
// Flow: buyer msg -> welcome+instructions -> buyer "LISTO" -> code -> final

import { getPackMessages, sendMessage, getSellerOrders, getOrderDetails, markShipmentDelivered, initConversation, getMessageByResource } from "./api";
import { getAccessToken, getSellerId } from "./auth";
import {
  detectProductType,
  getProductByKey,
  WELCOME_MESSAGE,
  CANCEL_MESSAGE,
  HUMAN_MESSAGE,
  REMINDER_MESSAGE,
} from "@/lib/product-config";
import { addActivityLog } from "@/lib/storage";
import { getAvailableCode, markCodeDelivered } from "@/lib/google-sheets";
import { notifyHumanRequested, notifyCodeDelivered, notifyError } from "@/lib/telegram";

/**
 * Try to send a message, with automatic initConversation retry if it fails.
 * initConversation with option "OTHER" may already deliver the text,
 * so we check whether we need to re-send after init.
 */
async function safeSendMessage(packId: string, sellerId: string, text: string, buyerId?: string) {
  try {
    await sendMessage(packId, sellerId, text, buyerId);
    console.log(`[v0] safeSendMessage OK for pack=${packId}`);
    return;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.log(`[v0] sendMessage failed for pack=${packId}: ${errMsg}`);

    // If blocked_by_conversation or 403/400, try initConversation first
    if (
      errMsg.includes("blocked_by_conversation") ||
      errMsg.includes("403") ||
      errMsg.includes("400") ||
      errMsg.includes("not_found") ||
      errMsg.includes("invalid_pack")
    ) {
      console.log(`[v0] Trying initConversation for pack=${packId}...`);
      const initSent = await initConversation(packId, text);

      if (initSent) {
        // initConversation with "OTHER" option and text already sends the message
        // Verify by checking if message appears in conversation
        await new Promise(r => setTimeout(r, 1500));
        try {
          const check = await getPackMessages(packId, sellerId);
          const lastMsg = check.messages[check.messages.length - 1];
          if (lastMsg && String(lastMsg.from.user_id) === String(sellerId)) {
            console.log(`[v0] initConversation already delivered the message for pack=${packId}`);
            return; // Message was sent via initConversation
          }
        } catch {
          // Couldn't verify, try sending anyway
        }
      }

      // Try sending again after init
      try {
        await sendMessage(packId, sellerId, text, buyerId);
        console.log(`[v0] sendMessage retry OK after initConversation for pack=${packId}`);
        return;
      } catch (retryErr) {
        console.log(`[v0] Retry after initConversation also failed for pack=${packId}:`, retryErr instanceof Error ? retryErr.message : retryErr);
      }
    }
  }
}

async function safeSendMessages(packId: string, sellerId: string, messages: string[], buyerId?: string) {
  for (let i = 0; i < messages.length; i++) {
    if (i === 0) {
      // First message uses safeSendMessage (handles initConversation if needed)
      await safeSendMessage(packId, sellerId, messages[i], buyerId);
    } else {
      await new Promise(r => setTimeout(r, 800)); // Slightly longer delay to avoid rate limits
      try {
        await sendMessage(packId, sellerId, messages[i], buyerId);
        console.log(`[v0] safeSendMessages chunk ${i}/${messages.length - 1} OK for pack=${packId}`);
      } catch (err) {
        console.log(`[v0] safeSendMessages chunk ${i}/${messages.length - 1} failed for pack=${packId}:`, err instanceof Error ? err.message : err);
        // Try once more with safeSendMessage (which handles init)
        try {
          await safeSendMessage(packId, sellerId, messages[i], buyerId);
        } catch {
          console.log(`[v0] safeSendMessages chunk ${i} retry also failed, skipping`);
        }
      }
    }
  }
}

/**
 * Find the order/pack associated with a buyer by searching recent seller orders.
 */
async function findOrderForBuyer(sellerId: string, buyerUserId: string, searchLimit: number = 20): Promise<{
  packId: string;
  orderId: string;
  buyerId: string;
  productType: string;
  productTitle: string;
} | null> {
  try {
    const ordersData = await getSellerOrders(sellerId, searchLimit, 0);
    const orders = ordersData.results || [];
    console.log(`[v0] findOrderForBuyer: searching ${orders.length} orders for buyer ${buyerUserId}`);

    for (const order of orders) {
      if (String(order.buyer.id) === String(buyerUserId) && order.status === "paid") {
        const packId = String(order.pack_id || order.id);
        const itemTitle = order.order_items?.[0]?.item?.title || "";
        const product = detectProductType(itemTitle);
        if (product) {
          return {
            packId,
            orderId: String(order.id),
            buyerId: String(order.buyer.id),
            productType: product.key,
            productTitle: itemTitle,
          };
        }
      }
    }
    return null;
  } catch (err) {
    console.log(`[v0] findOrderForBuyer failed:`, err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Determine conversation status by analyzing existing messages in the pack.
 */
function analyzeConversation(messages: Array<{ from: { user_id: string }; text: string }>, sellerId: string): {
  status: "no_seller_msgs" | "welcome_sent" | "instructions_sent" | "code_sent" | "human_requested";
  lastBuyerText: string;
} {
  const sellerMsgs = messages.filter(m => String(m.from.user_id) === String(sellerId));
  const buyerMsgs = messages.filter(m => String(m.from.user_id) !== String(sellerId));

  const lastBuyerText = buyerMsgs.length > 0
    ? buyerMsgs[buyerMsgs.length - 1].text.toLowerCase().trim()
    : "";

  if (sellerMsgs.length === 0) {
    return { status: "no_seller_msgs", lastBuyerText };
  }

  // Check all seller messages for specific content
  const allSellerText = sellerMsgs.map(m => m.text.toLowerCase()).join(" ");

  if (allSellerText.includes("tu codigo:") || allSellerText.includes("tu código:")) {
    return { status: "code_sent", lastBuyerText };
  }
  if (allSellerText.includes("asesor humano") || allSellerText.includes("vendedor te respondera")) {
    return { status: "human_requested", lastBuyerText };
  }
  if (allSellerText.includes("listo") && allSellerText.includes("lo enviamos")) {
    return { status: "instructions_sent", lastBuyerText };
  }
  if (allSellerText.includes("gracias por tu compra") || allSellerText.includes("roblox argentina")) {
    return { status: "welcome_sent", lastBuyerText };
  }

  return { status: "welcome_sent", lastBuyerText };
}

export async function handleMessageNotification(
  resource: string,
  userId: string
): Promise<void> {
  // Auth first (critical for Netlify serverless cold starts)
  await getAccessToken();
  const sellerId = getSellerId();
  if (!sellerId) {
    throw new Error("Seller ID not available after auth");
  }

  console.log(`[v0] handleMessageNotification: resource=${resource}, userId=${userId}`);

  // The notification userId is the person who sent the message.
  // If it's the seller, skip (we don't respond to ourselves).
  if (String(userId) === String(sellerId)) {
    console.log(`[v0] Message is from seller, skipping`);
    return;
  }

  // STRATEGY 1: Try to get pack_id directly from the message resource.
  // ML webhook sends resource like "/messages-mp-v2/{id}" which contains conversation info.
  let packIdFromResource: string | null = null;
  let buyerIdFromResource: string | null = null;

  try {
    const msgData = await getMessageByResource(resource);
    console.log(`[v0] Message resource data:`, JSON.stringify(msgData).slice(0, 500));
    if (msgData) {
      // Try extracting pack_id from various response formats
      const convId = (msgData as Record<string, unknown>).conversation_id as Record<string, unknown> | undefined;
      if (convId?.pack_id) {
        packIdFromResource = String(convId.pack_id);
      } else if (convId?.order_id) {
        packIdFromResource = String(convId.order_id);
      }
      // Also try top-level fields
      const raw = msgData as Record<string, unknown>;
      if (!packIdFromResource && raw.pack_id) {
        packIdFromResource = String(raw.pack_id);
      }
      if (!packIdFromResource && raw.resource_id) {
        packIdFromResource = String(raw.resource_id);
      }
      // Get buyer from message sender
      if (raw.from && typeof raw.from === "object") {
        const from = raw.from as Record<string, unknown>;
        if (from.user_id && String(from.user_id) !== String(sellerId)) {
          buyerIdFromResource = String(from.user_id);
        }
      }
    }
  } catch (err) {
    console.log(`[v0] Could not fetch message resource: ${err instanceof Error ? err.message : err}`);
  }

  console.log(`[v0] From resource: packId=${packIdFromResource}, buyerId=${buyerIdFromResource}`);

  // STRATEGY 2: If no pack from resource, find via buyer's recent orders (fallback).
  let orderInfo: {
    packId: string;
    orderId: string;
    buyerId: string;
    productType: string;
    productTitle: string;
  } | null = null;

  if (packIdFromResource) {
    // We have a packId from the resource, now find the matching order to get product info
    const buyerToSearch = buyerIdFromResource || userId;
    orderInfo = await findOrderForBuyer(sellerId, buyerToSearch);
    if (orderInfo) {
      // Override the packId with the one from the resource (more reliable)
      orderInfo.packId = packIdFromResource;
    } else {
      // We have pack but couldn't find order - try to get order from pack messages
      console.log(`[v0] Have packId=${packIdFromResource} but no matching order. Trying wider search...`);
      orderInfo = await findOrderForBuyer(sellerId, userId, 50); // Wider search
      if (orderInfo) {
        orderInfo.packId = packIdFromResource;
      }
    }
  } else {
    // No pack from resource - fallback to buyer search
    orderInfo = await findOrderForBuyer(sellerId, userId, 50); // Wider search
  }

  if (!orderInfo) {
    console.log(`[v0] No paid order found for buyer ${userId}, packFromResource=${packIdFromResource}`);
    addActivityLog({
      type: "message",
      message: `Mensaje de comprador sin orden reciente`,
      details: `Buyer: ${userId} | Resource: ${resource} | PackFromResource: ${packIdFromResource || "none"}`,
    });
    // If we at least have a packId, try to respond generically
    if (packIdFromResource) {
      console.log(`[v0] Attempting generic response with packId=${packIdFromResource}`);
      try {
        await safeSendMessage(
          packIdFromResource, sellerId,
          "Gracias por tu mensaje! Un asesor te respondera a la brevedad.",
          buyerIdFromResource || userId
        );
        addActivityLog({
          type: "message",
          message: `Respuesta generica enviada (sin orden match)`,
          details: `Pack: ${packIdFromResource}`,
        });
      } catch (sendErr) {
        console.log(`[v0] Generic response failed:`, sendErr instanceof Error ? sendErr.message : sendErr);
      }
    }
    return;
  }

  const { packId, orderId, buyerId, productType, productTitle } = orderInfo;
  console.log(`[v0] Found order: pack=${packId}, order=${orderId}, product=${productType}`);
  addActivityLog({
    type: "message",
    message: `Procesando mensaje de comprador`,
    details: `Pack: ${packId} | Orden: ${orderId} | Producto: ${productType} | Buyer: ${buyerId}`,
  });

  // Get all messages in this conversation
  const msgsData = await getPackMessages(packId, sellerId);
  const allMessages = (msgsData.messages || []).sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  if (allMessages.length === 0) {
    console.log(`[v0] No messages found for pack ${packId}`);
    return;
  }

  // Check if we already responded to the latest buyer message
  const lastMsg = allMessages[allMessages.length - 1];
  if (String(lastMsg.from.user_id) === String(sellerId)) {
    console.log(`[v0] Last message is from seller, already responded`);
    return;
  }

  // Analyze conversation to determine current status
  const { status, lastBuyerText } = analyzeConversation(allMessages, sellerId);
  console.log(`[v0] Conversation status=${status}, lastBuyerText="${lastBuyerText.slice(0, 60)}"`);

  const product = getProductByKey(productType);
  if (!product) {
    console.log(`[v0] Product not found for key: ${productType}`);
    return;
  }

  // Already delivered code - only respond to help requests
  if (status === "code_sent") {
    if (lastBuyerText.includes("humano") || lastBuyerText.includes("persona") || lastBuyerText.includes("ayuda") || lastBuyerText.includes("problema")) {
      await safeSendMessage(packId, sellerId, HUMAN_MESSAGE, buyerId);
      await notifyHumanRequested(packId, lastBuyerText);
      addActivityLog({ type: "human", message: "Ayuda post-entrega", details: `Pack: ${packId}` });
    }
    // Otherwise don't respond - code was already delivered
    return;
  }

  // Human already requested - don't auto-respond
  if (status === "human_requested") {
    return;
  }

  // ---- NO SELLER MESSAGES YET (first buyer message after purchase) ----
  if (status === "no_seller_msgs") {
    // Send welcome + instructions together since buyer is already engaged
    console.log(`[v0] First interaction - sending welcome + instructions`);
    const welcomeAndInstructions = [
      ...WELCOME_MESSAGE,
      ...product.instructions,
    ];
    await safeSendMessages(packId, sellerId, welcomeAndInstructions, buyerId);
    addActivityLog({
      type: "message",
      message: `Bienvenida + instrucciones enviadas: ${product.label}`,
      details: `Pack: ${packId} | Comprador escribio: "${lastBuyerText.slice(0, 60)}"`,
    });
    return;
  }

  // ---- WELCOME WAS SENT, buyer responds ----
  if (status === "welcome_sent") {
    const isConfirm = isConfirmation(lastBuyerText);
    if (isConfirm) {
      // Send instructions
      await safeSendMessages(packId, sellerId, product.instructions, buyerId);
      addActivityLog({
        type: "message",
        message: `Instrucciones enviadas: ${product.label}`,
        details: `Pack: ${packId}`,
      });
      return;
    }
    // Check cancel/human
    if (isCancel(lastBuyerText)) {
      await safeSendMessage(packId, sellerId, CANCEL_MESSAGE, buyerId);
      addActivityLog({ type: "message", message: "Compra cancelada", details: `Pack: ${packId}` });
      return;
    }
    if (isHumanRequest(lastBuyerText)) {
      await safeSendMessage(packId, sellerId, HUMAN_MESSAGE, buyerId);
      await notifyHumanRequested(packId, lastBuyerText);
      addActivityLog({ type: "human", message: "Humano solicitado", details: `Pack: ${packId}` });
      return;
    }
    // Unrecognized - send instructions anyway (they're engaged)
    await safeSendMessages(packId, sellerId, product.instructions, buyerId);
    addActivityLog({
      type: "message",
      message: `Instrucciones enviadas (respuesta no reconocida): ${product.label}`,
      details: `Pack: ${packId} | Msg: "${lastBuyerText.slice(0, 60)}"`,
    });
    return;
  }

  // ---- INSTRUCTIONS WERE SENT, buyer responds ----
  if (status === "instructions_sent") {
    const isReady = lastBuyerText === "listo" || lastBuyerText.includes("listo") ||
      lastBuyerText === "dale" || lastBuyerText === "ok" || lastBuyerText === "si" ||
      lastBuyerText === "sí" || lastBuyerText === "ya" || lastBuyerText === "ready";

    if (isCancel(lastBuyerText)) {
      await safeSendMessage(packId, sellerId, CANCEL_MESSAGE, buyerId);
      addActivityLog({ type: "message", message: "Compra cancelada", details: `Pack: ${packId}` });
      return;
    }
    if (isHumanRequest(lastBuyerText)) {
      await safeSendMessage(packId, sellerId, HUMAN_MESSAGE, buyerId);
      await notifyHumanRequested(packId, lastBuyerText);
      addActivityLog({ type: "human", message: "Humano solicitado", details: `Pack: ${packId}` });
      return;
    }

    if (isReady) {
      await deliverCode(packId, orderId, sellerId, buyerId, product, productTitle);
      return;
    }

    // Not "listo" but instructions were sent - remind them
    await safeSendMessage(packId, sellerId, REMINDER_MESSAGE, buyerId);
    addActivityLog({
      type: "message",
      message: "Recordatorio enviado",
      details: `Pack: ${packId} | Msg: "${lastBuyerText.slice(0, 60)}"`,
    });
    return;
  }
}

/**
 * Deliver the code from Google Sheets and send final messages.
 */
async function deliverCode(
  packId: string,
  orderId: string,
  sellerId: string,
  buyerId: string,
  product: ReturnType<typeof getProductByKey> & {},
  productTitle: string,
) {
  // Get code from Google Sheets
  const codeResult = await getAvailableCode(product.sheetName);

  if (!codeResult) {
    console.log(`[v0] SIN STOCK para ${product.label} (sheet: ${product.sheetName}), pack=${packId}`);
    await safeSendMessage(
      packId, sellerId,
      "Estamos preparando tu codigo. Un asesor te lo enviara en breve. Disculpa la demora!",
      buyerId
    );
    await notifyError("stock", `SIN STOCK para ${product.label} - Pack: ${packId} - Buyer: ${buyerId}. Recargar hoja "${product.sheetName}" de Google Sheets.`);
    addActivityLog({ type: "error", message: `SIN STOCK: ${product.label}`, details: `Pack: ${packId} | Sheet: ${product.sheetName} | Buyer: ${buyerId}. Recargar codigos en Google Sheets.` });
    return;
  }

  // Send code
  const codeMessage = product.codeMessage(codeResult.code, productTitle);
  await safeSendMessage(packId, sellerId, codeMessage, buyerId);

  // Mark code as delivered in sheet
  await markCodeDelivered(product.sheetName, codeResult.row, orderId);

  // Send final message
  await new Promise(r => setTimeout(r, 800));
  const finalText = product.finalMessage.join("\n\n");
  if (finalText.length <= 350) {
    await safeSendMessage(packId, sellerId, finalText, buyerId);
  } else {
    await safeSendMessages(packId, sellerId, product.finalMessage, buyerId);
  }

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
    }
  } catch (err) {
    console.log("[v0] Auto-deliver mark failed (non-blocking):", err);
  }
}

// ---- Helper matchers ----

function isConfirmation(text: string): boolean {
  return (
    text === "si" || text === "sí" || text === "confirmo" || text === "dale" ||
    text === "hola" || text === "buenas" || text === "buen dia" ||
    text === "buenas tardes" || text === "buenas noches" || text === "buenos dias" ||
    text === "ok" || text === "ya" ||
    text.startsWith("hola ") || text.startsWith("buenas ") ||
    text.startsWith("si ") || text.startsWith("si,") ||
    text.startsWith("sí ") || text.startsWith("sí,")
  );
}

function isCancel(text: string): boolean {
  return text === "no" || text.startsWith("no ") || text.includes("cancelar");
}

function isHumanRequest(text: string): boolean {
  return (
    text.includes("humano") || text.includes("persona") ||
    text.includes("atencion") || text.includes("ayuda")
  );
}
