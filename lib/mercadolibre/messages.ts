// Handle post-sale message notifications from MercadoLibre
// Script-based flow with delays and strict message sequences

import {
  getPackMessages,
  sendMessage,
  getSellerOrders,
} from "./api";
import { getAccessToken, getSellerId } from "./auth";
import {
  detectProductType,
  getProductByKey,
} from "@/lib/product-config";
import { addActivityLog, getPackState, setPackState, updatePackState } from "@/lib/storage";
import { getAvailableCode, markCodeDelivered } from "@/lib/google-sheets";
import { notifyHumanRequested, notifyCodeDelivered, notifyError } from "@/lib/telegram";
import crypto from "crypto";

function getMessageHash(text: string): string {
  return crypto.createHash("md5").update(text.toLowerCase().trim()).digest("hex");
}

// Helper para enviar mensajes con delay de 3 segundos
async function sendMessageWithDelay(
  packId: string,
  sellerId: string,
  message: string,
  buyerId: string,
  delaySeconds = 3
): Promise<void> {
  await sendMessage(packId, sellerId, message, buyerId);
  if (delaySeconds > 0) {
    await new Promise((resolve) => setTimeout(resolve, delaySeconds * 1000));
  }
}

// Mensajes del nuevo flujo
const MENSAJES = {
  INSTRUCCIONES_CANJE: `Hola! Gracias por tu compra. Te enviaremos el código de canje para que lo puedas redimir en tu cuenta.`,
  
  SIN_STOCK: `En breve un asesor te va a enviar la Gift Card. Gracias por tu compra.`,
  
  MENSAJE_7: `Al ingresar el código se acreditan 5 USD.`,
  
  MENSAJE_8: `Con el saldo puedes contratar premium o comprar robux. Qué decides hacer?`,
  
  MENSAJE_9: `Una vez que tenes los 5 USD cargados.
Ahora andá a:

https://www.roblox.com/premium/membership

Elegí el plan Premium de USD 4.99.

Cuando te pide forma de pago, te va a aparecer:
✔ Pagar con crédito de Roblox

NO HAY QUE VOLVER A PONER EL CÓDIGO.
Sí, SE DEBE COMPLETAR EL E-MAIL DE FACTURACIÓN
IR HASTA ABAJO Y APRETAR EL BOTON DE SUSCRIBIRSE.`,

  MENSAJE_10: `❗Ya tenés tu Gift Card Digital Roblox! Que la disfrutes! Te pedimos que en cuanto recibas la tarjeta, confirmes en ML para que podamos seguir trabajando! Quedamos a tu disposición! 🤝 Somos Roblox_Argentina_ok
❕Te dejamos nuestro contacto para que puedas agendarnos y aprovechar nuestras promos. 1138201597📱`,

  MENSAJE_11: `Para comprar robux debes ingresar a https://www.roblox.com/es/upgrades/robux?ctx=navpopover
Elegí los 500 Robux a USD 4.99.

Cuando te pide forma de pago, te va a aparecer:
✔ Pagar con crédito de Roblox`,

  MENSAJE_12: `❗Ya tenés tu Gift Card Digital Roblox! Que la disfrutes! Te pedimos que en cuanto recibas la tarjeta, confirmes en ML para que podamos seguir trabajando! Quedamos a tu disposición! 🤝 Somos Roblox_Argentina_ok
❕Te dejamos nuestro contacto para que puedas agendarnos y aprovechar nuestras promos. 1138201597📱`,

  NO_ENTIENDO: `Gracias por tu compra, en breve seras atendido por un asesor.`,
};

export async function handleMessageNotification(
  resource: string,
  buyerId: string
): Promise<void> {
  try {
    console.log(`[v0] handleMessageNotification: userId=${buyerId}`);

    const packId = resource.includes("/packs/")
      ? resource.split("/packs/")[1]?.split("/")[0] || ""
      : "";

    if (!packId) {
      console.log(`[v0] Invalid resource format: ${resource}`);
      return;
    }

    await getAccessToken();
    const sellerId = getSellerId();
    if (!sellerId) {
      console.log(`[v0] No sellerId available`);
      return;
    }

    // Get all messages for this pack
    const msgsData = await getPackMessages(packId, sellerId);
    const allMessages = (msgsData.messages || []).sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    if (allMessages.length === 0) {
      console.log(`[v0] No messages found for pack ${packId}`);
      return;
    }

    // Check if last message is from seller (already responded)
    const lastMsg = allMessages[allMessages.length - 1];
    if (String(lastMsg.from.user_id) === String(sellerId)) {
      console.log(`[v0] Already responded to last message`);
      return;
    }

    // Get last buyer message
    const lastBuyerText = lastMsg.text || "";
    console.log(`[v0] Last buyer message: "${lastBuyerText}"`);

    // Find order details
    let orderId = "";
    let productTitle = "";
    let productType = "";

    const ordersData = await getSellerOrders(sellerId, 50, 0);
    const order = ordersData.results?.find((o) => String(o.pack_id || o.id) === packId);

    if (order) {
      orderId = String(order.id);
      productTitle = order.order_items?.[0]?.item?.title || "";
      const detected = detectProductType(productTitle);
      productType = detected?.key || "";
      console.log(`[v0] Found order: pack=${packId}, product=${productType}`);
    } else {
      console.log(`[v0] Order not found for pack ${packId}`);
      return;
    }

    const product = getProductByKey(productType);
    if (!product) {
      console.log(`[v0] Unknown product type: ${productType}`);
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

    // Deduplication check
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

    // Analyze conversation status
    const sellerMessages = allMessages.filter((m) => String(m.from.user_id) === String(sellerId));
    const status = sellerMessages.length === 0 ? "no_seller_msgs" : state.status;

    console.log(`[v0] Status: ${status}, msg: "${lastBuyerText}"`);

    // ============= FLUJO NUEVO =============

    // PRIMER MENSAJE: Enviar instrucciones de canje
    if (status === "no_seller_msgs") {
      console.log(`[v0] First interaction - sending instructions`);
      
      await sendMessage(packId, sellerId, MENSAJES.INSTRUCCIONES_CANJE, buyerId);

      updatePackState(packId, {
        status: "instructions_sent",
        instrucciones_enviadas: true,
      });

      addActivityLog({
        type: "message",
        message: `Instrucciones enviadas: ${product.label}`,
        details: `Pack: ${packId}`,
      });
      return;
    }

    // DESPUES DE INSTRUCCIONES: Enviar código
    if (status === "instructions_sent") {
      console.log(`[v0] Instructions sent, delivering code for pack ${packId}`);

      // Get code
      let code: string = state.codeDelivered || "";

      if (!code) {
        try {
          const codeData = await getAvailableCode(product.sheetName);
          if (!codeData) {
            // SIN STOCK
            await sendMessage(packId, sellerId, MENSAJES.SIN_STOCK, buyerId);
            await notifyError("stock", `SIN STOCK - Producto: ${productTitle}, Pack: ${packId}`);
            addActivityLog({
              type: "error",
              message: `SIN STOCK: ${product.label}`,
              details: `Pack: ${packId}`,
            });
            updatePackState(packId, {
              status: "human_requested",
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
      const codeMsg = `Tu codigo: ${code}\n\nCanjea en: ${
        /roblox/i.test(productTitle) ? "www.roblox.com/redeem" : "store.steampowered.com/account/redeemwalletcode"
      }`;

      await sendMessage(packId, sellerId, codeMsg, buyerId);

      updatePackState(packId, {
        status: "code_sent",
        codigo_enviado: true,
        codigo_enviado_at: new Date().toISOString(),
        codeDelivered: code,
      });

      await notifyCodeDelivered(packId, productTitle, code);

      addActivityLog({
        type: "code_delivery",
        message: `Código entregado: ${product.label}`,
        details: `Pack: ${packId}`,
      });

      // Si es Roblox 5 USD, enviar mensaje 7 + 8
      if (productType === "roblox-5") {
        await sendMessageWithDelay(packId, sellerId, MENSAJES.MENSAJE_7, buyerId, 3);
        await sendMessage(packId, sellerId, MENSAJES.MENSAJE_8, buyerId);

        updatePackState(packId, {
          status: "waiting_choice",
        });
      } else {
        // Para otros productos, marcar como completado
        updatePackState(packId, {
          status: "completed",
        });
      }

      return;
    }

    // ESPERANDO ELECCION (solo Roblox 5 USD)
    if (status === "waiting_choice") {
      const textLower = lastBuyerText.toLowerCase();

      if (textLower.includes("premium")) {
        // Enviar mensaje 9 + esperar 3 seg + mensaje 10
        await sendMessage(packId, sellerId, MENSAJES.MENSAJE_9, buyerId);
        await sendMessageWithDelay(packId, sellerId, MENSAJES.MENSAJE_10, buyerId, 3);

        updatePackState(packId, {
          status: "completed",
        });

        addActivityLog({
          type: "message",
          message: `Premium seleccionado`,
          details: `Pack: ${packId}`,
        });
        return;
      }

      if (textLower.includes("robux")) {
        // Enviar mensaje 11 + esperar 3 seg + mensaje 12
        await sendMessage(packId, sellerId, MENSAJES.MENSAJE_11, buyerId);
        await sendMessageWithDelay(packId, sellerId, MENSAJES.MENSAJE_12, buyerId, 3);

        updatePackState(packId, {
          status: "completed",
        });

        addActivityLog({
          type: "message",
          message: `Robux seleccionado`,
          details: `Pack: ${packId}`,
        });
        return;
      }

      // No entendimos la respuesta
      await sendMessage(packId, sellerId, MENSAJES.NO_ENTIENDO, buyerId);
      await notifyHumanRequested(packId, `No entendió elección: "${lastBuyerText}"`);

      updatePackState(packId, {
        status: "human_requested",
      });

      addActivityLog({
        type: "human",
        message: "Cliente necesita asistencia - elección no reconocida",
        details: `Pack: ${packId}`,
      });
      return;
    }

    // YA COMPLETADO O ESCALADO A HUMANO: NO RESPONDER MAS
    if (status === "completed" || status === "human_requested") {
      console.log(`[v0] Conversation already completed/escalated, ignoring message`);
      return;
    }

    // CUALQUIER OTRO CASO: No entendimos, escalar a humano
    await sendMessage(packId, sellerId, MENSAJES.NO_ENTIENDO, buyerId);
    await notifyHumanRequested(packId, `Mensaje no reconocido en estado ${status}: "${lastBuyerText}"`);

    updatePackState(packId, {
      status: "human_requested",
    });

    addActivityLog({
      type: "human",
      message: "Cliente necesita asistencia",
      details: `Pack: ${packId}`,
    });

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log(`[v0] handleMessageNotification error:`, msg);
    await notifyError("message", msg).catch(() => {});
  }
}
