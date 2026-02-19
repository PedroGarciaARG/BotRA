// Telegram bot notifications for the seller

import { getConfig } from "@/lib/storage";

async function sendTelegramMessage(text: string): Promise<boolean> {
  const { TELEGRAM_TOKEN, TELEGRAM_CHAT_ID } = getConfig();

  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error("Telegram credentials not configured");
    return false;
  }

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text,
          parse_mode: "Markdown",
        }),
      }
    );

    return res.ok;
  } catch (err) {
    console.error("Telegram send error:", err);
    return false;
  }
}

/**
 * Notify when AI doesn't understand something from the chat.
 * Only sent in critical cases where human intervention is needed.
 */
export async function notifyHumanRequested(
  packId: string,
  buyerMessage: string,
  buyerNickname?: string
) {
  const text = [
    "🤔 NO ENTIENDO - ATENCION REQUERIDA",
    "",
    `Pack: ${packId}`,
    buyerNickname ? `Comprador: ${buyerNickname}` : "",
    `Mensaje: "${buyerMessage}"`,
    "",
    "La IA no pudo entender o responder esto. Revisa el chat en ML.",
  ]
    .filter(Boolean)
    .join("\n");

  return sendTelegramMessage(text);
}

/**
 * Removed: Code delivery notifications are no longer sent to reduce noise.
 * Only critical events (stock issues, errors, AI confusion) trigger Telegram alerts.
 */
export async function notifyCodeDelivered(
  packId: string,
  productType: string,
  code: string
) {
  // Notification disabled per user request - only send on critical events
  console.log(`[v0] Code delivered: ${packId} | ${productType} | ${code.slice(0, 4)}...`);
  return Promise.resolve(true);
}

/**
 * Notify about out-of-stock situation (CRITICAL - always sent).
 */
export async function notifyOutOfStock(
  packId: string,
  productType: string
) {
  const text = [
    "🚨 SIN STOCK - URGENTE",
    "",
    `Pack: ${packId}`,
    `Producto: ${productType}`,
    "",
    "No hay codigos disponibles en el Drive. Recarga urgentemente.",
  ].join("\n");

  return sendTelegramMessage(text);
}

export async function notifyError(context: string, error: string) {
  // Only send error notifications for critical failures
  if (context === "stock" || context === "webhook" || context === "auth") {
    const text = [
      "⚠️ ERROR CRITICO",
      "",
      `Contexto: ${context}`,
      `Error: ${error}`,
    ].join("\n");

    return sendTelegramMessage(text);
  }
  
  // Non-critical errors: just log, don't notify
  console.log(`[v0] Non-critical error (${context}): ${error}`);
  return Promise.resolve(true);
}

/**
 * Notify when AI cannot answer a pre-sale question (CRITICAL).
 */
export async function notifyUnhandledQuestion(
  questionId: string,
  questionText: string,
  itemTitle: string,
  itemId: string
) {
  const text = [
    "❓ NO ENTIENDO PREGUNTA",
    "",
    `Pregunta ID: ${questionId}`,
    `Publicacion: ${itemTitle}`,
    `Item ID: ${itemId}`,
    "",
    `Pregunta: "${questionText}"`,
    "",
    "La IA no pudo interpretar esta pregunta. Respondela manualmente en ML.",
  ].join("\n");

  return sendTelegramMessage(text);
}

/**
 * Removed: New order notifications disabled per user request.
 * Only send notifications for critical events (stock, AI confusion, errors).
 */
export async function notifyNewOrder(
  packId: string,
  productType: string,
  buyerNickname?: string
) {
  // Notification disabled - only critical events trigger Telegram
  console.log(`[v0] New order: ${packId} | ${productType} | ${buyerNickname || "N/A"}`);
  return Promise.resolve(true);
}
