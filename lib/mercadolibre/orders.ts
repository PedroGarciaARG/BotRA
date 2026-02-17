// Handle order notifications from MercadoLibre.
// When an order is paid, send the initial welcome message.

import { getOrder, sendMessages, getPackMessages } from "./api";
import { getSellerId } from "./auth";
import { detectProductType, WELCOME_MESSAGE } from "@/lib/product-config";
import { getPackState, setPackState, addActivityLog } from "@/lib/storage";
import { notifyNewOrder, notifyError } from "@/lib/telegram";

export async function handleOrderNotification(resource: string): Promise<void> {
  // resource is like "/orders/ORDER_ID"
  const orderId = resource.replace("/orders/", "");
  const sellerId = getSellerId();

  if (!sellerId) {
    throw new Error("Seller ID not available. Authenticate first.");
  }

  const order = await getOrder(orderId);

  // Only process paid orders
  if (order.status !== "paid") {
    console.log(`[v0] Order ${orderId} status is ${order.status}, skipping`);
    return;
  }

  // Get or create pack ID (ML groups orders in packs)
  const packId = String(order.pack_id || order.id);

  // Skip if we already handled this pack
  if (getPackState(packId)) {
    console.log(`[v0] Pack ${packId} already tracked, skipping`);
    return;
  }

  // Detect product type from item title
  const itemTitle = order.order_items?.[0]?.item?.title || "";
  const product = detectProductType(itemTitle);

  if (!product) {
    addActivityLog({
      type: "error",
      message: `Producto no reconocido: "${itemTitle.slice(0, 80)}"`,
      details: `Order: ${orderId}`,
    });
    await notifyError("order", `Producto no reconocido: ${itemTitle}`);
    return;
  }

  // Check if we already sent messages to this pack (in case of restart)
  try {
    const existingMessages = await getPackMessages(packId, sellerId);
    const sellerMessages = existingMessages.messages?.filter(
      (m) => m.from.user_id === sellerId
    );
    if (sellerMessages && sellerMessages.length > 0) {
      console.log(`[v0] Pack ${packId} already has seller messages, reconstructing state`);
      setPackState(packId, {
        packId,
        orderId,
        sellerId,
        buyerId: String(order.buyer.id),
        productType: product.key,
        productTitle: itemTitle,
        status: "initial_sent",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      return;
    }
  } catch {
    // If we can't check messages, proceed with sending
  }

  // Save state
  setPackState(packId, {
    packId,
    orderId,
    sellerId,
    buyerId: String(order.buyer.id),
    productType: product.key,
    productTitle: itemTitle,
    status: "initial_sent",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // Send welcome message
  await sendMessages(packId, sellerId, WELCOME_MESSAGE);

  addActivityLog({
    type: "order",
    message: `Nueva orden: ${product.label}`,
    details: `Pack: ${packId} | Comprador: ${order.buyer.nickname}`,
  });

  await notifyNewOrder(packId, product.label, order.buyer.nickname);
}
