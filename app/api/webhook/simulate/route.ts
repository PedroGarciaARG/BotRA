// Simulate a webhook to test the full pipeline.
// Fetches the most recent paid order from ML and processes it with force=true.

import { NextResponse } from "next/server";
import { getAccessToken, getSellerId } from "@/lib/mercadolibre/auth";
import { getSellerOrders } from "@/lib/mercadolibre/api";
import { handleOrderNotification } from "@/lib/mercadolibre/orders";
import { addActivityLog } from "@/lib/storage";

export async function POST() {
  try {
    await getAccessToken();
    const sellerId = getSellerId();

    if (!sellerId) {
      return NextResponse.json({
        success: false,
        error: "No seller ID. Autenticate primero.",
      });
    }

    const ordersData = await getSellerOrders(sellerId, 5, 0);
    const orders = ordersData.results || [];

    if (orders.length === 0) {
      return NextResponse.json({
        success: false,
        error: "No se encontraron ordenes recientes en tu cuenta de ML.",
      });
    }

    const paidOrder = orders.find((o) => o.status === "paid");
    const latestOrder = paidOrder || orders[0];
    const itemTitle =
      latestOrder.order_items?.[0]?.item?.title || "Producto desconocido";

    addActivityLog({
      type: "message",
      message: `Simulacion de webhook iniciada`,
      details: `Order: ${latestOrder.id} | Status: ${latestOrder.status} | Item: ${itemTitle}`,
    });

    if (latestOrder.status !== "paid") {
      return NextResponse.json({
        success: false,
        error: `La orden mas reciente no esta pagada (status: ${latestOrder.status})`,
        details: `Order ID: ${latestOrder.id} | Item: ${itemTitle} | Comprador: ${latestOrder.buyer.nickname}`,
      });
    }

    // Process with force=true to skip pack state and message-history checks
    const result = await handleOrderNotification(
      `/orders/${latestOrder.id}`,
      { force: true }
    );

    const packId = String(latestOrder.pack_id || latestOrder.id);

    return NextResponse.json({
      success: result.action === "sent",
      action: result.action,
      message: result.message,
      details: `Order: ${latestOrder.id} | Pack: ${packId} | Seller: ${sellerId} | Buyer: ${latestOrder.buyer.id} | Item: ${itemTitle}`,
    });
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : "Error desconocido",
    });
  }
}
