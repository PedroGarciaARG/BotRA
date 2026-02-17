import { NextResponse } from "next/server";
import { getOrderDetails, markShipmentDelivered } from "@/lib/mercadolibre/api";
import { getAccessToken } from "@/lib/mercadolibre/auth";
import { getSellerId } from "@/lib/mercadolibre/auth";
import { addActivityLog } from "@/lib/storage";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ packId: string }> }
) {
  try {
    await getAccessToken();
    const sellerId = getSellerId();
    if (!sellerId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { packId } = await params;
    const body = await request.json();
    const { orderId, shipmentId: directShipmentId } = body;

    let shipmentId = directShipmentId;

    // If no direct shipmentId, look it up from the order
    if (!shipmentId && orderId) {
      const order = await getOrderDetails(String(orderId));
      shipmentId = order.shipping?.id;
    }

    if (!shipmentId) {
      return NextResponse.json(
        { error: "No se encontro shipment_id para esta orden" },
        { status: 400 }
      );
    }

    await markShipmentDelivered(shipmentId);

    addActivityLog({
      type: "message",
      message: "Marcado como entregado manualmente",
      details: `Pack: ${packId} | Shipment: ${shipmentId}`,
    });

    return NextResponse.json({ success: true, shipmentId });
  } catch (error) {
    console.log("[v0] Deliver API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error desconocido" },
      { status: 500 }
    );
  }
}
