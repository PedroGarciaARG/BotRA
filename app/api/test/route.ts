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

  // 1. Check env vars (both process.env and runtime config)
  const config = await import("@/lib/storage").then((m) => m.getConfig());
  results.envVars = {
    ML_APP_ID: !!config.ML_APP_ID,
    ML_CLIENT_SECRET: !!config.ML_CLIENT_SECRET,
    ML_REFRESH_TOKEN: !!config.ML_REFRESH_TOKEN,
    GOOGLE_SCRIPT_URL: !!config.GOOGLE_SCRIPT_URL,
    TELEGRAM_TOKEN: !!config.TELEGRAM_TOKEN,
    TELEGRAM_CHAT_ID: !!config.TELEGRAM_CHAT_ID,
  };
  results.envSource = {
    ML_APP_ID: !!process.env.ML_APP_ID ? "env" : config.ML_APP_ID ? "runtime" : "missing",
    ML_CLIENT_SECRET: !!process.env.ML_CLIENT_SECRET ? "env" : config.ML_CLIENT_SECRET ? "runtime" : "missing",
    ML_REFRESH_TOKEN: !!process.env.ML_REFRESH_TOKEN ? "env" : config.ML_REFRESH_TOKEN ? "runtime" : "missing",
    GOOGLE_SCRIPT_URL: !!process.env.GOOGLE_SCRIPT_URL ? "env" : config.GOOGLE_SCRIPT_URL ? "runtime" : "missing",
    TELEGRAM_TOKEN: !!process.env.TELEGRAM_TOKEN ? "env" : config.TELEGRAM_TOKEN ? "runtime" : "missing",
    TELEGRAM_CHAT_ID: !!process.env.TELEGRAM_CHAT_ID ? "env" : config.TELEGRAM_CHAT_ID ? "runtime" : "missing",
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
