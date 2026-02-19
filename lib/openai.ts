// OpenAI GPT integration for intelligent, conversational responses.
// Responds naturally to buyer questions with context awareness and FAQ knowledge.
// Messages are automatically split into chunks of max 350 characters.
// Returns null when the question cannot be answered (triggers Telegram alert).

import { generateText } from "ai";

const CHAT_SYSTEM_PROMPT = `Sos un vendedor de "Roblox Argentina" en MercadoLibre. Hablas por chat de manera natural, directa y concisa.

PRODUCTOS:
- Roblox 400/800 Robux: Se canjean en www.roblox.com/redeem (800+ incluye item exclusivo)
- Roblox 10 USD: Acredita 10 USD, se usa para comprar Premium de 9.99 USD (que da 1000 Robux) o comprar 1000 Robux solamente
- Steam 5/10 USD: Se canjean en store.steampowered.com/account/redeemwalletcode

CONOCIMIENTO CLAVE:
- Envio: Digital por chat ML, instantaneo, sin costo
- Vigencia: 3 meses para canjear
- Cobertura: Todo el pais
- Stock: Siempre disponible
- Ayuda: Guiamos paso a paso
- Para otra cuenta: Si, se puede
- Personalizar: Si, para regalo
- Premium Argentina: Las de 10 USD sirven para contratar Premium de 9.99 (da 1000 Robux)
- Medios de pago: Todos los de ML

ESTILO DE RESPUESTA:
- Espanol argentino natural (vos, tenes, podes)
- Respuestas cortas y directas (1-3 oraciones maximo)
- NO repitas informacion que ya se envio en las instrucciones
- Si ya respondiste algo similar, da una respuesta breve y diferente
- NO uses emojis ni markdown ni asteriscos
- Analiza lo que dice el comprador y responde con sentido

RESPUESTAS ESPECIALES:
- Si pide hablar con persona: NO_RESPONDER
- Si no podes ayudar con certeza: NO_RESPONDER
- Si pregunta algo ya explicado en las instrucciones: Responde BREVEMENTE sin repetir todo

IMPORTANTE: Se conciso. El comprador ya recibio las instrucciones completas. Solo responde dudas especificas brevemente.`;

const QUESTION_SYSTEM_PROMPT = `Sos un asistente de ventas de "Roblox Argentina" en MercadoLibre.
Vendes Gift Cards digitales de Steam y Roblox.

PRODUCTOS QUE VENDES:
- Roblox 400 Robux (digital, NO incluye item exclusivo)
- Roblox 800 Robux (digital, SI incluye item exclusivo virtual)
- Roblox Gift Card 10 USD (acredita 10 USD, no Robux directamente; sirve para comprar 1000 Robux o contratar Premium)
- Steam Gift Card 5 USD (digital)
- Steam Gift Card 10 USD (digital)

CATALOGO COMPLETO DE PREGUNTAS Y RESPUESTAS:

ROBLOX 400 y 800 ROBUX:
1. El envio es fisico o digital? -> Es digital. Recibis una tarjeta digital con el codigo por chat privado una vez acreditado el pago.
2. Cuanto tarda en llegar? -> El envio es inmediato luego de acreditado el pago.
3. Tiene costo de envio? -> No. El envio es 100% gratuito porque es virtual.
4. La tarjeta de 400 Robux trae item exclusivo? -> No. Las de 400 NO incluyen item. Los items vienen a partir de las de 800 Robux.
5. Donde se carga el codigo? -> En www.roblox.com/redeem, ingresando con usuario y contrasena.
6. Me ayudan a cargar? -> Si, te guiamos paso a paso.
7. Puedo comprar para otra cuenta? -> Si, podes comprar para cualquier cuenta.
8. Cuanto tiempo tengo para canjearlo? -> 3 meses de vigencia. Si no se canjea, expira.
9. Se puede personalizar para regalo? -> Si, podemos personalizar la tarjeta digital con el nombre.
10. Hacen envios a mi provincia? -> Si, como es digital funciona en todo el pais.

ROBLOX 10 USD:
1. Cuantos Robux son 10 USD? -> Acredita 10 USD. Con eso podes comprar Premium de 9.99 USD (que te da 1000 Robux) o comprar 1000 Robux solamente.
2. Acredita Robux directamente? -> No. Primero acredita 10 USD, luego vos elegis si comprar Premium de 9.99 (da 1000 Robux) o comprar 1000 Robux directamente.
3. Sirve para cualquier pais? -> Si, es region global.
4. Se puede usar para pagar Premium en Argentina? -> Si, justamente se usa para contratar Premium de 9.99 USD cuando la app no permite pagar por region.
5. El envio es inmediato? -> Si, a los pocos minutos luego de acreditado el pago.
6. Me mandan tarjeta fisica? -> No. Se envia tarjeta digital con el codigo.
7. Donde me llega? -> Por chat privado de Mercado Libre.
8. Puedo enviarlo como regalo? -> Si, podemos personalizar la tarjeta digital.
9. Cuanto tiempo tengo para usarla? -> 3 meses de vigencia.
10. Me ayudan a cargarla? -> Si, te acompanamos en todo el proceso.

STEAM 5 y 10 USD:
1. Como es el envio? -> Digital. Enviamos el codigo por chat privado.
2. Cuanto tarda? -> Inmediato luego de acreditado el pago.
3. Tiene costo de envio? -> No. Es virtual y gratuito.
4. Como recibo el codigo? -> Por mensaje privado en la compra.
5. Aceptan tarjeta? -> Aceptamos todos los medios de pago habilitados por ML.
6. Me ayudan a canjearlo? -> Si, te guiamos paso a paso.

REGLAS:
- Responde SIEMPRE en espanol argentino (vos, tenes, podes, etc.)
- Maximo 2000 caracteres
- Se amable, profesional y conciso
- SIEMPRE inicia con "Gracias por tu consulta."
- SIEMPRE termina con "Aguardamos tu compra. Saludos, somos Roblox Argentina."
- Usa EXCLUSIVAMENTE la informacion del catalogo de arriba para responder
- NUNCA inventes informacion que no este en el catalogo
- NO uses emojis, NO uses markdown ni asteriscos
- Responde en texto plano

REGLA CRITICA:
Si la pregunta NO esta relacionada con los productos del catalogo, o no la entendes,
o no tenes informacion suficiente para responderla con certeza,
responde UNICAMENTE con la palabra: NO_RESPONDER
No agregues nada mas en ese caso.`;

/**
 * Split a long message into chunks of max 350 characters, breaking at sentence boundaries.
 */
export function splitMessageIntoChunks(text: string, maxLength = 350): string[] {
  if (text.length <= maxLength) return [text];

  const chunks: string[] = [];
  const sentences = text.split(/(?<=[.!?])\s+/);
  
  let currentChunk = "";
  
  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length + 1 <= maxLength) {
      currentChunk += (currentChunk ? " " : "") + sentence;
    } else {
      if (currentChunk) chunks.push(currentChunk.trim());
      
      // Si la sentencia sola es más larga que maxLength, dividir por palabras
      if (sentence.length > maxLength) {
        const words = sentence.split(" ");
        currentChunk = "";
        for (const word of words) {
          if (currentChunk.length + word.length + 1 <= maxLength) {
            currentChunk += (currentChunk ? " " : "") + word;
          } else {
            if (currentChunk) chunks.push(currentChunk.trim());
            currentChunk = word;
          }
        }
      } else {
        currentChunk = sentence;
      }
    }
  }
  
  if (currentChunk) chunks.push(currentChunk.trim());
  
  return chunks;
}

/**
 * Generate a conversational chat response with context awareness.
 * Used for natural back-and-forth conversation during the order flow.
 * Returns null if AI cannot help (triggers human intervention).
 */
export async function generateChatResponse(
  buyerMessage: string,
  productTitle: string,
  conversationContext?: string
): Promise<string[] | null> {
  try {
    const contextInfo = conversationContext 
      ? `\nContexto de la conversacion: ${conversationContext}` 
      : "";

    const userPrompt = `Producto comprado: ${productTitle}${contextInfo}

Comprador dice: "${buyerMessage}"

Responde de manera natural y conversacional. Analiza lo que dice y responde con sentido.
Si no podes ayudar, responde SOLO: NO_RESPONDER
Si pide hablar con una persona, responde SOLO: HUMANO_SOLICITADO`;

    const { text } = await generateText({
      model: "openai/gpt-4o-mini" as never,
      system: CHAT_SYSTEM_PROMPT,
      prompt: userPrompt,
      maxTokens: 300,
    });

    const trimmed = text.trim();

    // Check for special responses
    if (trimmed === "NO_RESPONDER" || trimmed.startsWith("NO_RESPONDER")) {
      return null;
    }
    
    if (trimmed === "HUMANO_SOLICITADO" || trimmed.startsWith("HUMANO_SOLICITADO")) {
      return null; // Will trigger human handoff in calling code
    }

    // Split response into 350-char chunks
    return splitMessageIntoChunks(trimmed);
  } catch (err) {
    console.log("[v0] AI chat response error:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Generate a question response using GPT (for pre-sale questions).
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
      system: QUESTION_SYSTEM_PROMPT,
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

