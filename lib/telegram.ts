// Telegram bot notifications for the seller

import { getConfig } from "@/lib/storage";

async function sendTelegramMessage(text: string): Promise<boolean> {
  const { TELEGRAM_TOKEN, TELEGRAM_CHAT_ID } = getConfig();

  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) {
    console.log("[v0] Telegram not configured: TOKEN=%s, CHAT_ID=%s", 
      TELEGRAM_TOKEN ? "set" : "missing", 
      TELEGRAM_CHAT_ID ? "set" : "missing"
    );
    return false;
  }

  try {
    console.log("[v0] Sending Telegram message...");
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

    if (!res.ok) {
      const err = await res.text();
      console.log("[v0] Telegram error response:", err);
      return false;
    }

    console.log("[v0] Telegram message sent successfully");
    return true;
  } catch (err) {
    console.log("[v0] Telegram send error:", err);
    return false;
  }
}

export async function notifyHumanRequested(
  packId: string,
  buyerMessage: string,
  buyerNickname?: string
) {
  const text = [
    "ATENCION REQUERIDA",
    "",
    `Pack: ${packId}`,
    buyerNickname ? `Comprador: ${buyerNickname}` : "",
    `Mensaje: "${buyerMessage}"`,
    "",
    "El comprador pidio hablar con una persona.",
  ]
    .filter(Boolean)
    .join("\n");

  return sendTelegramMessage(text);
}

export async function notifyCodeDelivered(
  packId: string,
  productType: string,
  code: string
) {
  const text = [
    "CODIGO ENTREGADO",
    "",
    `Pack: ${packId}`,
    `Producto: ${productType}`,
    `Codigo: \`${code}\``,
  ].join("\n");

  return sendTelegramMessage(text);
}

export async function notifyError(context: string, error: string) {
  const text = [
    "ERROR EN BOT",
    "",
    `Contexto: ${context}`,
    `Error: ${error}`,
  ].join("\n");

  return sendTelegramMessage(text);
}

export async function notifyUnhandledQuestion(
  questionId: string,
  questionText: string,
  itemTitle: string,
  itemId: string
) {
  const text = [
    "PREGUNTA SIN RESPONDER",
    "",
    `Pregunta ID: ${questionId}`,
    `Publicacion: ${itemTitle}`,
    `Item ID: ${itemId}`,
    "",
    `Pregunta: "${questionText}"`,
    "",
    "El bot no pudo interpretar esta pregunta.",
    "Respondela manualmente desde MercadoLibre.",
  ].join("\n");

  return sendTelegramMessage(text);
}

export async function notifyNewOrder(
  packId: string,
  productType: string,
  buyerNickname?: string
) {
  const text = [
    "NUEVA ORDEN",
    "",
    `Pack: ${packId}`,
    `Producto: ${productType}`,
    buyerNickname ? `Comprador: ${buyerNickname}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return sendTelegramMessage(text);
}
