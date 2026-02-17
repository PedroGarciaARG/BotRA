// Test endpoint to diagnose connection issues.
// GET /api/test - checks ML auth, Google Sheets, and bot status

import { NextResponse } from "next/server";
import { getAccessToken, getSellerId } from "@/lib/mercadolibre/auth";
import { mlFetch } from "@/lib/mercadolibre/api";
import { verifyConnection as verifySheetsConnection } from "@/lib/google-sheets";
import { getBotEnabled, getTokens } from "@/lib/storage";

export async function GET() {
  const results: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    botEnabled: getBotEnabled(),
  };

  // 1. Check env vars
  results.envVars = {
    ML_APP_ID: !!process.env.ML_APP_ID,
    ML_CLIENT_SECRET: !!process.env.ML_CLIENT_SECRET,
    ML_REFRESH_TOKEN: !!process.env.ML_REFRESH_TOKEN,
    GOOGLE_SCRIPT_URL: !!process.env.GOOGLE_SCRIPT_URL,
    TELEGRAM_TOKEN: !!process.env.TELEGRAM_TOKEN,
    TELEGRAM_CHAT_ID: !!process.env.TELEGRAM_CHAT_ID,
  };

  // 2. Check ML token
  try {
    const token = await getAccessToken();
    const sellerId = getSellerId();
    results.mercadolibre = {
      status: "ok",
      hasToken: !!token,
      sellerId,
      tokenExpiresAt: new Date(getTokens().expiresAt).toISOString(),
    };

    // Try a simple API call
    try {
      const me = await mlFetch<{ id: number; nickname: string }>("/users/me");
      results.mercadolibre = {
        ...results.mercadolibre as Record<string, unknown>,
        userId: me.id,
        nickname: me.nickname,
      };
    } catch (apiErr) {
      results.mercadolibre = {
        ...results.mercadolibre as Record<string, unknown>,
        apiCallError: apiErr instanceof Error ? apiErr.message : "unknown",
      };
    }
  } catch (err) {
    results.mercadolibre = {
      status: "error",
      error: err instanceof Error ? err.message : "unknown",
    };
  }

  // 3. Check Google Sheets
  try {
    const sheetsResult = await verifySheetsConnection();
    results.googleSheets = sheetsResult;
  } catch (err) {
    results.googleSheets = {
      status: "error",
      error: err instanceof Error ? err.message : "unknown",
    };
  }

  return NextResponse.json(results, {
    headers: { "Cache-Control": "no-store" },
  });
}
