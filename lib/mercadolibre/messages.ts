// Handle post-sale message notifications from MercadoLibre.
// NEW FLOW: Bot waits for buyer's first message, then sends welcome + instructions.
// Flow: buyer msg -> welcome+instructions -> buyer "LISTO" -> code -> final

import { getPackMessages, sendMessage, sendMessages, getSellerOrders, getOrderDetails, markShipmentDelivered, mlFetch, initConversation } from "./api";
import { getAccessToken, getSellerId } from "./auth";
import {
  detectProductType,
  getProductByKey,
  WELCOME_MESSAGE,
  CANCEL_MESSAGE,
  REMINDER_MESSAGE,
  THANKS_RESPONSE,
  THANKS_RESPONSE_ALT,
} from "@/lib/product-config";
import { addActivityLog } from "@/lib/storage";
import { getAvailableCode, markCodeDelivered } from "@/lib/google-sheets";
import { notifyHumanRequested, notifyCodeDelivered, notifyOutOfStock } from "@/lib/telegram";
import { generateChatResponse, splitMessageIntoChunks } from "@/lib/openai";

/**
 * Try to send a message, with automatic initConversation retry if it fails.
 */
async function safeSendMessage(packId: string, sellerId: string, text: string, buyerId?: string) {
  try {
    await sendMessage(packId, sellerId, text, buyerId);
  } catch (err) {
    console.log(`[v0] sendMessage failed, trying initConversation + retry:`, err instanceof Error ? err.message : err);
    await initConversation(packId, text);
    try {
      await sendMessage(packId, sellerId, text, buyerId);
    } catch {
      console.log(`[v0] Retry also failed, initConversation likely already sent it`);
    }
  }
}

async function safeSendMessages(packId: string, sellerId: string, messages: string[], buyerId?: string) {
  for (let i = 0; i < messages.length; i++) {
    if (i === 0) {
      await safeSendMessage(packId, sellerId, messages[i], buyerId);
    } else {
      await new Promise(r => setTimeout(r, 500));
      try {
        await sendMessage(packId, sellerId, messages[i], buyerId);
      } catch (err) {
        console.log(`[v0] safeSendMessages chunk ${i} failed:`, err instanceof Error ? err.message : err);
      }
    }
  }
}

/**
 * Find the order/pack associated with a buyer by searching recent seller orders.
 */
async function findOrderForBuyer(sellerId: string, buyerUserId: string): Promise<{
  packId: string;
  orderId: string;
  buyerId: string;
  productType: string;
  productTitle: string;
} | null> {
  try {
    const ordersData = await getSellerOrders(sellerId, 20, 0);
    const orders = ordersData.results || [];

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

  // userId = the buyer who sent the message.
  // Find their recent order to get the packId and product.
  const orderInfo = await findOrderForBuyer(sellerId, userId);

  if (!orderInfo) {
    console.log(`[v0] No paid order found for buyer ${userId}`);
    addActivityLog({
      type: "message",
      message: `Mensaje de comprador sin orden reciente`,
      details: `Buyer: ${userId}`,
    });
    return;
  }

  const { packId, orderId, buyerId, productType, productTitle } = orderInfo;
  console.log(`[v0] Found order: pack=${packId}, order=${orderId}, product=${productType}`);

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

  // Already delivered code - only respond to thanks or questions
  if (status === "code_sent") {
    // Check if buyer is thanking
    if (isThanking(lastBuyerText)) {
      const thanksMsg = Math.random() > 0.5 ? THANKS_RESPONSE : THANKS_RESPONSE_ALT;
      await safeSendMessage(packId, sellerId, thanksMsg, buyerId);
      addActivityLog({ type: "message", message: "Agradecimiento post-entrega", details: `Pack: ${packId}` });
      return;
    }
    
    // If asking something specific, try AI
    if (lastBuyerText.length > 10) {
      const postDeliveryContext = "Código ya fue entregado. Comprador pregunta algo post-entrega.";
      const aiResponse = await tryAIResponse(lastBuyerText, productTitle, packId, sellerId, buyerId, postDeliveryContext);
      if (!aiResponse) {
        // AI couldn't help - notify via Telegram
        await notifyHumanRequested(packId, `Post-entrega: "${lastBuyerText}"`);
        addActivityLog({ type: "human", message: "🤔 Consulta post-entrega no entendida", details: `Pack: ${packId}` });
      }
    }
    return;
  }

  // Human already requested - don't auto-respond
  if (status === "human_requested") {
    return;
  }

  // ---- NO SELLER MESSAGES YET (first buyer message after purchase) ----
  if (status === "no_seller_msgs") {
    // Send welcome asking about experience
    console.log(`[v0] First interaction - sending welcome`);
    await safeSendMessages(packId, sellerId, WELCOME_MESSAGE, buyerId);
    addActivityLog({
      type: "message",
      message: `Bienvenida enviada: ${product.label}`,
      details: `Pack: ${packId} | Comprador escribio: "${lastBuyerText.slice(0, 60)}"`,
    });
    return;
  }

  // ---- WELCOME WAS SENT, buyer responds about experience ----
  if (status === "welcome_sent") {
    // Regardless of answer, send instructions directly
    // Following the pattern from examples: ask experience, then send instructions
    await safeSendMessages(packId, sellerId, product.instructions, buyerId);
    addActivityLog({
      type: "message",
      message: `Instrucciones enviadas: ${product.label}`,
      details: `Pack: ${packId} | Respuesta: "${lastBuyerText.slice(0, 40)}"`,
    });
    return;
  }

  // ---- INSTRUCTIONS WERE SENT, buyer responds ----
  if (status === "instructions_sent") {
    // Check if it's a simple confirmation/ready to proceed
    const isReady = lastBuyerText === "listo" || lastBuyerText.includes("listo") ||
      lastBuyerText === "dale" || lastBuyerText === "ok" || lastBuyerText === "si" ||
      lastBuyerText === "sí" || lastBuyerText === "ya" || lastBuyerText.includes("esperando") ||
      lastBuyerText.includes("espero") || lastBuyerText.includes("pasame") ||
      lastBuyerText.includes("envía") || lastBuyerText.includes("envia");

    if (isReady) {
      await deliverCode(packId, orderId, sellerId, buyerId, product, productTitle);
      return;
    }

    // Check if it's a thank you or acknowledgment (don't send code yet)
    if (isThanking(lastBuyerText) || isSimpleAcknowledgment(lastBuyerText)) {
      // Don't respond - they're just acknowledging, wait for them to say "listo"
      console.log(`[v0] Buyer acknowledged instructions, waiting for "listo"`);
      return;
    }

    // If they're asking something, try AI
    const instructionsContext = "Comprador ya recibió las instrucciones de canje. Está preguntando algo antes de confirmar que está listo.";
    const aiResponse = await tryAIResponse(lastBuyerText, productTitle, packId, sellerId, buyerId, instructionsContext);
    if (!aiResponse) {
      // AI couldn't respond - notify human via Telegram (critical case)
      await notifyHumanRequested(packId, `IA no entendió: "${lastBuyerText}"`);
      addActivityLog({
        type: "human",
        message: "🤔 IA no entendió - Telegram notificado",
        details: `Pack: ${packId} | Msg: "${lastBuyerText.slice(0, 60)}"`,
      });
    }
    return;
  }
}

/**
 * Try to generate an intelligent, conversational response using AI.
 * Uses the new chat-focused AI with FAQ knowledge.
 * Returns true if AI responded successfully, false if human intervention is needed.
 */
async function tryAIResponse(
  buyerText: string,
  productTitle: string,
  packId: string,
  sellerId: string,
  buyerId: string,
  conversationContext?: string
): Promise<boolean> {
  try {
    const aiMessages = await generateChatResponse(
      buyerText,
      productTitle,
      conversationContext
    );

    if (!aiMessages || aiMessages.length === 0) {
      // AI couldn't help - needs human
      return false;
    }

    // Send all AI response chunks (already split at 350 chars)
    await safeSendMessages(packId, sellerId, aiMessages, buyerId);
    
    addActivityLog({
      type: "message",
      message: "IA respondió conversacionalmente",
      details: `Pack: ${packId} | Pregunta: "${buyerText.slice(0, 40)}" | Respuesta: "${aiMessages[0].slice(0, 40)}"`,
    });
    return true;
  } catch (err) {
    console.log(`[v0] AI response failed:`, err instanceof Error ? err.message : err);
    return false;
  }
}

/**
 * Deliver the code from Google Sheets and send final messages.
 * Handles out-of-stock scenarios with Telegram alert.
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
    // SIN STOCK - notify via Telegram and inform buyer
    const noStockMessage = "En breve te enviaremos el código. Estamos preparando tu gift card.";
    await safeSendMessage(packId, sellerId, noStockMessage, buyerId);
    
    // CRITICAL: Alert via Telegram for stock refill
    await notifyOutOfStock(packId, product.label);
    
    addActivityLog({ 
      type: "error", 
      message: `🚨 SIN STOCK: ${product.label}`, 
      details: `Pack: ${packId} - Telegram notificado` 
    });
    return;
  }

  // Send code
  const codeMessage = product.codeMessage(codeResult.code, productTitle);
  await safeSendMessage(packId, sellerId, codeMessage, buyerId);

  // Mark code as delivered in sheet
  await markCodeDelivered(product.sheetName, codeResult.row, orderId);

  // Send final message (already split into chunks in product config)
  await new Promise(r => setTimeout(r, 800));
  await safeSendMessages(packId, sellerId, product.finalMessage, buyerId);

  addActivityLog({
    type: "code_delivery",
    message: `✅ Código entregado: ${product.label}`,
    details: `Pack: ${packId} | Code: ${codeResult.code.slice(0, 4)}...`,
  });

  // Log delivery (no Telegram notification per user request)
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

function isThanking(text: string): boolean {
  return (
    text.includes("gracias") || text.includes("muchas gracias") ||
    text.includes("graciass") || text.includes("muchas") ||
    text.includes("thank") || text.includes("genial") ||
    text.includes("perfecto") || text.includes("excelente") ||
    text.includes("buenisimo") || text.includes("buenísimo")
  );
}

function isSimpleAcknowledgment(text: string): boolean {
  return (
    text === "ok" || text === "dale" || text === "si" || text === "sí" ||
    text === "okey" || text === "okay" || text === "entiendo" ||
    text.length < 8 // Very short responses are usually acknowledgments
  );
}

function isCancel(text: string): boolean {
  return text === "no" || text.startsWith("no ") || text.includes("cancelar");
}
