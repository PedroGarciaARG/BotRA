import { NextRequest, NextResponse } from "next/server";
import { getSellerQuestions } from "@/lib/mercadolibre/api";
import { getAccessToken } from "@/lib/mercadolibre/auth";
import { getSellerId } from "@/lib/mercadolibre/auth";

export async function GET(request: NextRequest) {
  try {
    // Ensure we have a valid token
    await getAccessToken();
    const sellerId = getSellerId();
    if (!sellerId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    const data = await getSellerQuestions(sellerId, "ANSWERED", limit, offset);

    return NextResponse.json({
      questions: data.questions,
      total: data.total,
      offset: data.offset,
      limit: data.limit,
    });
  } catch (error) {
    console.log("[v0] Questions API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error desconocido" },
      { status: 500 }
    );
  }
}
