// OpenAI GPT integration for generating intelligent question responses.
// Used as fallback when keyword matching doesn't find a predefined response.
// Returns null when the question cannot be answered (triggers Telegram alert).

import { generateText } from "ai";

const SYSTEM_PROMPT = `Sos un asistente de ventas de "Roblox Argentina" en MercadoLibre.
Vendes Gift Cards digitales de Steam y Roblox.

PRODUCTOS QUE VENDES:
- Roblox 400 Robux (digital, NO incluye item exclusivo)
- Roblox 800 Robux (digital, SI incluye item exclusivo)
- Roblox Gift Card 10 USD (acredita 10 USD, no Robux directamente; sirve para comprar 1000 Robux o contratar Premium)
- Steam Gift Card 5 USD (digital)
- Steam Gift Card 10 USD (digital)

INFORMACION CLAVE:
- Todas las Gift Cards son DIGITALES, se entregan por el chat de ML
- La entrega es INSTANTANEA una vez acreditado el pago
- El envio es GRATIS (es digital, no hay envio fisico)
- Los codigos de Roblox se canjean en www.roblox.com/redeem
- Los codigos de Steam se canjean en store.steampowered.com/account/redeemwalletcode
- Todos los medios de pago de ML estan aceptados
- Los codigos se verifican antes de enviarse
- La compra esta protegida por ML
- Los codigos tienen 3 meses de vigencia
- Se puede comprar para cualquier cuenta
- Se puede personalizar la tarjeta digital con un nombre para regalo
- La Gift Card de Roblox 10 USD es region global
- Te guiamos paso a paso para canjear el codigo

REGLAS IMPORTANTES:
- Responde SIEMPRE en espanol argentino (vos, tenes, podes, etc.)
- Maximo 2000 caracteres (limite de ML para respuestas a preguntas)
- Se amable, profesional y conciso
- SIEMPRE inicia con "Gracias por tu consulta."
- SIEMPRE termina con "Aguardamos tu compra. Saludos, somos Roblox Argentina."
- NUNCA des informacion de precios si no la tenes
- NUNCA inventes informacion
- NO uses emojis
- NO uses markdown ni asteriscos
- Responde en texto plano

REGLA CRITICA:
Si la pregunta NO esta relacionada con los productos que vendes, o no la entendes,
o no tenes informacion suficiente para responderla con certeza,
responde UNICAMENTE con la palabra: NO_RESPONDER
No agregues nada mas en ese caso.`;

/**
 * Generate a question response using GPT.
 * Returns null if GPT determines the question should not be answered automatically.
 */
export async function generateQuestionResponse(
  question: string,
  itemTitle: string,
  itemDescription?: string
): Promise<string | null> {
  try {
    const userPrompt = `Producto: ${itemTitle}
${itemDescription ? `Descripcion: ${itemDescription}` : ""}

Pregunta del comprador: "${question}"

Genera una respuesta apropiada para esta pregunta de MercadoLibre. Si no podes responder con certeza, responde UNICAMENTE "NO_RESPONDER".`;

    const { text } = await generateText({
      model: "openai/gpt-4o-mini" as never,
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
      maxTokens: 500,
    });

    const trimmed = text.trim();

    // GPT signaled it cannot answer
    if (trimmed === "NO_RESPONDER" || trimmed.startsWith("NO_RESPONDER")) {
      return null;
    }

    // Ensure it fits ML question response limit (2000 chars)
    return trimmed.slice(0, 2000);
  } catch (err) {
    console.error("OpenAI generation error:", err);
    // On error, return null so the question is NOT auto-answered
    return null;
  }
}
