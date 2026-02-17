// MercadoLibre OAuth2 token management

import { getTokens, setTokens, isTokenValid, getConfig } from "@/lib/storage";

const ML_API = "https://api.mercadolibre.com";

function getAppId(): string {
  return getConfig().ML_APP_ID;
}
function getClientSecret(): string {
  return getConfig().ML_CLIENT_SECRET;
}

/**
 * Get a valid access token, refreshing if necessary.
 */
export async function getAccessToken(): Promise<string> {
  if (isTokenValid()) {
    return getTokens().accessToken!;
  }

  const { refreshToken } = getTokens();

  if (!refreshToken) {
    throw new Error("No refresh token available. Please authenticate via /api/auth/mercadolibre");
  }

  return refreshAccessToken(refreshToken);
}

/**
 * Refresh the access token using a refresh token.
 */
export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const appId = getAppId();
  const clientSecret = getClientSecret();

  if (!appId || !clientSecret) {
    throw new Error(
      `Faltan credenciales de ML: APP_ID=${appId ? "OK" : "FALTA"}, CLIENT_SECRET=${clientSecret ? "OK" : "FALTA"}. Configuralas en Vars (sidebar).`
    );
  }

  if (!refreshToken) {
    throw new Error(
      "No hay refresh token. Configuralo en Vars (sidebar) como ML_REFRESH_TOKEN."
    );
  }

  const res = await fetch(`${ML_API}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: appId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Token refresh failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  setTokens(data.access_token, data.refresh_token, data.expires_in, String(data.user_id));

  return data.access_token;
}

/**
 * Exchange an authorization code for tokens (used in OAuth callback).
 */
export async function exchangeCodeForTokens(code: string, redirectUri: string) {
  const res = await fetch(`${ML_API}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: getAppId(),
      client_secret: getClientSecret(),
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  setTokens(data.access_token, data.refresh_token, data.expires_in, String(data.user_id));

  return data;
}

/**
 * Get the OAuth authorization URL to start authentication.
 */
export function getAuthorizationUrl(redirectUri: string): string {
  return `https://auth.mercadolibre.com.ar/authorization?response_type=code&client_id=${getAppId()}&redirect_uri=${encodeURIComponent(redirectUri)}`;
}

/**
 * Get the seller ID from stored tokens.
 */
export function getSellerId(): string | null {
  return getTokens().sellerId;
}
