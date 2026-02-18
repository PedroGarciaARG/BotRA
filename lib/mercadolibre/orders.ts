// Handle order notifications from MercadoLibre.
// When an order is paid, register it and wait for buyer's first message.

import { getOrder } from "./api";
import { getAccessToken, getSellerId } from "./auth";
import { detectProductType } from "@/lib/product-config";
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

  // Save state (on serverless this only survives the current invocation,
  // but the message handler will reconstruct from ML if needed)
  setPackState(packId, {
    packId,
    orderId,
    sellerId,
    buyerId,
    productType: product.key,
    productTitle: itemTitle,
    status: "waiting_buyer", // New flow: wait for buyer's first message
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
    message: `Orden registrada: ${product.label} de ${order.buyer.nickname}. Esperando mensaje del comprador.`,
    packId,
    orderId,
  };
}
