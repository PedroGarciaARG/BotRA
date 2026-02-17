// Product configuration: types, instructions, and message templates.
// Messages are split into chunks of <=350 chars for ML post-sale messaging limit.

export interface ProductConfig {
  key: string;
  label: string;
  sheetName: string; // Tab name in Google Sheets
  keywords: string[]; // Keywords to match from item title
  instructions: string[]; // Split into <=350 char messages
  codeMessage: (code: string, title: string) => string; // Code delivery message
  finalMessage: string[];
}

const BRAND_FOOTER = `Quedamos a tu disposicion! Somos Roblox Argentina. Te dejamos nuestro contacto para que puedas agendarnos y aprovechar nuestras promos: 1138201597`;

export const PRODUCTS: ProductConfig[] = [
  {
    key: "roblox-10",
    label: "Roblox 10 USD",
    sheetName: "roblox-10",
    keywords: ["roblox", "10", "usd", "dolar"],
    instructions: [
      `COMO CANJEAR GIFT CARD ROBLOX 10 USD

Tene presente que es imprescindible recordar usuario y contrasena.
IMPORTANTE: Esta tarjeta NO acredita Robux de manera directa, sino que acredita 10 USD y con ese saldo se compran los Robux.

PASO A PASO:
1. Ingresa a www.roblox.com/redeem (desde un navegador, NO desde la app)
2. Inicia sesion en tu cuenta (asegurate que sea la tuya)
3. Ingresa el codigo
4. Ya tenes tus 10 USD!`,

      `UNA VEZ QUE TENES LOS 10 USD CARGADOS:
5. Anda a: www.roblox.com/premium/membership
6. Elegi el plan Premium de USD 9.99
7. Cuando te pide forma de pago, te va a aparecer "Pagar con credito de Roblox"
8. NO hay que volver a poner el codigo
9. Completa el e-mail de facturacion
10. Apreta el boton de SUSCRIBIRSE

Estas listo para recibir tu codigo? Responde "LISTO" y te lo enviamos.`,
    ],
    codeMessage: (code, title) =>
      `${title || "Gift Card Roblox 10 USD"}\nTu codigo: ${code}\n\nCanjealo en: www.roblox.com/redeem`,
    finalMessage: [
      `Ya tenes tu Gift Card Digital Roblox! Que la disfrutes! Te pedimos que en cuanto la recibas, confirmes en ML para que podamos seguir trabajando. ${BRAND_FOOTER}`,
    ],
  },
  {
    key: "roblox-400",
    label: "Roblox 400 Robux",
    sheetName: "roblox-400",
    keywords: ["roblox", "400", "robux"],
    instructions: [
      `COMO CANJEAR GIFT CARD 400 ROBUX

1. Ingresa a www.roblox.com/redeem (desde un navegador, NO desde la app)
2. Inicia sesion en tu cuenta (asegurate que sea la tuya)
3. Ingresa el codigo
4. Ya tenes tus Robux!

Estas listo para recibir tu codigo? Responde "LISTO" y te lo enviamos.`,
    ],
    codeMessage: (code, title) =>
      `${title || "Gift Card 400 Robux"}\nTu codigo: ${code}\n\nCanjealo en: www.roblox.com/redeem`,
    finalMessage: [
      `Ya tenes tu Gift Card Digital Roblox! Que la disfrutes! Te pedimos que en cuanto la recibas, confirmes en ML para que podamos seguir trabajando. ${BRAND_FOOTER}`,
    ],
  },
  {
    key: "roblox-800",
    label: "Roblox 800 Robux",
    sheetName: "roblox-800",
    keywords: ["roblox", "800", "robux"],
    instructions: [
      `COMO CANJEAR GIFT CARD 800 ROBUX

1. Ingresa a www.roblox.com/redeem (desde un navegador, NO desde la app)
2. Inicia sesion en tu cuenta (asegurate que sea la tuya)
3. Ingresa el codigo
4. Ya tenes tus Robux!

Estas listo para recibir tu codigo? Responde "LISTO" y te lo enviamos.`,
    ],
    codeMessage: (code, title) =>
      `${title || "Gift Card 800 Robux"}\nTu codigo: ${code}\n\nCanjealo en: www.roblox.com/redeem`,
    finalMessage: [
      `Ya tenes tu Gift Card Digital Roblox! Que la disfrutes! Te pedimos que en cuanto la recibas, confirmes en ML para que podamos seguir trabajando. ${BRAND_FOOTER}`,
    ],
  },
  {
    key: "steam-5",
    label: "Steam 5 USD",
    sheetName: "steam-5",
    keywords: ["steam", "5", "usd", "dolar"],
    instructions: [
      `COMO CANJEAR GIFT CARD STEAM

1. Ingresa a store.steampowered.com/account/redeemwalletcode
2. Inicia sesion en tu cuenta
3. Ingresa el codigo de la tarjeta
4. Disfruta tu saldo!

Estas listo para recibir tu codigo? Responde "LISTO" y te lo enviamos.`,
    ],
    codeMessage: (code, title) =>
      `${title || "Gift Card Steam 5 USD"}\nTu codigo: ${code}\n\nCanjealo en: store.steampowered.com/account/redeemwalletcode`,
    finalMessage: [
      `Ya tenes tu Gift Card Steam! Que la disfrutes! Te pedimos que en cuanto la recibas, confirmes en ML para que podamos seguir trabajando. ${BRAND_FOOTER}`,
    ],
  },
  {
    key: "steam-10",
    label: "Steam 10 USD",
    sheetName: "steam-10",
    keywords: ["steam", "10", "usd", "dolar"],
    instructions: [
      `COMO CANJEAR GIFT CARD STEAM

1. Ingresa a store.steampowered.com/account/redeemwalletcode
2. Inicia sesion en tu cuenta
3. Ingresa el codigo de la tarjeta
4. Disfruta tu saldo!

Estas listo para recibir tu codigo? Responde "LISTO" y te lo enviamos.`,
    ],
    codeMessage: (code, title) =>
      `${title || "Gift Card Steam 10 USD"}\nTu codigo: ${code}\n\nCanjealo en: store.steampowered.com/account/redeemwalletcode`,
    finalMessage: [
      `Ya tenes tu Gift Card Steam! Que la disfrutes! Te pedimos que en cuanto la recibas, confirmes en ML para que podamos seguir trabajando. ${BRAND_FOOTER}`,
    ],
  },
];

/**
 * Detect product type from item title.
 * Matches using keyword scoring - product with most keyword hits wins.
 */
export function detectProductType(title: string): ProductConfig | null {
  const lower = title.toLowerCase();
  let bestMatch: ProductConfig | null = null;
  let bestScore = 0;

  for (const product of PRODUCTS) {
    const score = product.keywords.filter((kw) => lower.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = product;
    }
  }

  // Need at least 2 keyword matches to be confident
  return bestScore >= 2 ? bestMatch : null;
}

export function getProductByKey(key: string): ProductConfig | undefined {
  return PRODUCTS.find((p) => p.key === key);
}

// Initial welcome message (sent when order is paid)
// Consolidated into a single message to minimize message count (ML best practice)
export const WELCOME_MESSAGE = [
  `Hola! Gracias por tu compra en Roblox Argentina.

Tu Gift Card es 100% digital. El codigo se entrega por este chat de forma instantanea y el envio es gratuito.

Por favor responde con una de estas opciones:
- "SI" para recibir tu codigo ahora
- "NO" si queres cancelar la compra
- "HUMANO" si necesitas hablar con una persona

Tu codigo esta listo, solo esperamos tu confirmacion.`,
];

// Cancellation instructions
export const CANCEL_MESSAGE = `Entendemos tu decision. Para cancelar la compra anda a "Mis Compras" en Mercado Libre, selecciona esta compra y hace click en "Cancelar compra". ML te reintegrara el dinero automaticamente. Si necesitas ayuda responde "AYUDA".`;

// Human handoff message
export const HUMAN_MESSAGE = `Te conectamos con un asesor humano. Un vendedor te respondera a la brevedad. Mientras tanto, por favor detallanos tu consulta.`;

// Unrecognized response reminder
export const REMINDER_MESSAGE = `No entendi tu respuesta. Por favor responde con: "SI" para recibir tu codigo, "NO" para cancelar, o "HUMANO" para hablar con una persona.`;

// =====================================================================
// Question response catalog – comprehensive Q&A for all gift cards.
// Each entry has broad keyword arrays so diverse phrasings still match.
// Responses always open with "Gracias por tu consulta" and close with
// "Aguardamos tu compra. Saludos, somos Roblox Argentina."
// =====================================================================

const GREETING = "Gracias por tu consulta.";
const CLOSING = "Aguardamos tu compra. Saludos, somos Roblox Argentina.";

export const QUESTION_RESPONSES: Array<{
  keywords: string[];
  /** Extra condition: question must also contain one of these product hints.
   *  Leave empty to match any product. */
  productHints?: string[];
  response: string;
}> = [
  // ---- GENERAL (applies to any product) ----

  // Envio fisico o digital
  {
    keywords: [
      "envio fisico", "envío físico", "envio digital", "envío digital",
      "fisico o digital", "físico o digital", "como llega", "cómo llega",
      "como lo envian", "cómo lo envían", "es fisico", "es físico",
      "es digital", "mandan algo", "llega algo", "llega a mi casa",
      "mandan a domicilio", "es por correo", "viene por correo",
      "me lo traen", "me llega a casa", "tarjeta fisica", "tarjeta física",
    ],
    response: `${GREETING} Es digital. Recibis una tarjeta digital con el codigo por chat privado una vez acreditado el pago. No se realiza envio fisico. ${CLOSING}`,
  },

  // Tiempo de entrega
  {
    keywords: [
      "cuanto tarda", "cuánto tarda", "cuanto demora", "cuánto demora",
      "demora", "tarda mucho", "cuando llega", "cuándo llega",
      "es inmediato", "es instantaneo", "es instantáneo", "en cuanto lo tengo",
      "rapido", "rápido", "al toque",
    ],
    response: `${GREETING} El envio es inmediato luego de acreditado el pago. Recibis el codigo por el chat oficial de la compra. ${CLOSING}`,
  },

  // Costo de envio
  {
    keywords: [
      "costo de envio", "costo de envío", "envio gratis", "envío gratis",
      "tiene envio", "tiene envío", "cobran envio", "cobran envío",
      "precio del envio", "cuanto sale el envio", "cuesta el envio",
      "gratis",
    ],
    response: `${GREETING} No tiene costo de envio. El envio es 100% gratuito porque es virtual. ${CLOSING}`,
  },

  // Donde se carga / canjea el codigo
  {
    keywords: [
      "donde se carga", "dónde se carga", "donde se canjea", "dónde se canjea",
      "como se canjea", "cómo se canjea", "como se carga", "cómo se carga",
      "como lo uso", "cómo lo uso", "donde lo pongo", "dónde lo pongo",
      "como redimirlo", "cómo redimirlo", "redeem", "canjear",
    ],
    response: `${GREETING} Se canjea en la pagina oficial del juego correspondiente, ingresando con tu usuario y contrasena. Si es Roblox: www.roblox.com/redeem. Si es Steam: store.steampowered.com/account/redeemwalletcode. Te guiamos paso a paso si lo necesitas. ${CLOSING}`,
  },

  // Ayuda a cargar
  {
    keywords: [
      "me ayudan", "ayudan a cargar", "ayudan a canjear",
      "me explican", "paso a paso", "no se como", "no sé cómo",
      "no entiendo", "me guian", "me guían", "asistencia",
    ],
    response: `${GREETING} Si, te guiamos paso a paso hasta que quede acreditado correctamente. Una vez realizada la compra, escribinos por el chat y te asistimos. ${CLOSING}`,
  },

  // Comprar para otra cuenta
  {
    keywords: [
      "otra cuenta", "para mi hijo", "para mi hija", "para otra persona",
      "para un amigo", "para regalo", "para regalar", "otra persona",
      "cualquier cuenta", "para otro",
    ],
    response: `${GREETING} Si, podes comprar para cualquier cuenta. Solo necesitas saber el usuario al momento de canjear el codigo. ${CLOSING}`,
  },

  // Vigencia del codigo
  {
    keywords: [
      "vigencia", "vence", "vencimiento", "expira", "caduca",
      "cuanto tiempo tengo", "cuánto tiempo tengo", "plazo",
      "fecha de vencimiento", "cuanto dura", "cuánto dura",
    ],
    response: `${GREETING} El codigo tiene 3 meses de vigencia. Si no se canjea en ese plazo, expira. Te recomendamos canjearlo lo antes posible. ${CLOSING}`,
  },

  // Personalizar para regalo
  {
    keywords: [
      "personalizar", "personalizada", "nombre", "dedicatoria",
      "con nombre", "tarjeta de regalo", "para regalo personalizado",
    ],
    response: `${GREETING} Si, podemos personalizar la tarjeta digital con el nombre que nos indiques. Avisanos luego de la compra por el chat. ${CLOSING}`,
  },

  // Envio a provincia
  {
    keywords: [
      "mi provincia", "interior", "todo el pais", "todo el país",
      "zona", "llega a", "envian a", "envían a", "cobertura",
    ],
    response: `${GREETING} Si, como es digital funciona en todo el pais y no tiene costo adicional. ${CLOSING}`,
  },

  // Medios de pago
  {
    keywords: [
      "medios de pago", "como pago", "cómo pago", "pagar",
      "tarjeta", "debito", "débito", "credito", "crédito",
      "transferencia", "efectivo", "aceptan", "formas de pago",
    ],
    response: `${GREETING} Aceptamos todos los medios de pago habilitados por Mercado Libre: tarjeta de credito, debito, transferencia y saldo en cuenta. ${CLOSING}`,
  },

  // Cuotas
  {
    keywords: ["cuotas", "en cuotas", "pago en cuotas", "financiacion", "financiación"],
    response: `${GREETING} Si, si Mercado Libre habilita cuotas con tu tarjeta podras abonar en cuotas sin problema. La entrega es instantanea al acreditarse el pago. ${CLOSING}`,
  },

  // Seguridad / confiable
  {
    keywords: [
      "seguro", "confiable", "es seguro", "estafa", "trucho",
      "original", "garantia", "garantía", "proteccion", "protección",
    ],
    response: `${GREETING} Si, la compra es 100% segura y esta protegida por Mercado Libre. Todos los codigos se verifican antes de enviarse. ${CLOSING}`,
  },

  // Codigo no funciona
  {
    keywords: [
      "no funciona", "no me sirve", "codigo invalido", "código inválido",
      "problema", "error", "no anda", "no me deja",
    ],
    response: `${GREETING} Todos los codigos se verifican antes de enviarse. En caso de algun inconveniente, podes escribirnos por el chat para ayudarte de inmediato. ${CLOSING}`,
  },

  // Stock / disponibilidad
  {
    keywords: [
      "stock", "disponible", "hay", "tenes", "tienen", "queda",
      "quedan", "disponibilidad", "ultima unidad", "última unidad",
    ],
    response: `${GREETING} Si, tenemos stock disponible. La entrega es digital e instantanea por el chat de Mercado Libre una vez acreditado el pago. ${CLOSING}`,
  },

  // Comprobante
  {
    keywords: ["comprobante", "factura", "recibo", "ticket", "boleta"],
    response: `${GREETING} No es necesario enviar comprobante. Una vez que Mercado Libre acredita el pago, enviamos el codigo de manera instantanea por el chat. ${CLOSING}`,
  },

  // ---- ROBLOX 400 / 800 ROBUX SPECIFIC ----

  // Item exclusivo 400 Robux
  {
    keywords: [
      "item exclusivo", "ítem exclusivo", "trae item", "incluye item",
      "viene con item", "item virtual", "accesorio", "objeto exclusivo",
    ],
    productHints: ["400"],
    response: `${GREETING} Las tarjetas de 400 Robux NO incluyen item exclusivo. Los items exclusivos vienen a partir de las tarjetas de 800 Robux. ${CLOSING}`,
  },

  // Item exclusivo 800 Robux
  {
    keywords: [
      "item exclusivo", "ítem exclusivo", "trae item", "incluye item",
      "viene con item", "item virtual", "accesorio", "objeto exclusivo",
    ],
    productHints: ["800"],
    response: `${GREETING} Si, la tarjeta de 800 Robux incluye un item exclusivo virtual. Se acredita automaticamente al canjear el codigo en www.roblox.com/redeem. ${CLOSING}`,
  },

  // ---- ROBLOX 10 USD SPECIFIC ----

  // Cuantos Robux son 10 USD
  {
    keywords: [
      "cuantos robux", "cuántos robux", "robux son", "robux trae",
      "robux incluye", "equivale a robux", "cuantos dan", "cuántos dan",
    ],
    productHints: ["10 usd", "10usd", "10 dolar", "dolar"],
    response: `${GREETING} La tarjeta acredita 10 USD en tu cuenta. Con ese saldo podes comprar 1000 Robux o contratar Premium y recibir 1000 Robux. No acredita Robux directamente, primero se acreditan 10 USD y luego elegis que comprar. ${CLOSING}`,
  },

  // Acredita Robux directamente?
  {
    keywords: [
      "acredita robux", "da robux", "carga robux", "robux directo",
      "robux directamente", "acredita directo",
    ],
    productHints: ["10 usd", "10usd", "10 dolar", "dolar"],
    response: `${GREETING} No, primero se acreditan 10 USD en tu cuenta y luego elegis que comprar: 1000 Robux o el plan Premium. ${CLOSING}`,
  },

  // Sirve para cualquier pais (Roblox 10 USD)
  {
    keywords: [
      "cualquier pais", "cualquier país", "region", "región",
      "global", "internacional", "funciona en",
    ],
    productHints: ["10 usd", "10usd", "roblox", "dolar"],
    response: `${GREETING} Si, es region global. Funciona en cualquier parte del mundo sin restricciones. ${CLOSING}`,
  },

  // Premium Argentina (Roblox 10 USD)
  {
    keywords: [
      "premium", "pagar premium", "suscripcion", "suscripción",
      "premium argentina", "contratar premium",
    ],
    response: `${GREETING} Si, justamente se usa para eso. Cuando la app no permite pagar Premium por region, con la Gift Card de 10 USD podes contratarlo sin problema desde www.roblox.com/premium/membership. ${CLOSING}`,
  },

  // ---- STEAM SPECIFIC ----

  // Como se canjea Steam
  {
    keywords: [
      "como canjeo", "cómo canjeo", "donde canjeo", "dónde canjeo",
      "como cargo", "cómo cargo",
    ],
    productHints: ["steam"],
    response: `${GREETING} Ingresa a https://store.steampowered.com/account/redeemwalletcode, inicia sesion en tu cuenta e ingresa el codigo de la tarjeta. Te guiamos paso a paso si lo necesitas. ${CLOSING}`,
  },

  // Steam recibo / donde llega
  {
    keywords: [
      "donde me llega", "dónde me llega", "por donde", "por dónde",
      "chat privado", "como recibo", "cómo recibo",
    ],
    response: `${GREETING} El codigo te llega por chat privado de Mercado Libre una vez acreditado el pago. ${CLOSING}`,
  },
];

/**
 * Find a matching predefined response for a question.
 * Uses a scoring system: more keyword hits = better match.
 * Supports productHints to give product-specific answers.
 * @param itemTitle optional – the ML listing title, used to resolve productHints
 */
export function findQuestionResponse(
  questionText: string,
  itemTitle?: string
): string | null {
  const lower = questionText.toLowerCase();
  const titleLower = (itemTitle || "").toLowerCase();
  const combinedContext = `${lower} ${titleLower}`;

  let bestMatch: (typeof QUESTION_RESPONSES)[number] | null = null;
  let bestScore = 0;

  for (const entry of QUESTION_RESPONSES) {
    // Count how many keywords match in the question
    const keywordHits = entry.keywords.filter((kw) => lower.includes(kw)).length;
    if (keywordHits === 0) continue;

    // If entry has productHints, at least one must match in question OR item title
    if (entry.productHints && entry.productHints.length > 0) {
      const hintMatch = entry.productHints.some((h) => combinedContext.includes(h));
      if (!hintMatch) continue;
      // Product-specific matches get a bonus score
    }

    // Score: keyword hits + bonus for product-specific matches
    const productBonus = entry.productHints?.length ? 2 : 0;
    const score = keywordHits + productBonus;

    if (score > bestScore) {
      bestScore = score;
      bestMatch = entry;
    }
  }

  return bestMatch ? bestMatch.response : null;
}
