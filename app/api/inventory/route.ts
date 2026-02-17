// Inventory endpoint: returns code counts from Google Sheets

import { NextResponse } from "next/server";
import { getInventoryCounts } from "@/lib/google-sheets";

export async function GET() {
  try {
    const counts = await getInventoryCounts();
    return NextResponse.json({ inventory: counts });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch inventory", details: message },
      { status: 500 }
    );
  }
}
