import { NextResponse } from "next/server";
import { verifyConnection } from "@/lib/google-sheets";

export async function GET() {
  try {
    const result = await verifyConnection();
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({
      connected: false,
      message,
      mode: "unknown",
    });
  }
}
