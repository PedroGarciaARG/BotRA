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

const BRAND_FOOTER_PARTS = [
  `❗Ya tenés tu Gift Card Digital Roblox! Que la disfrutes! Te pedimos que en cuanto recibas la tarjeta, confirmes en ML para que podamos seguir trabajando!`,
  `Quedamos a tu disposición! 🤝 Somos Roblox_Argentina_ok`,
  `❕Te dejamos nuestro contacto para que puedas agendarnos y aprovechar nuestras promos. 1138201597📱`
];

// For backward compatibility
const BRAND_FOOTER = BRAND_FOOTER_PARTS;

export const PRODUCTS: ProductConfig[] = [
  {
    key: "roblox-10",
    label: "Roblox 10 USD",
    sheetName: "roblox-10",
    keywords: ["roblox", "10", "usd", "dolar"],
    instructions: [
      `Te cuento... La Gift Card que adquiriste se activa en 2 pasos.`,
      
      `- Primero vas a canjear el codigo por 10 usd (dolares) -no aparecen automaticamente los Robux, sino los 10 usd-`,
      
      `- Luego, con esos 10 USD te vas a suscribir al Premium de 9.99 USD y en ese momento se van a acreditar los Robux 800 + 200.`,
      
      `🔑 COMO CANJEAR?

1️⃣ Ingresa a www.roblox.com/redeem (desde un navegador, NO desde la app)`,

      `2️⃣ Inicia sesion en tu cuenta (si no te pide iniciar sesion es que ya existe una cuenta abierta *asegurate que sea la tuya*)`,
      
      `3️⃣ Ingresa el codigo
4️⃣ Ya tenes los 10 usd!`,

      `Una vez que tenes los 10 USD cargados.
Ahora anda a:

https://www.roblox.com/premium/membership`,

      `Elegi el plan Premium de USD 9.99.

Cuando te pide forma de pago, te va a aparecer:
✔ Pagar con credito de Roblox`,

      `NO HAY QUE VOLVER A PONER EL CODIGO. 
Si, SE DEBE COMPLETAR EL E-MAIL DE FACTURACION`,
      
      `IR HASTA ABAJO Y APRETAR EL BOTON DE SUSCRIBIRSE.`,

      `Ya te enviamos la Gift Card`,
    ],
    codeMessage: (code, title) => {
      const img = `IMG-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-WA0000.jpeg`;
      return `${img}\n\n`;
    },
    finalMessage: BRAND_FOOTER_PARTS,
  },
  {
    key: "roblox-400",
    label: "Roblox 400 Robux",
    sheetName: "roblox-400",
    keywords: ["roblox", "400", "robux"],
    instructions: [
      `🔑 COMO CANJEAR?

1️⃣ Ingresa a www.roblox.com/redeem (desde un navegador, NO desde la app)`,

      `2️⃣ Inicia sesion en tu cuenta (si no te pide iniciar sesion es que ya existe una cuenta abierta *asegurate que sea la tuya*)`,
      
      `3️⃣ Ingresa el codigo
4️⃣ Disfruta tus Robux!`,

      `Ya te enviamos la Gift Card`,
    ],
    codeMessage: (code, title) => {
      const img = `IMG-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-WA0000.jpeg`;
      return `${img}\n\n`;
    },
    finalMessage: BRAND_FOOTER_PARTS,
  },
  {
    key: "roblox-800",
    label: "Roblox 800 Robux",
    sheetName: "roblox-800",
    keywords: ["roblox", "800", "robux"],
    instructions: [
      `🔑 COMO CANJEAR?

1️⃣ Ingresa a www.roblox.com/redeem (desde un navegador, NO desde la app)`,

      `2️⃣ Inicia sesion en tu cuenta (si no te pide iniciar sesion es que ya existe una cuenta abierta *asegurate que sea la tuya*)`,
      
      `3️⃣ Ingresa el codigo
4️⃣ Disfruta tus Robux!`,

      `Ya te enviamos la Gift Card`,
    ],
    codeMessage: (code, title) => {
      const img = `IMG-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-WA0000.jpeg`;
      return `${img}\n\n`;
    },
    finalMessage: BRAND_FOOTER_PARTS,
  },
  {
    key: "steam-5",
    label: "Steam 5 USD",
    sheetName: "steam-5",
    keywords: ["steam", "5", "usd", "dolar"],
    instructions: [
      `🔑 COMO CANJEAR?

1️⃣ Ingresa a https://store.steampowered.com/account/redeemwalletcode?l=latam`,

      `2️⃣ Inicia sesion en tu cuenta`,
      
      `3️⃣ Ingresa el codigo de la tarjeta
4️⃣ Disfruta tu saldo!`,

      `Ya te enviamos la Gift Card`,
    ],
    codeMessage: (code, title) => {
      const img = `IMG-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-WA0000.jpeg`;
      return `${img}\n\n`;
    },
    finalMessage: [
      `❗Ya tenes tu Gift Card *Steam* Que la disfrutes! Te pedimos que en cuanto recibas la tarjeta, confirmes en ML para que podamos seguir trabajando!`,
      `Quedamos a tu disposición! 🤝 Somos Roblox_Argentina_ok`,
      `❕Te dejamos nuestro contacto para que puedas agendarnos y aprovechar nuestras promos. 1138201597📱`
    ],
  },
  {
    key: "steam-10",
    label: "Steam 10 USD",
    sheetName: "steam-10",
    keywords: ["steam", "10", "usd", "dolar"],
    instructions: [
      `🔑 COMO CANJEAR?

1️⃣ Ingresa a https://store.steampowered.com/account/redeemwalletcode?l=latam`,

      `2️⃣ Inicia sesion en tu cuenta`,
      
      `3️⃣ Ingresa el codigo de la tarjeta
4️⃣ Disfruta tu saldo!`,

      `Ya te enviamos la Gift Card`,
    ],
    codeMessage: (code, title) => {
      const img = `IMG-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-WA0000.jpeg`;
      return `${img}\n\n`;
    },
    finalMessage: [
      `❗Ya tenes tu Gift Card *Steam* Que la disfrutes! Te pedimos que en cuanto recibas la tarjeta, confirmes en ML para que podamos seguir trabajando!`,
      `Quedamos a tu disposición! 🤝 Somos Roblox_Argentina_ok`,
      `❕Te dejamos nuestro contacto para que puedas agendarnos y aprovechar nuestras promos. 1138201597📱`
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

// Initial welcome message - Direct greeting that leads into asking about experience
export const WELCOME_MESSAGE = [
  `Hola! Gracias por tu compra en Roblox Argentina. Tenes experiencia cargando Gift Card?`,
];

// Simple thank you response (when buyer says thanks after receiving code)
export const THANKS_RESPONSE = `A vos por tu compra!`;
export const THANKS_RESPONSE_ALT = `Muchas gracias por tu compra!`;

// Cancellation instructions (rarely used, only if explicitly requested)
export const CANCEL_MESSAGE = `Entendemos tu decision. Para cancelar la compra anda a "Mis Compras" en Mercado Libre, selecciona esta compra y hace click en "Cancelar compra". ML te reintegrara el dinero automaticamente.`;

// Reminder when waiting for "LISTO" (simplified, no mention of human)
export const REMINDER_MESSAGE = `Responde "LISTO" cuando estes listo para recibir tu codigo.`;

// =====================================================================
// Question response catalog – comprehensive Q&A for all gift cards.
// Each entry uses broad keyword arrays so diverse phrasings still match.
// Responses always open with greeting and close with sign-off.
//
// IMPORTANT: Keywords are matched as substrings of the lowercased question.
// Keep keywords SHORT and COMMON so natural phrasing like "como es el envio"
// or "hay stock" gets caught even without exact phrase matches.
// =====================================================================

const GREETING = "Gracias por tu consulta.";
const CLOSING = "Aguardamos tu compra. Saludos, somos Roblox Argentina.";

export const QUESTION_RESPONSES: Array<{
  keywords: string[];
  productHints?: string[];
  response: string;
}> = [

  // =================================================================
  //  ROBLOX 400 & 800 ROBUX  (general questions apply to all products)
  // =================================================================

  // 1. Envio fisico o digital
  {
    keywords: [
      "envio", "envío", "como llega", "cómo llega",
      "es digital", "es fisico", "es físico", "fisico o digital", "físico o digital",
      "como es el", "cómo es el", "tipo de envio", "tipo de envío",
      "forma de envio", "forma de envío",
      "mandan algo", "mandan a domicilio", "llega a mi casa",
      "tarjeta fisica", "tarjeta física",
      "me lo traen", "por correo",
    ],
    response: `${GREETING} Es digital. Recibis una tarjeta digital con el codigo por chat privado una vez acreditado el pago. No se realiza envio fisico. ${CLOSING}`,
  },

  // 2. Cuanto tarda
  {
    keywords: [
      "cuanto tarda", "cuánto tarda", "cuanto demora", "cuánto demora",
      "tarda", "demora", "cuando llega", "cuándo llega",
      "inmediato", "instantaneo", "instantáneo", "rapido", "rápido",
      "al toque", "cuanto tiempo", "cuánto tiempo",
      "tiempo de entrega", "cuando lo recibo", "cuándo lo recibo",
    ],
    response: `${GREETING} El envio es inmediato luego de acreditado el pago. ${CLOSING}`,
  },

  // 3. Costo de envio
  {
    keywords: [
      "costo de envio", "costo de envío", "costo del envio", "costo del envío",
      "envio gratis", "envío gratis", "gratis",
      "tiene costo", "cobran envio", "cobran envío",
      "cuanto sale el envio", "es gratis", "pago envio", "se paga envio",
    ],
    response: `${GREETING} No. El envio es 100% gratuito porque es virtual. ${CLOSING}`,
  },

  // 4. Item exclusivo 400 Robux
  {
    keywords: [
      "item", "ítem", "exclusivo", "accesorio", "objeto",
      "trae item", "incluye item", "viene con item",
    ],
    productHints: ["400"],
    response: `${GREETING} No. Las tarjetas de 400 Robux NO incluyen item. Los items exclusivos vienen a partir de las tarjetas de 800 Robux. ${CLOSING}`,
  },

  // 4b. Item exclusivo 800 Robux
  {
    keywords: [
      "item", "ítem", "exclusivo", "accesorio", "objeto",
      "trae item", "incluye item", "viene con item",
    ],
    productHints: ["800"],
    response: `${GREETING} Si, la tarjeta de 800 Robux incluye un item exclusivo virtual. Se acredita automaticamente al canjear el codigo en www.roblox.com/redeem. ${CLOSING}`,
  },

  // 5. Donde se carga el codigo
  {
    keywords: [
      "donde se carga", "dónde se carga", "donde se canjea", "dónde se canjea",
      "como se canjea", "cómo se canjea", "como se carga", "cómo se carga",
      "como lo uso", "cómo lo uso", "donde lo pongo", "dónde lo pongo",
      "redeem", "canjear", "cargar el codigo", "como canjeo", "cómo canjeo",
    ],
    response: `${GREETING} Se canjea en la pagina oficial de Roblox, ingresando con tu usuario y contrasena en www.roblox.com/redeem. ${CLOSING}`,
  },

  // 5b. Donde se canjea Steam (product-specific)
  {
    keywords: [
      "donde se carga", "dónde se carga", "donde se canjea", "dónde se canjea",
      "como se canjea", "cómo se canjea", "como se carga", "cómo se carga",
      "como lo uso", "cómo lo uso", "canjear", "como canjeo", "cómo canjeo",
      "donde canjeo", "dónde canjeo", "como cargo", "cómo cargo",
    ],
    productHints: ["steam"],
    response: `${GREETING} Ingresa a store.steampowered.com/account/redeemwalletcode, inicia sesion en tu cuenta e ingresa el codigo de la tarjeta. Te guiamos paso a paso si lo necesitas. ${CLOSING}`,
  },

  // 6. Me ayudan a cargar
  {
    keywords: [
      "me ayudan", "ayudan a cargar", "ayudan a canjear", "me ayudas",
      "me explican", "paso a paso", "no se como", "no sé cómo",
      "no entiendo", "me guian", "me guían", "asistencia", "me acompanan",
    ],
    response: `${GREETING} Si, te guiamos paso a paso hasta que quede acreditado correctamente. ${CLOSING}`,
  },

  // 7. Puedo comprar para otra cuenta
  {
    keywords: [
      "otra cuenta", "para mi hijo", "para mi hija", "para otra persona",
      "para un amigo", "para regalo", "para regalar", "otra persona",
      "cualquier cuenta", "para otro", "para mi novia", "para mi novio",
    ],
    response: `${GREETING} Si, podes comprar para cualquier cuenta. ${CLOSING}`,
  },

  // 8. Vigencia / cuanto tiempo para canjearlo
  {
    keywords: [
      "vigencia", "vence", "vencimiento", "expira", "caduca",
      "cuanto tiempo tengo", "cuánto tiempo tengo", "plazo",
      "cuanto dura", "cuánto dura", "fecha de vencimiento",
    ],
    response: `${GREETING} El codigo tiene 3 meses de vigencia. Si no se canjea en ese plazo, expira. ${CLOSING}`,
  },

  // 9. Personalizar para regalo
  {
    keywords: [
      "personalizar", "personalizada", "dedicatoria",
      "con nombre", "regalo personalizado", "para regalo",
    ],
    response: `${GREETING} Si, podemos personalizar la tarjeta digital con el nombre que nos indiques. ${CLOSING}`,
  },

  // 10. Envios a provincia / interior
  {
    keywords: [
      "mi provincia", "interior", "todo el pais", "todo el país",
      "zona", "llega a", "envian a", "envían a", "cobertura",
    ],
    response: `${GREETING} Si, como es digital funciona en todo el pais y no tiene costo adicional. ${CLOSING}`,
  },

  // =================================================================
  //  ROBLOX 10 USD – preguntas especificas
  // =================================================================

  // 1. Cuantos Robux son 10 USD
  {
    keywords: [
      "cuantos robux", "cuántos robux", "robux son", "robux trae",
      "robux incluye", "equivale", "cuantos dan", "cuántos dan",
    ],
    productHints: ["10 usd", "10usd", "10 dolar", "dolar", "10"],
    response: `${GREETING} La tarjeta acredita 10 USD en tu cuenta. Con ese saldo podes comprar 1000 Robux o contratar Premium y recibir 1000 Robux. ${CLOSING}`,
  },

  // 2. Acredita Robux directamente?
  {
    keywords: [
      "acredita robux", "da robux", "carga robux", "robux directo",
      "robux directamente", "acredita directo", "son robux",
    ],
    productHints: ["10 usd", "10usd", "10 dolar", "dolar"],
    response: `${GREETING} No. Primero se acreditan 10 USD y luego elegis que comprar: 1000 Robux o el plan Premium. ${CLOSING}`,
  },

  // 3. Sirve para cualquier pais
  {
    keywords: [
      "cualquier pais", "cualquier país", "region", "región",
      "global", "internacional", "funciona en", "sirve en",
    ],
    productHints: ["10 usd", "10usd", "roblox", "dolar"],
    response: `${GREETING} Si, es region global. Funciona en cualquier parte del mundo. ${CLOSING}`,
  },

  // 4. Premium Argentina
  {
    keywords: [
      "premium", "pagar premium", "suscripcion", "suscripción",
      "premium argentina", "contratar premium",
    ],
    response: `${GREETING} Si, justamente se usa para eso. Cuando la app no permite pagar Premium por region, con la Gift Card de 10 USD podes contratarlo sin problema. ${CLOSING}`,
  },

  // 5. Envio inmediato (10 USD)
  // Already covered by general "cuanto tarda" entry

  // 6. Tarjeta fisica (10 USD)
  // Already covered by general "envio" entry

  // 7. Donde me llega el codigo
  {
    keywords: [
      "donde me llega", "dónde me llega", "donde llega", "dónde llega",
      "por donde", "por dónde", "chat privado",
      "como recibo", "cómo recibo", "como me llega", "cómo me llega",
      "donde lo recibo", "dónde lo recibo", "por donde llega", "por dónde llega",
      "por mensaje", "mensaje privado",
    ],
    response: `${GREETING} El codigo te llega por chat privado de Mercado Libre una vez acreditado el pago. ${CLOSING}`,
  },

  // 8. Enviar como regalo (10 USD)
  // Already covered by "personalizar" entry

  // 9. Cuanto tiempo para usarla (10 USD)
  // Already covered by "vigencia" entry

  // 10. Me ayudan a cargarla (10 USD)
  // Already covered by "me ayudan" entry

  // =================================================================
  //  STEAM 5 & 10 USD
  // =================================================================

  // 4. Como recibo el codigo (Steam)
  // Covered by "donde me llega" entry

  // 5. Aceptan tarjeta / medios de pago
  {
    keywords: [
      "medios de pago", "como pago", "cómo pago",
      "aceptan tarjeta", "tarjeta de credito", "tarjeta de débito",
      "debito", "débito", "credito", "crédito",
      "transferencia", "efectivo", "formas de pago", "aceptan",
    ],
    response: `${GREETING} Aceptamos todos los medios de pago habilitados por Mercado Libre. ${CLOSING}`,
  },

  // 6. Me ayudan a canjearlo (Steam)
  // Covered by general "me ayudan" entry

  // =================================================================
  //  EXTRAS (comunes en ML)
  // =================================================================

  // Stock
  {
    keywords: [
      "stock", "disponible", "hay stock", "tenes", "tienen",
      "queda", "quedan", "disponibilidad", "hay unidades",
      "tenes stock", "tienen stock", "hay disponible",
    ],
    response: `${GREETING} Si, tenemos stock disponible. La entrega es digital e instantanea. ${CLOSING}`,
  },

  // Seguridad
  {
    keywords: [
      "seguro", "confiable", "es seguro", "estafa", "trucho",
      "original", "garantia", "garantía",
    ],
    response: `${GREETING} Si, la compra es 100% segura y esta protegida por Mercado Libre. Todos los codigos se verifican antes de enviarse. ${CLOSING}`,
  },

  // Codigo no funciona
  {
    keywords: [
      "no funciona", "no me sirve", "codigo invalido", "código inválido",
      "no anda", "no me deja", "problema con el codigo",
    ],
    response: `${GREETING} Todos los codigos se verifican antes de enviarse. En caso de algun inconveniente, escribinos por el chat de la compra y te ayudamos de inmediato. ${CLOSING}`,
  },

  // Cuotas
  {
    keywords: ["cuotas", "en cuotas", "financiacion", "financiación"],
    response: `${GREETING} Si, podes abonar en cuotas si Mercado Libre lo habilita con tu tarjeta. ${CLOSING}`,
  },

  // Comprobante
  {
    keywords: ["comprobante", "factura", "recibo", "ticket", "boleta"],
    response: `${GREETING} No es necesario enviar comprobante. Una vez acreditado el pago enviamos el codigo automaticamente por el chat. ${CLOSING}`,
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
