import { NextRequest, NextResponse } from "next/server";
import { getSellerOrders } from "@/lib/mercadolibre/api";
import { getAccessToken } from "@/lib/mercadolibre/auth";
import { getSellerId } from "@/lib/mercadolibre/auth";

export async function GET(request: NextRequest) {
  try {
    await getAccessToken();
    const sellerId = getSellerId();
    if (!sellerId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const limit = parseInt(searchParams.get("limit") || "30", 10);

    const data = await getSellerOrders(sellerId, limit, offset);

    // Map orders into chat summaries
    const chats = data.results.map((order) => ({
      orderId: order.id,
      packId: order.pack_id || order.id, // use order id as fallback pack id
      status: order.status,
      dateCreated: order.date_created,
      productTitle: order.order_items?.[0]?.item?.title || "Producto",
      productItemId: order.order_items?.[0]?.item?.id || "",
      unitPrice: order.order_items?.[0]?.unit_price || 0,
      buyerNickname: order.buyer?.nickname || "Comprador",
      buyerId: order.buyer?.id,
      shipmentId: order.shipping?.id || null,
      isPaid: order.payments?.some((p) => p.status === "approved") || false,
    }));

    return NextResponse.json({
      chats,
      total: data.paging.total,
      offset: data.paging.offset,
      limit: data.paging.limit,
    });
  } catch (error) {
    console.log("[v0] Chats API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error desconocido" },
      { status: 500 }
    );
  }
}
