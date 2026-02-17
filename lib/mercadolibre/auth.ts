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

  console.log(`[v0] Token refresh attempt: APP_ID=${appId ? appId.slice(0, 6) + "..." : "EMPTY"}, SECRET=${clientSecret ? clientSecret.slice(0, 4) + "..." : "EMPTY"}, REFRESH=${refreshToken ? refreshToken.slice(0, 8) + "..." : "EMPTY"}`);

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

  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: appId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });

  console.log(`[v0] Token refresh params: grant_type=refresh_token, client_id=${appId}, refresh_token=${refreshToken.slice(0, 10)}...`);

  const res = await fetch(`${ML_API}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: params,
  });

  if (!res.ok) {
    const errText = await res.text();
    console.log(`[v0] Token refresh FAILED: status=${res.status}, body=${errText}`);

    // Parse error to give actionable feedback
    let parsed: { error?: string; message?: string } = {};
    try { parsed = JSON.parse(errText); } catch { /* ignore */ }

    if (parsed.error === "invalid_client") {
      throw new Error(
        `Credenciales de ML invalidas. Verifica que ML_APP_ID (${appId}) y ML_CLIENT_SECRET esten correctos en Vars (sidebar). ` +
        `Tambien podes re-autenticarte yendo a /api/auth/mercadolibre. Error original: ${errText}`
      );
    }

    if (parsed.error === "invalid_grant") {
      throw new Error(
        `El refresh token expiro o fue revocado. Necesitas re-autenticarte: ve a /api/auth/mercadolibre para obtener un nuevo token. Error original: ${errText}`
      );
    }

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
