// Handle order notifications from MercadoLibre.
// When an order is paid, send the initial welcome message.

import { getOrder, sendMessages, getPackMessages } from "./api";
import { getSellerId } from "./auth";
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
  const sellerId = getSellerId();

  if (!sellerId) {
    return { action: "error", message: "Seller ID not available. Authenticate first.", orderId };
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

  // Send welcome message
  try {
    await sendMessages(packId, sellerId, WELCOME_MESSAGE, buyerId);
  } catch (sendErr) {
    return {
      action: "error",
      message: `Error enviando mensaje: ${sendErr instanceof Error ? sendErr.message : "unknown"}`,
      packId,
      orderId,
    };
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
