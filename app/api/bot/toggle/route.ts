import { NextRequest, NextResponse } from "next/server";
import { getBotEnabled, setBotEnabled, addActivityLog } from "@/lib/storage";

export async function GET() {
  return NextResponse.json({ enabled: getBotEnabled() });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { enabled } = body;

    if (typeof enabled !== "boolean") {
      return NextResponse.json(
        { error: "El campo 'enabled' debe ser un booleano" },
        { status: 400 }
      );
    }

    setBotEnabled(enabled);

    addActivityLog({
      type: "message",
      message: enabled ? "Bot activado" : "Bot pausado",
      details: `Estado del bot cambiado a: ${enabled ? "activo" : "pausado"}`,
    });

    return NextResponse.json({ enabled: getBotEnabled() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
