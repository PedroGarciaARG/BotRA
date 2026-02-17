// Handle order notifications from MercadoLibre.
// When an order is paid, send the initial welcome message.

import { getOrder, sendMessages, getPackMessages, initConversation } from "./api";
import { getAccessToken, getSellerId } from "./auth";
import { detectProductType, WELCOME_MESSAGE } from "@/lib/product-config";
import { getPackState, setPackState, addActivityLog } from "@/lib/storage";
import { notifyNewOrder, notifyError } from "@/lib/telegram";

export interface OrderResult {
  action: "sent" | "skipped_tracked" | "skipped_exists" | "skipped_unpaid" | "skipped_unknown_product" | "error";
  message: string;
  packId?: string;
  orderId?: string;
}

export async function handleOrderNotification(
  resource: string,
  options?: { force?: boolean }
): Promise<OrderResult> {
  const orderId = resource.replace("/orders/", "");

  // CRITICAL: On serverless (Netlify), each cold start has no sellerId in memory.
  // We must call getAccessToken() first to refresh the token AND populate sellerId.
  try {
    await getAccessToken();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`[v0] handleOrderNotification: auth failed: ${msg}`);
    return { action: "error", message: `Auth failed: ${msg}`, orderId };
  }

  const sellerId = getSellerId();

  if (!sellerId) {
    return { action: "error", message: "Seller ID not available after auth. Check credentials.", orderId };
  }

  let order;
  try {
    order = await getOrder(orderId);
  } catch (err) {
    return {
      action: "error",
      message: `No se pudo obtener la orden: ${err instanceof Error ? err.message : "unknown"}`,
      orderId,
    };
  }

  if (order.status !== "paid") {
    return {
      action: "skipped_unpaid",
      message: `Orden ${orderId} status=${order.status}, no es paid`,
      orderId,
    };
  }

  const packId = String(order.pack_id || order.id);
  const itemTitle = order.order_items?.[0]?.item?.title || "";
  const product = detectProductType(itemTitle);
  const buyerId = String(order.buyer.id);

  if (!product) {
    addActivityLog({
      type: "error",
      message: `Producto no reconocido: "${itemTitle.slice(0, 80)}"`,
      details: `Order: ${orderId}`,
    });
    await notifyError("order", `Producto no reconocido: ${itemTitle}`);
    return {
      action: "skipped_unknown_product",
      message: `Producto no reconocido: "${itemTitle}"`,
      packId,
      orderId,
    };
  }

  // Skip if already tracked (unless force=true for simulation)
  if (!options?.force && getPackState(packId)) {
    return {
      action: "skipped_tracked",
      message: `Pack ${packId} ya estaba trackeado en memoria`,
      packId,
      orderId,
    };
  }

  // Check if ML already has seller messages for this pack (in case of restart)
  if (!options?.force) {
    try {
      const existingMessages = await getPackMessages(packId, sellerId);
      const allMessages = existingMessages.messages || [];
      const sellerMessages = allMessages.filter(
        (m) => String(m.from.user_id) === String(sellerId)
      );
      if (sellerMessages.length > 0) {
        // Reconstruct state only - don't re-send
        setPackState(packId, {
          packId,
          orderId,
          sellerId,
          buyerId,
          productType: product.key,
          productTitle: itemTitle,
          status: "initial_sent",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        addActivityLog({
          type: "order",
          message: `Orden reconstruida: ${product.label}`,
          details: `Pack: ${packId} | Ya tenia ${sellerMessages.length} mensaje(s) del vendedor`,
        });
        return {
          action: "skipped_exists",
          message: `Pack ${packId} ya tenia ${sellerMessages.length} mensaje(s) del vendedor en ML. Estado reconstruido.`,
          packId,
          orderId,
        };
      }
    } catch {
      // If we can't check messages, proceed with sending
    }
  }

  // Initialize conversation (ML requires action_guide for Mercado Envios 2)
  // This selects "OTHER" option to enable free-form messaging
  const firstMessage = WELCOME_MESSAGE[0] || "";
  const conversationInitialized = await initConversation(packId, firstMessage);
  console.log(`[v0] Conversation init for pack ${packId}: ${conversationInitialized}`);

  // Send welcome message
  // If initConversation sent the first message via action_guide with text,
  // we still send via sendMessages as fallback (ML may handle dedup)
  try {
    if (!conversationInitialized) {
      // action_guide failed or not needed, send directly
      await sendMessages(packId, sellerId, WELCOME_MESSAGE, buyerId);
    } else {
      // action_guide may have sent the first message already via "OTHER" option
      // Send remaining messages if WELCOME_MESSAGE has more than one chunk
      if (WELCOME_MESSAGE.length > 1) {
        await sendMessages(packId, sellerId, WELCOME_MESSAGE.slice(1), buyerId);
      }
      // If only 1 message, it was already sent via action_guide
    }
  } catch (sendErr) {
    // If action_guide sent but direct send fails, try direct send as fallback
    console.log(`[v0] sendMessages failed, trying direct send:`, sendErr instanceof Error ? sendErr.message : sendErr);
    try {
      await sendMessages(packId, sellerId, WELCOME_MESSAGE, buyerId);
    } catch (retryErr) {
      return {
        action: "error",
        message: `Error enviando mensaje: ${retryErr instanceof Error ? retryErr.message : "unknown"}`,
        packId,
        orderId,
      };
    }
  }

  // Save state only after message was sent successfully
  setPackState(packId, {
    packId,
    orderId,
    sellerId,
    buyerId,
    productType: product.key,
    productTitle: itemTitle,
    status: "initial_sent",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  addActivityLog({
    type: "order",
    message: `Nueva orden: ${product.label}`,
    details: `Pack: ${packId} | Comprador: ${order.buyer.nickname}`,
  });

  await notifyNewOrder(packId, product.label, order.buyer.nickname);

  return {
    action: "sent",
    message: `Mensaje de bienvenida enviado a ${order.buyer.nickname} para ${product.label}`,
    packId,
    orderId,
  };
}
