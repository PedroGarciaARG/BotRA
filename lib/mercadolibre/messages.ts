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
  HUMAN_MESSAGE,
  REMINDER_MESSAGE,
} from "@/lib/product-config";
import { addActivityLog } from "@/lib/storage";
import { getAvailableCode, markCodeDelivered } from "@/lib/google-sheets";
import { notifyHumanRequested, notifyCodeDelivered, notifyError } from "@/lib/telegram";
import { generateText } from "ai";

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
    // Unrecognized - try AI first, then fallback to instructions
    const aiHandled = await tryAIResponse(lastBuyerText, productTitle, packId, sellerId, buyerId);
    if (aiHandled) {
      return; // AI responded successfully
    }
    // AI couldn't help - send instructions anyway (they're engaged)
    await safeSendMessages(packId, sellerId, product.instructions, buyerId);
    addActivityLog({
      type: "message",
      message: `Instrucciones enviadas (AI no pudo responder): ${product.label}`,
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

    // Not "listo" but instructions were sent - try to respond intelligently with AI
    const aiResponse = await tryAIResponse(lastBuyerText, productTitle, packId, sellerId, buyerId);
    if (!aiResponse) {
      // AI couldn't respond - send reminder and notify human
      await safeSendMessage(packId, sellerId, REMINDER_MESSAGE, buyerId);
      await notifyHumanRequested(packId, `AI no pudo responder: "${lastBuyerText}"`);
      addActivityLog({
        type: "human",
        message: "AI no pudo responder - humano notificado",
        details: `Pack: ${packId} | Msg: "${lastBuyerText.slice(0, 60)}"`,
      });
    }
    return;
  }
}

/**
 * Try to generate an intelligent response using AI for natural conversation.
 * Returns true if AI responded, false if human intervention is needed.
 */
async function tryAIResponse(
  buyerText: string,
  productTitle: string,
  packId: string,
  sellerId: string,
  buyerId: string
): Promise<boolean> {
  try {
    const isRoblox = productTitle.toLowerCase().includes("roblox");
    const isSteam = productTitle.toLowerCase().includes("steam");
    const redeemUrl = isRoblox
      ? "www.roblox.com/redeem"
      : isSteam
      ? "store.steampowered.com/account/redeemwalletcode"
      : "la pagina oficial";

    const systemPrompt = `Sos un asistente de ventas de "Roblox Argentina" en MercadoLibre.
El comprador esta en conversacion sobre su compra: ${productTitle}

CONTEXTO:
- El comprador ya recibio instrucciones sobre como canjear
- Debe responder "LISTO" cuando este listo para recibir el codigo
- El codigo se canjea en: ${redeemUrl}

TU TRABAJO:
- Responder dudas sobre el proceso de canje
- Guiar al comprador para que diga "LISTO"
- Si pregunta algo que no esta relacionado con el canje o la entrega, responde SOLO: NO_RESPONDER

REGLAS:
- Espanol argentino (vos, tenes, podes)
- Amable y conciso (max 300 caracteres)
- Sin emojis ni markdown
- Si no podes ayudar, responde SOLO: NO_RESPONDER`;

    const { text } = await generateText({
      model: "openai/gpt-4o-mini" as never,
      system: systemPrompt,
      prompt: `Comprador pregunta: "${buyerText}"\n\nResponde:`,
      maxTokens: 150,
    });

    const response = text.trim();

    if (response === "NO_RESPONDER" || response.startsWith("NO_RESPONDER")) {
      return false; // Signal that human intervention is needed
    }

    // AI generated a response - send it
    await safeSendMessage(packId, sellerId, response.slice(0, 350), buyerId);
    addActivityLog({
      type: "message",
      message: "AI respondio consulta",
      details: `Pack: ${packId} | Q: "${buyerText.slice(0, 40)}" | A: "${response.slice(0, 40)}"`,
    });
    return true;
  } catch (err) {
    console.log(`[v0] AI response failed:`, err instanceof Error ? err.message : err);
    return false; // On error, request human
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
    await safeSendMessage(
      packId, sellerId,
      "Estamos preparando tu codigo. Un asesor te lo enviara en breve.",
      buyerId
    );
    await notifyError("stock", `Sin stock para ${product.label} - Pack: ${packId}`);
    addActivityLog({ type: "error", message: `Sin stock: ${product.label}`, details: `Pack: ${packId}` });
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
