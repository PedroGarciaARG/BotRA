import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { getConfig, setConfig } from "@/lib/storage";

export async function GET() {
  const config = getConfig();

  // Mask secrets for display -- show last 6 chars only
  function mask(val: string): string {
    if (!val) return "";
    if (val.length <= 6) return "***";
    return "***" + val.slice(-6);
  }

  return NextResponse.json({
    ML_APP_ID: config.ML_APP_ID, // Not secret, can show full
    ML_CLIENT_SECRET: mask(config.ML_CLIENT_SECRET),
    ML_REFRESH_TOKEN: mask(config.ML_REFRESH_TOKEN),
    TELEGRAM_TOKEN: mask(config.TELEGRAM_TOKEN),
    TELEGRAM_CHAT_ID: config.TELEGRAM_CHAT_ID, // Not secret
    GOOGLE_SCRIPT_URL: config.GOOGLE_SCRIPT_URL, // Not secret
    // Indicate which ones are set
    _set: {
      ML_APP_ID: !!config.ML_APP_ID,
      ML_CLIENT_SECRET: !!config.ML_CLIENT_SECRET,
      ML_REFRESH_TOKEN: !!config.ML_REFRESH_TOKEN,
      TELEGRAM_TOKEN: !!config.TELEGRAM_TOKEN,
      TELEGRAM_CHAT_ID: !!config.TELEGRAM_CHAT_ID,
      GOOGLE_SCRIPT_URL: !!config.GOOGLE_SCRIPT_URL,
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const allowedKeys = [
      "ML_APP_ID",
      "ML_CLIENT_SECRET",
      "ML_REFRESH_TOKEN",
      "TELEGRAM_TOKEN",
      "TELEGRAM_CHAT_ID",
      "GOOGLE_SCRIPT_URL",
    ];

    const update: Record<string, string> = {};
    for (const key of allowedKeys) {
      if (typeof body[key] === "string" && body[key].trim()) {
        update[key] = body[key].trim();
      }
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "No hay valores para actualizar" }, { status: 400 });
    }

    setConfig(update);

    return NextResponse.json({
      success: true,
      updated: Object.keys(update),
      message: `${Object.keys(update).length} variable(s) actualizada(s)`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error desconocido" },
      { status: 500 }
    );
  }
}
