// Test endpoint to diagnose connection issues.
// GET /api/test - checks ML auth, Google Sheets, and bot status

import { NextRequest, NextResponse } from "next/server";
import { getAccessToken, getSellerId } from "@/lib/mercadolibre/auth";
import { mlFetch, sendMessage, getPackMessages, initConversation } from "@/lib/mercadolibre/api";
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
  // Show first chars of credentials for debugging (safe: not full values)
  results.credentialPreview = {
    ML_APP_ID: config.ML_APP_ID ? config.ML_APP_ID.slice(0, 8) + "..." : "EMPTY",
    ML_CLIENT_SECRET: config.ML_CLIENT_SECRET ? config.ML_CLIENT_SECRET.slice(0, 4) + "..." : "EMPTY",
    ML_REFRESH_TOKEN: config.ML_REFRESH_TOKEN ? config.ML_REFRESH_TOKEN.slice(0, 8) + "..." : "EMPTY",
    ML_APP_ID_isNumeric: /^\d+$/.test(config.ML_APP_ID),
    ML_CLIENT_SECRET_isAlpha: /^[a-zA-Z0-9]+$/.test(config.ML_CLIENT_SECRET),
  };
  results.envSource = {
    ML_APP_ID: !!process.env.ML_APP_ID ? "env" : config.ML_APP_ID ? "override" : "missing",
    ML_CLIENT_SECRET: !!process.env.ML_CLIENT_SECRET ? "env" : config.ML_CLIENT_SECRET ? "override" : "missing",
    ML_REFRESH_TOKEN: !!process.env.ML_REFRESH_TOKEN ? "env" : config.ML_REFRESH_TOKEN ? "override" : "missing",
    GOOGLE_SCRIPT_URL: !!process.env.GOOGLE_SCRIPT_URL ? "env" : config.GOOGLE_SCRIPT_URL ? "override" : "missing",
    TELEGRAM_TOKEN: !!process.env.TELEGRAM_TOKEN ? "env" : config.TELEGRAM_TOKEN ? "override" : "missing",
    TELEGRAM_CHAT_ID: !!process.env.TELEGRAM_CHAT_ID ? "env" : config.TELEGRAM_CHAT_ID ? "override" : "missing",
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

/**
 * POST /api/test - Test sending a message to a specific pack.
 * Body: { packId: string, text?: string, action?: "send" | "init" | "read" }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { packId, text = "Test message from bot", action = "send" } = body;

    if (!packId) {
      return NextResponse.json({ error: "packId is required" }, { status: 400 });
    }

    await getAccessToken();
    const sellerId = getSellerId();
    if (!sellerId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const results: Record<string, unknown> = { packId, sellerId, action };

    if (action === "read") {
      const msgs = await getPackMessages(packId, sellerId);
      results.messages = msgs.messages;
      results.total = msgs.paging?.total;
      return NextResponse.json(results);
    }

    if (action === "init") {
      const initResult = await initConversation(packId, text);
      results.initResult = initResult;
      return NextResponse.json(results);
    }

    // action === "send"
    try {
      await sendMessage(packId, sellerId, text);
      results.sendResult = "ok";
    } catch (err) {
      results.sendResult = "error";
      results.sendError = err instanceof Error ? err.message : String(err);
    }

    return NextResponse.json(results);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
