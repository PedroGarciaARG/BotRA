// Simulate a webhook to test the full pipeline.
// Fetches the most recent paid order from ML and processes it.

import { NextResponse } from "next/server";
import { getAccessToken, getSellerId } from "@/lib/mercadolibre/auth";
import { getSellerOrders } from "@/lib/mercadolibre/api";
import { handleOrderNotification } from "@/lib/mercadolibre/orders";
import { addActivityLog } from "@/lib/storage";

export async function POST() {
  try {
    // Ensure we have a valid token
    await getAccessToken();
    const sellerId = getSellerId();

    if (!sellerId) {
      return NextResponse.json({
        success: false,
        error: "No seller ID. Autenticate primero.",
      });
    }

    // Fetch most recent orders
    const ordersData = await getSellerOrders(sellerId, 5, 0);
    const orders = ordersData.results || [];

    if (orders.length === 0) {
      return NextResponse.json({
        success: false,
        error: "No se encontraron ordenes recientes en tu cuenta de ML.",
      });
    }

    // Find the most recent paid order
    const paidOrder = orders.find((o) => o.status === "paid");
    const latestOrder = paidOrder || orders[0];

    const itemTitle =
      latestOrder.order_items?.[0]?.item?.title || "Producto desconocido";

    addActivityLog({
      type: "message",
      message: `Simulacion de webhook iniciada`,
      details: `Order: ${latestOrder.id} | Status: ${latestOrder.status} | Item: ${itemTitle}`,
    });

    if (latestOrder.status === "paid") {
      // Process it through the normal order handler
      try {
        await handleOrderNotification(`/orders/${latestOrder.id}`);
        return NextResponse.json({
          success: true,
          message: `Orden procesada: ${itemTitle}`,
          details: `Order ID: ${latestOrder.id} | Comprador: ${latestOrder.buyer.nickname} | Estado: ${latestOrder.status}. Revisa el chat de ML para ver si se envio el mensaje de bienvenida.`,
        });
      } catch (orderErr) {
        return NextResponse.json({
          success: false,
          error: `Error procesando orden: ${orderErr instanceof Error ? orderErr.message : "unknown"}`,
          details: `Order ID: ${latestOrder.id} | Item: ${itemTitle}`,
        });
      }
    } else {
      return NextResponse.json({
        success: false,
        error: `La orden mas reciente no esta pagada (status: ${latestOrder.status})`,
        details: `Order ID: ${latestOrder.id} | Item: ${itemTitle} | Comprador: ${latestOrder.buyer.nickname}. Necesitas una orden con status "paid" para simular el flujo completo.`,
      });
    }
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : "Error desconocido",
    });
  }
}
