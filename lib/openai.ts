// OpenAI GPT integration for generating intelligent question responses.
// Used as fallback when keyword matching doesn't find a predefined response.

import { generateText } from "ai";

const SYSTEM_PROMPT = `Sos un asistente de ventas de "Roblox Argentina" en MercadoLibre.
Vendes Gift Cards digitales de Steam y Roblox.

REGLAS IMPORTANTES:
- Responde SIEMPRE en español argentino (vos, tenes, podes, etc.)
- Maximo 2000 caracteres (limite de ML para respuestas a preguntas)
- Se amable, profesional y conciso
- Siempre termina con "Aguardamos tu compra. Somos Roblox Argentina."
- Las Gift Cards son DIGITALES, se entregan por el chat de ML
- La entrega es INSTANTANEA una vez acreditado el pago
- El envio es GRATIS (es digital)
- Todos los medios de pago de ML estan aceptados
- Los codigos se verifican antes de enviarse
- La compra esta protegida por ML
- NUNCA des informacion de precios si no la tenes
- NUNCA inventes informacion
- Si no sabes algo, sugeri contactar por el chat despues de la compra
- NO uses emojis
- NO uses markdown ni asteriscos
- Responde en texto plano`;

export async function generateQuestionResponse(
  question: string,
  itemTitle: string,
  itemDescription?: string
): Promise<string> {
  try {
    const userPrompt = `Producto: ${itemTitle}
${itemDescription ? `Descripcion: ${itemDescription}` : ""}

Pregunta del comprador: "${question}"

Genera una respuesta apropiada para esta pregunta de MercadoLibre.`;

    const { text } = await generateText({
      model: "openai/gpt-4o-mini" as never,
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
      maxTokens: 500,
    });

    // Ensure it fits ML question response limit (2000 chars)
    return text.slice(0, 2000);
  } catch (err) {
    console.error("OpenAI generation error:", err);
    return "Gracias por tu consulta. Te invitamos a realizar la compra y consultarnos por el chat privado para darte una respuesta mas detallada. Aguardamos tu compra. Somos Roblox Argentina.";
  }
}
