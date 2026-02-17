// OAuth2 callback: exchanges code for tokens

import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/mercadolibre/auth";
import { addActivityLog } from "@/lib/storage";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.json({ error: "No code provided" }, { status: 400 });
  }

  try {
    const redirectUri = `${req.nextUrl.origin}/api/auth/mercadolibre/callback`;
    const tokenData = await exchangeCodeForTokens(code, redirectUri);

    addActivityLog({
      type: "message",
      message: "Autenticacion exitosa con MercadoLibre",
      details: `User ID: ${tokenData.user_id}`,
    });

    // Redirect to dashboard
    return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Authentication failed", details: message },
      { status: 500 }
    );
  }
}
