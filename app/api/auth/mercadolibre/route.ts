// OAuth2 flow start: redirects user to MercadoLibre authorization page

import { NextRequest, NextResponse } from "next/server";
import { getAuthorizationUrl } from "@/lib/mercadolibre/auth";

export async function GET(req: NextRequest) {
  const redirectUri = `${req.nextUrl.origin}/api/auth/mercadolibre/callback`;
  const authUrl = getAuthorizationUrl(redirectUri);
  return NextResponse.redirect(authUrl);
}
