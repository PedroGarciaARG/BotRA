import { NextResponse } from "next/server";
import { refreshAccessToken } from "@/lib/mercadolibre/auth";
import { getTokens, addActivityLog } from "@/lib/storage";

export async function POST() {
  try {
    const { refreshToken } = getTokens();

    if (!refreshToken) {
      return NextResponse.json(
        {
          success: false,
          error: "No hay refresh token disponible. Conecta MercadoLibre primero.",
        },
        { status: 400 }
      );
    }

    await refreshAccessToken(refreshToken);
    const { expiresAt } = getTokens();

    addActivityLog({
      type: "message",
      message: "Token de ML refrescado manualmente",
      details: `Nuevo token valido hasta: ${new Date(expiresAt).toLocaleString("es-AR")}`,
    });

    return NextResponse.json({
      success: true,
      expiresAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";

    addActivityLog({
      type: "error",
      message: "Error al refrescar token de ML",
      details: message,
    });

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
