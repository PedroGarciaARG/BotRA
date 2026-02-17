import { NextResponse } from "next/server";
import { getPackMessages } from "@/lib/mercadolibre/api";
import { getAccessToken } from "@/lib/mercadolibre/auth";
import { getSellerId } from "@/lib/mercadolibre/auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ packId: string }> }
) {
  try {
    await getAccessToken();
    const sellerId = getSellerId();
    if (!sellerId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { packId } = await params;

    const data = await getPackMessages(packId, sellerId);

    // Sort messages oldest first for chat display
    const messages = (data.messages || []).sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

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
