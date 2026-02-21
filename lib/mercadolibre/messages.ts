// Handle post-sale message notifications from MercadoLibre
// Anti-fraud system to prevent code resending and product changes
// AI-powered responses for customer questions with human escalation

import {
  getPackMessages,
  sendMessage,
  sendMessages,
  getSellerOrders,
  getOrderDetails,
  mlFetch,
} from "./api";
import { getAccessToken, getSellerId } from "./auth";
import {
  detectProductType,
  getProductByKey,
  WELCOME_MESSAGE,
  CANCEL_MESSAGE,
  HUMAN_MESSAGE,
  REMINDER_MESSAGE,
} from "@/lib/product-config";
import { addActivityLog, getPackState, setPackState, updatePackState } from "@/lib/storage";
import { getAvailableCode, markCodeDelivered } from "@/lib/google-sheets";
import { notifyHumanRequested, notifyCodeDelivered, notifyError } from "@/lib/telegram";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import crypto from "crypto";

// ============= ANTI-FRAUD HELPERS =============

function getMessageHash(text: string): string {
  return crypto.createHash("md5").update(text.toLowerCase().trim()).digest("hex");
}

function isCodeRequest(text: string): boolean {
  // Detect when user is asking for/confirming they want the code
  return /listo|ready|si|sí|ok|okk|confirmado|dale|enviame|envia|el codigo|qual es|cual es|dame|darme|porfavor|por favor|entreg|send me|gimme|code|activate/i.test(text);
}

function isResendAttempt(text: string): boolean {
  // Detect when user says they didn't receive the code
  return /no me llego|no me recibio|no recibio|no funciona|resend|didnt receive|no me lleg|lost code|no tengo|no recibe|no veo|donde esta|dónde está/i.test(text);
}

function isProductChangeAttempt(text: string): boolean {
  return /cambiar|change|otro|different|en vez de|en lugar de|prefer/i.test(text);
}

// ============= MESSAGE SENDING =============

async function safeSendMessage(
  packId: string,
  sellerId: string,
  text: string,
  buyerId?: string
) {
  try {
    await sendMessage(packId, sellerId, text, buyerId);
  } catch (err) {
    console.log(`[v0] sendMessage failed:`, err instanceof Error ? err.message : err);
    throw err;
  }
}

async function safeSendMessages(
  packId: string,
  sellerId: string,
  messages: string[],
  buyerId?: string
) {
  for (let i = 0; i < messages.length; i++) {
    if (i > 0) {
      await new Promise((r) => setTimeout(r, 500));
    }
    try {
      await sendMessage(packId, sellerId, messages[i], buyerId);
    } catch (err) {
      console.log(`[v0] safeSendMessages chunk ${i} failed:`, err);
    }
  }
}

// ============= FIND ORDER =============

async function findOrderForBuyer(
  sellerId: string,
  buyerUserId: string
): Promise<{
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
    console.log(`[v0] findOrderForBuyer failed:`, err);
    return null;
  }
}

// ============= ANALYZE CONVERSATION =============

function analyzeConversation(
  messages: Array<{ from: { user_id: string }; text: string }>,
  sellerId: string
): {
  status: "no_seller_msgs" | "welcome_sent" | "instructions_sent" | "code_sent" | "human_requested";
  lastBuyerText: string;
} {
  const sellerMsgs = messages.filter((m) => String(m.from.user_id) === String(sellerId));
  const buyerMsgs = messages.filter((m) => String(m.from.user_id) !== String(sellerId));

  const lastBuyerText =
    buyerMsgs.length > 0 ? buyerMsgs[buyerMsgs.length - 1].text.toLowerCase().trim() : "";

  if (sellerMsgs.length === 0) {
    return { status: "no_seller_msgs", lastBuyerText };
  }

  const allSellerText = sellerMsgs.map((m) => m.text.toLowerCase()).join(" ");

  if (allSellerText.includes("tu codigo:") || allSellerText.includes("tu código:")) {
    return { status: "code_sent", lastBuyerText };
  }
  if (
    allSellerText.includes("asesor humano") ||
    allSellerText.includes("vendedor te respondera")
  ) {
    return { status: "human_requested", lastBuyerText };
  }
  if (allSellerText.includes("listo") && allSellerText.includes("lo enviamos")) {
    return { status: "instructions_sent", lastBuyerText };
  }
  if (
    allSellerText.includes("gracias por tu compra") ||
    allSellerText.includes("roblox argentina")
  ) {
    return { status: "welcome_sent", lastBuyerText };
  }

  return { status: "welcome_sent", lastBuyerText };
}

// ============= AI RESPONSE GENERATOR =============

async function tryAIResponse(
  buyerText: string,
  productTitle: string,
  packId: string,
  sellerId: string,
  buyerId: string
): Promise<boolean> {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.log(`[v0] OPENAI_API_KEY not set, skipping AI response`);
      return false;
    }

    const openai = createOpenAI({ apiKey });

    const isRoblox = productTitle.toLowerCase().includes("roblox");
    const isSteam = productTitle.toLowerCase().includes("steam");
    const redeemUrl = isRoblox
      ? "www.roblox.com/redeem"
      : isSteam
        ? "store.steampowered.com/account/redeemwalletcode"
        : "la pagina oficial";

    const systemPrompt = `Sos un asistente de venta de gift cards Roblox y Steam en MercadoLibre.

Tu personalidad:
- Cercano, amigable y natural
- Tono argentino (vos, tenes, podes)
- Claro y profesional, sin ser robótico

Tu función:
- Responder preguntas del cliente
- Ser breve (máximo 4 líneas)
- No enviar códigos
- No repetir mensajes
- No explicar pasos técnicos completos
- No incluir promociones ni datos de contacto
- No cerrar la conversación

Reglas:
- Si preguntan por envío → es digital e inmediato por este chat
- Si preguntan por demora → es inmediato tras acreditarse el pago
- Si preguntan si llega por mail → aclarar que se envía por este chat
- No inventar información
- No modificar instrucciones técnicas
- Para canjear: ${redeemUrl}

Si NO PODES ayudar con la consulta específica, responde SOLO: NO_RESPONDER`;

    const { text } = await generateText({
      model: openai("gpt-4o-mini"),
      system: systemPrompt,
      prompt: `Comprador pregunta: "${buyerText}"\n\nResponde:`,
      maxTokens: 150,
      temperature: 0.4,
    });

    const response = text.trim();

    if (response === "NO_RESPONDER" || response.startsWith("NO_RESPONDER")) {
      return false;
    }

    await safeSendMessage(packId, sellerId, response.slice(0, 350), buyerId);
    addActivityLog({
      type: "message",
      message: "AI respondio consulta",
      details: `Pack: ${packId}`,
    });
    return true;
  } catch (err) {
    console.log(`[v0] AI response failed:`, err instanceof Error ? err.message : err);
    return false;
  }
}

// ============= MAIN MESSAGE HANDLER =============

export async function handleMessageNotification(
  resource: string,
  userId: string
): Promise<void> {
  await getAccessToken();
  const sellerId = getSellerId();
  if (!sellerId) {
    throw new Error("Seller ID not available after auth");
  }

  console.log(`[v0] handleMessageNotification: userId=${userId}`);

  if (String(userId) === String(sellerId)) {
    console.log(`[v0] Message is from seller, skipping`);
    return;
  }

  const orderInfo = await findOrderForBuyer(sellerId, userId);
  if (!orderInfo) {
    console.log(`[v0] No paid order found for buyer ${userId}`);
    addActivityLog({
      type: "message",
      message: `Mensaje sin orden reciente`,
      details: `Buyer: ${userId}`,
    });
    return;
  }

  const { packId, orderId, buyerId, productType, productTitle } = orderInfo;
  console.log(`[v0] Found order: pack=${packId}, product=${productType}`);

  const msgsData = await getPackMessages(packId, sellerId);
  const allMessages = (msgsData.messages || []).sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  if (allMessages.length === 0) {
    console.log(`[v0] No messages for pack ${packId}`);
    return;
  }

  // Check if we already responded to this message
  const lastMsg = allMessages[allMessages.length - 1];
  if (String(lastMsg.from.user_id) === String(sellerId)) {
    console.log(`[v0] Already responded to last message`);
    return;
  }

  const { status, lastBuyerText } = analyzeConversation(allMessages, sellerId);
  console.log(`[v0] Status: ${status}, msg: "${lastBuyerText.slice(0, 60)}"`);

  const product = getProductByKey(productType);
  if (!product) {
    console.log(`[v0] Product not found: ${productType}`);
    return;
  }

  // Get or init pack state
  let state = getPackState(packId);
  if (!state) {
    state = {
      packId,
      orderId,
      sellerId,
      buyerId,
      productType,
      productTitle,
      status: "waiting_buyer",
      codigo_enviado: false,
      instrucciones_enviadas: false,
      intentos_reenvio: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setPackState(packId, state);
  }

  // ============= DEDUPLICATION: Check if we already processed this exact message =============
  const currentHash = getMessageHash(lastBuyerText);
  if (state.ultimo_mensaje_hash === currentHash) {
    console.log(`[v0] Duplicate message detected (hash=${currentHash}), skipping pack ${packId}`);
    return;
  }

  // Update with latest buyer message and hash
  updatePackState(packId, {
    ultimo_mensaje_comprador: lastBuyerText,
    ultimo_mensaje_comprador_at: new Date().toISOString(),
    ultimo_mensaje_hash: currentHash,
  });

  // ============= ANTI-FRAUD: Code Resend Attempt =============
  if (state.codigo_enviado && isResendAttempt(lastBuyerText)) {
    state.intentos_reenvio = (state.intentos_reenvio || 0) + 1;
    console.log(`[v0] Resend attempt #${state.intentos_reenvio} for pack ${packId}`);

    // Allow up to 2 redeliveries
    if ((state.intentos_reenvio || 0) <= 2) {
      // Reenviar código
      const codeMsg = `Tu codigo: ${state.codeDelivered}\n\nCanjea en ${
        /roblox/i.test(productTitle) ? "www.roblox.com/redeem" : "la pagina de canje"
      }`;
      await safeSendMessage(packId, sellerId, codeMsg, buyerId);
      updatePackState(packId, { intentos_reenvio: state.intentos_reenvio });
      addActivityLog({
        type: "message",
        message: `Código reenviado (intento ${state.intentos_reenvio})`,
        details: `Pack: ${packId}`,
      });
      return;
    }

    // After 2 redeliveries, escalate to human
    const escalateMsg = `Para tu seguridad no podemos reenviar más códigos. Un asesor te ayudará en breve.`;
    await safeSendMessage(packId, sellerId, escalateMsg, buyerId);
    await notifyHumanRequested(
      packId,
      `Múltiples reenvíos (${state.intentos_reenvio}): Cliente reporta no recibir código`
    );
    updatePackState(packId, { intentos_reenvio: state.intentos_reenvio });
    return;
  }

  // ============= ANTI-FRAUD: Product Change Attempt =============
  if (state.codigo_enviado && isProductChangeAttempt(lastBuyerText)) {
    const changeMsg = `Una vez enviado el código no podemos modificar el producto. Si necesitás ayuda con el canje estoy acá.`;
    await safeSendMessage(packId, sellerId, changeMsg, buyerId);
    return;
  }

  // ============= CODE ALREADY SENT - Help Only =============
  if (status === "code_sent") {
    if (
      lastBuyerText.includes("humano") ||
      lastBuyerText.includes("persona") ||
      lastBuyerText.includes("ayuda") ||
      lastBuyerText.includes("problema")
    ) {
      await safeSendMessage(packId, sellerId, HUMAN_MESSAGE, buyerId);
      await notifyHumanRequested(packId, lastBuyerText);
      addActivityLog({ type: "human", message: "Ayuda post-entrega", details: `Pack: ${packId}` });
    }
    return;
  }

  // ============= HUMAN ALREADY REQUESTED =============
  if (status === "human_requested") {
    return;
  }

  // ============= FIRST MESSAGE - Welcome + Instructions =============
  if (status === "no_seller_msgs") {
    console.log(`[v0] First interaction - sending welcome + instructions`);

    // Send welcome + instructions WITHOUT checking stock
    // Stock will be checked only when buyer asks for code
    const welcomeAndInstructions = [...WELCOME_MESSAGE, ...product.instructions];
    await safeSendMessages(packId, sellerId, welcomeAndInstructions, buyerId);

    updatePackState(packId, {
      status: "instructions_sent",
      instrucciones_enviadas: true,
    });

    addActivityLog({
      type: "message",
      message: `Welcome + instrucciones: ${product.label}`,
      details: `Pack: ${packId}`,
    });
    return;
  }

  // ============= INSTRUCTIONS SENT - Waiting for Code Request =============
  if (status === "instructions_sent") {
    // Check if user is asking for/confirming they want the code
    if (isCodeRequest(lastBuyerText)) {
      // Get code if not already stored
      let code: string = state.codeDelivered || null;

      if (!code) {
        try {
          const codeData = await getAvailableCode(product.sheetName);
      if (!codeData) {
        const stockMsg = `Gracias por tu paciencia! En breve te enviamos tu gift card.`;
        await safeSendMessage(packId, sellerId, stockMsg, buyerId);
        await notifyError("stock", `SIN STOCK - Producto: ${productTitle}, Pack: ${packId}, Buyer: ${buyerId}`);
        addActivityLog({
          type: "error",
          message: `SIN STOCK al entregar: ${product.label}`,
          details: `Pack: ${packId}`,
        });
        return;
      }
          code = codeData.code;
          await markCodeDelivered(product.sheetName, codeData.row, orderId);
        } catch (err) {
          console.log(`[v0] Code retrieval failed:`, err);
          await notifyError("code", `Error getting code: ${productTitle}`);
          return;
        }
      }

      // Send code
      const codeMsg = `Tu codigo: ${code}\n\nCanjea en ${
        /roblox/i.test(productTitle) ? "www.roblox.com/redeem" : "la pagina de canje"
      }`;

      await safeSendMessage(packId, sellerId, codeMsg, buyerId);

      updatePackState(packId, {
        status: "code_sent",
        codigo_enviado: true,
        codigo_enviado_at: new Date().toISOString(),
        codeDelivered: code,
      });

      await notifyCodeDelivered(packId, productTitle, code);
      addActivityLog({
        type: "code_delivery",
        message: `Código entregado`,
        details: `Pack: ${packId}`,
      });
      return;
    }

    // Not asking for code - try AI to answer questions
    const aiResponded = await tryAIResponse(lastBuyerText, productTitle, packId, sellerId, buyerId);
    if (!aiResponded) {
      // AI couldn't help - send reminder
      await safeSendMessage(packId, sellerId, REMINDER_MESSAGE, buyerId);
      await notifyHumanRequested(packId, `AI no pudo responder: "${lastBuyerText}"`);
      addActivityLog({
        type: "human",
        message: "AI no pudo responder - humano notificado",
        details: `Pack: ${packId}`,
      });
    }
    return;
  }

  // Unknown status - try AI
  const aiResponded = await tryAIResponse(lastBuyerText, productTitle, packId, sellerId, buyerId);
  if (!aiResponded) {
    await notifyHumanRequested(packId, `Consulta no reconocida: "${lastBuyerText}"`);
  }
}
