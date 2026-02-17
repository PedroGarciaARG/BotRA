import { NextRequest, NextResponse } from "next/server";
import { getPackMessages } from "@/lib/mercadolibre/api";
import { getAccessToken } from "@/lib/mercadolibre/auth";
import { getSellerId } from "@/lib/mercadolibre/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ packId: string }> }
) {
  try {
    await getAccessToken();
    const sellerId = getSellerId();
    if (!sellerId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { packId } = await params;

    // Check if caller indicated this is an order-based ID (no real pack)
    const { searchParams } = new URL(request.url);
    const isOrderFallback = searchParams.get("type") === "order";

    console.log(`[v0] Fetching messages for ${isOrderFallback ? "order" : "pack"} ${packId}`);

    const data = await getPackMessages(packId, sellerId, isOrderFallback);

    // Sort messages oldest first for chat display
    const messages = (data.messages || []).sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    console.log(`[v0] Found ${messages.length} messages for ${packId}`);

    return NextResponse.json({
      messages: messages.map((m) => ({
        id: m.id,
        fromUserId: m.from.user_id,
        fromRole: m.from.role,
        toUserId: m.to.user_id,
        text: m.text,
        createdAt: m.created_at,
      })),
      sellerId,
      total: data.paging?.total || messages.length,
    });
  } catch (error) {
    console.log("[v0] Chat detail API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error desconocido" },
      { status: 500 }
    );
  }
}
