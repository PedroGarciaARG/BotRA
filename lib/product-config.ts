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

const BRAND_FOOTER = `Quedamos a tu disposicion!

*Somos Roblox_Argentina_ok*

Te dejamos nuestro contacto para que puedas agendarnos y aprovechar nuestras promos: *1138201597*`;

export const PRODUCTS: ProductConfig[] = [
  {
    key: "roblox-10",
    label: "Roblox 10 USD",
    sheetName: "roblox-10",
    keywords: ["roblox", "10", "usd", "dolar"],
    instructions: [
      `*COMO CANJEAR GIFT CARD ROBLOX 10 USD?*

*Tene presente que es imprescindible recordar usuario y contrasena!*
IMPORTANTE: Esta tarjeta NO acredita Robux de manera directa, sino que acredita 10 USD y con ese saldo se compran los Robux.`,

      `*PASO A PASO:*

1. Ingresa a *www.roblox.com/redeem* (desde un navegador, NO desde la app)
2. Inicia sesion en tu cuenta (si no te pide iniciar sesion es que ya existe una cuenta abierta, *asegurate que sea la tuya*)
3. Ingresa el codigo
4. Ya tenes tus 10 USD!`,

      `*UNA VEZ QUE TENES LOS 10 USD CARGADOS:*

5. Anda a: *https://www.roblox.com/premium/membership*
6. Elegi el plan Premium de *USD 9.99*
7. Cuando te pide forma de pago, te va a aparecer: *"Pagar con credito de Roblox"*
8. *NO HAY QUE VOLVER A PONER EL CODIGO*`,

      `9. Completa el e-mail de facturacion
10. Anda hasta abajo y apreta el boton de *SUSCRIBIRSE*

Estas listo para recibir tu codigo? Responde *"LISTO"* y te lo enviamos.`,
    ],
    codeMessage: (code, title) =>
      `*${title || "Gift Card Roblox 10 USD"}*\n*${code}*\n\n*INSTRUCCIONES RAPIDAS:*\nwww.roblox.com/redeem`,
    finalMessage: [
      `*Ya tenes tu Gift Card Digital Roblox!* Que la disfrutes!

Te pedimos que en cuanto recibas la tarjeta, *confirmes en ML* para que podamos seguir trabajando!`,
      BRAND_FOOTER,
    ],
  },
  {
    key: "roblox-400",
    label: "Roblox 400 Robux",
    sheetName: "roblox-400",
    keywords: ["roblox", "400", "robux"],
    instructions: [
      `*COMO CANJEAR GIFT CARD 400 ROBUX?*

1. Ingresa a *www.roblox.com/redeem* (desde un navegador, NO desde la app)
2. Inicia sesion en tu cuenta (si no te pide iniciar sesion es que ya existe una cuenta abierta, *asegurate que sea la tuya*)
3. Ingresa el codigo
4. Ya tenes tus Robux!

Estas listo para recibir tu codigo? Responde *"LISTO"* y te lo enviamos.`,
    ],
    codeMessage: (code, title) =>
      `*${title || "Gift Card 400 Robux"}*\n*${code}*\n\n*INSTRUCCIONES RAPIDAS:*\nwww.roblox.com/redeem`,
    finalMessage: [
      `*Ya tenes tu Gift Card Digital Roblox!* Que la disfrutes!

Te pedimos que en cuanto recibas la tarjeta, *confirmes en ML* para que podamos seguir trabajando!`,
      BRAND_FOOTER,
    ],
  },
  {
    key: "roblox-800",
    label: "Roblox 800 Robux",
    sheetName: "roblox-800",
    keywords: ["roblox", "800", "robux"],
    instructions: [
      `*COMO CANJEAR GIFT CARD 800 ROBUX?*

1. Ingresa a *www.roblox.com/redeem* (desde un navegador, NO desde la app)
2. Inicia sesion en tu cuenta (si no te pide iniciar sesion es que ya existe una cuenta abierta, *asegurate que sea la tuya*)
3. Ingresa el codigo
4. Ya tenes tus Robux!

Estas listo para recibir tu codigo? Responde *"LISTO"* y te lo enviamos.`,
    ],
    codeMessage: (code, title) =>
      `*${title || "Gift Card 800 Robux"}*\n*${code}*\n\n*INSTRUCCIONES RAPIDAS:*\nwww.roblox.com/redeem`,
    finalMessage: [
      `*Ya tenes tu Gift Card Digital Roblox!* Que la disfrutes!

Te pedimos que en cuanto recibas la tarjeta, *confirmes en ML* para que podamos seguir trabajando!`,
      BRAND_FOOTER,
    ],
  },
  {
    key: "steam-5",
    label: "Steam 5 USD",
    sheetName: "steam-5",
    keywords: ["steam", "5", "usd", "dolar"],
    instructions: [
      `*COMO CANJEAR GIFT CARD STEAM?*

1. Ingresa a *https://store.steampowered.com/account/redeemwalletcode?l=latam*
2. Inicia sesion en tu cuenta
3. Ingresa el codigo de la tarjeta
4. Disfruta tu saldo!

Estas listo para recibir tu codigo? Responde *"LISTO"* y te lo enviamos.`,
    ],
    codeMessage: (code, title) =>
      `*${title || "Gift Card Steam 5 USD"}*\n*${code}*\n\n*INSTRUCCIONES RAPIDAS:*\nhttps://store.steampowered.com/account/redeemwalletcode`,
    finalMessage: [
      `*Ya tenes tu Gift Card Steam!* Que la disfrutes!

Te pedimos que en cuanto recibas la tarjeta, *confirmes en ML* para que podamos seguir trabajando!`,
      BRAND_FOOTER,
    ],
  },
  {
    key: "steam-10",
    label: "Steam 10 USD",
    sheetName: "steam-10",
    keywords: ["steam", "10", "usd", "dolar"],
    instructions: [
      `*COMO CANJEAR GIFT CARD STEAM?*

1. Ingresa a *https://store.steampowered.com/account/redeemwalletcode?l=latam*
2. Inicia sesion en tu cuenta
3. Ingresa el codigo de la tarjeta
4. Disfruta tu saldo!

Estas listo para recibir tu codigo? Responde *"LISTO"* y te lo enviamos.`,
    ],
    codeMessage: (code, title) =>
      `*${title || "Gift Card Steam 10 USD"}*\n*${code}*\n\n*INSTRUCCIONES RAPIDAS:*\nhttps://store.steampowered.com/account/redeemwalletcode`,
    finalMessage: [
      `*Ya tenes tu Gift Card Steam!* Que la disfrutes!

Te pedimos que en cuanto recibas la tarjeta, *confirmes en ML* para que podamos seguir trabajando!`,
      BRAND_FOOTER,
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
export const WELCOME_MESSAGE = [
  `Gracias por tu compra en *Roblox Argentina*!

Has adquirido una *GIFT CARD VIRTUAL*
Es 100% digital - No hay envio fisico
El codigo se entrega INSTANTANEAMENTE por este chat
El envio es GRATIS por ser digital`,

  `*Por favor, RESPONDE ESTE MENSAJE con UNA de estas opciones:*

*"SI"* - Confirmar que entendes y queres recibir tu codigo YA
*"NO"* - Si te arrepentiste y queres cancelar la compra
*"HUMANO"* - Si necesitas hablar con una persona

*Tu codigo esta listo, solo esperamos tu confirmacion.*`,
];

// Cancellation instructions
export const CANCEL_MESSAGE = `Entendemos tu decision.

*Para cancelar la compra:*
1. Anda a *"Mis Compras"* en Mercado Libre
2. Selecciona esta compra
3. Hace click en *"Cancelar compra"*

Una vez cancelado, Mercado Libre te reintegrara el dinero automaticamente.

Si necesitas ayuda con la cancelacion, responde *"AYUDA"* y te asistiremos.`;

// Human handoff message
export const HUMAN_MESSAGE = `*Te conectamos con un asesor humano*

Un vendedor te respondera a la brevedad. Mientras tanto, por favor detallanos tu consulta.`;

// Unrecognized response reminder
export const REMINDER_MESSAGE = `*No entendi tu respuesta*

Por favor, responde con UNA de estas opciones:

*"SI"* - Para recibir tu codigo
*"NO"* - Para cancelar la compra
*"HUMANO"* - Para hablar con una persona

Que opcion elegis?`;

// Question response templates (for publication questions)
export const QUESTION_RESPONSES = [
  {
    keywords: ["envía", "envia", "gift card", "como llega", "cómo llega"],
    response:
      "Gracias por tu consulta. La Gift Card se envia de forma 100% digital a traves del chat de Mercado Libre una vez acreditado el pago. La entrega es instantanea y no se realiza envio fisico. Aguardamos tu compra. Somos Roblox Argentina.",
  },
  {
    keywords: ["cuánto tarda", "cuanto tarda", "entrega", "demora"],
    response:
      "Gracias por tu consulta. La entrega es instantanea una vez que Mercado Libre acredita el pago. Recibiras el codigo por el chat oficial de la compra. Aguardamos tu compra. Somos Roblox Argentina.",
  },
  {
    keywords: ["envío gratis", "envio gratis", "gratis"],
    response:
      "Gracias por tu consulta. Si, el envio es totalmente gratuito ya que la entrega es digital e instantanea por el chat de Mercado Libre. Aguardamos tu compra. Somos Roblox Argentina.",
  },
  {
    keywords: ["tarjeta física", "tarjeta fisica", "envío físico", "envio fisico", "domicilio"],
    response:
      "Gracias por tu consulta. No, esta publicacion corresponde a una Gift Card digital con entrega instantanea. No se envia tarjeta fisica por correo. Aguardamos tu compra. Somos Roblox Argentina.",
  },
  {
    keywords: ["medios de pago", "pagar", "como pago", "cómo pago"],
    response:
      "Gracias por tu consulta. Aceptamos todos los medios de pago habilitados por Mercado Libre: tarjeta de credito, debito, transferencia y saldo en cuenta. La entrega es instantanea. Aguardamos tu compra. Somos Roblox Argentina.",
  },
  {
    keywords: ["cuotas"],
    response:
      "Gracias por tu consulta. Si, si Mercado Libre habilita cuotas con tu tarjeta podras abonar en cuotas sin problema. La entrega es instantanea al acreditarse el pago. Aguardamos tu compra. Somos Roblox Argentina.",
  },
  {
    keywords: ["comprobante"],
    response:
      "Gracias por tu consulta. No es necesario enviar comprobante. Una vez que Mercado Libre acredita el pago, enviamos el codigo de manera instantanea por el chat. Aguardamos tu compra. Somos Roblox Argentina.",
  },
  {
    keywords: ["seguro comprar", "es seguro", "confiable"],
    response:
      "Gracias por tu consulta. Si, la compra es 100% segura y esta protegida por Mercado Libre. El codigo se envia de forma instantanea unicamente por el chat oficial de la plataforma. Aguardamos tu compra. Somos Roblox Argentina.",
  },
  {
    keywords: ["código no funciona", "codigo no funciona", "no funciona", "no me sirve"],
    response:
      "Gracias por tu consulta. Todos los codigos se verifican antes de enviarse. En caso de algun inconveniente, podes escribirnos por el chat para ayudarte de inmediato. Aguardamos tu compra. Somos Roblox Argentina.",
  },
  {
    keywords: ["stock", "disponible", "hay", "tenes", "tienen"],
    response:
      "Gracias por tu consulta. Si, tenemos stock disponible. La entrega es digital e instantanea por el chat de Mercado Libre una vez acreditado el pago. Aguardamos tu compra. Somos Roblox Argentina.",
  },
];

/**
 * Find a matching predefined response for a question.
 */
export function findQuestionResponse(questionText: string): string | null {
  const lower = questionText.toLowerCase();
  for (const item of QUESTION_RESPONSES) {
    if (item.keywords.some((kw) => lower.includes(kw))) {
      return item.response;
    }
  }
  return null;
}
