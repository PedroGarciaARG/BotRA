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
