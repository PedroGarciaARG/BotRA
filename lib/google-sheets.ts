// Google Sheets integration for gift card code inventory.
//
// Auth modes (checked in priority order):
// 1. Apps Script Web App (GOOGLE_SCRIPT_URL) - zero credentials, recommended
// 2. Service Account (GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY)
// 3. API Key (GOOGLE_API_KEY) - read-only, sheet must be public
//
// For the simplest setup: deploy the Apps Script below in your sheet and set GOOGLE_SCRIPT_URL.
// No API keys, no service accounts, nothing else needed.
//
// Sheet structure per tab: Column A = Code, Column B = Status, Column C = OrderID, Column D = Date

import { getConfig } from "@/lib/storage";

const SHEET_ID =
  process.env.GOOGLE_SHEET_ID ||
  "18CL9J0juFqhYLy4po-gh3qQ0xWSqOq5_-In87JyCHk0";

const API_KEY = process.env.GOOGLE_API_KEY;
const SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

type AuthMode = "apps_script" | "service_account" | "api_key" | "none";

function getScriptUrl(): string {
  return getConfig().GOOGLE_SCRIPT_URL;
}

function getAuthMode(): AuthMode {
  if (getScriptUrl()) return "apps_script";
  if (SERVICE_ACCOUNT_EMAIL && PRIVATE_KEY) return "service_account";
  if (API_KEY) return "api_key";
  return "none";
}

// ──────────────────────────────────────────────
// Apps Script mode - calls deployed web app
// ──────────────────────────────────────────────

async function scriptGet(
  action: string,
  params: Record<string, string> = {}
): Promise<unknown> {
  const url = new URL(getScriptUrl());
  url.searchParams.set("action", action);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), { redirect: "follow" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Apps Script error (${res.status}): ${text}`);
  }
  return res.json();
}

async function scriptPost(
  action: string,
  payload: Record<string, unknown>
): Promise<unknown> {
  const res = await fetch(getScriptUrl(), {
    method: "POST",
    redirect: "follow",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Apps Script error (${res.status}): ${text}`);
  }
  return res.json();
}

// ──────────────────────────────────────────────
// Service Account JWT auth
// ──────────────────────────────────────────────

async function getServiceAccountToken(): Promise<string> {
  if (!SERVICE_ACCOUNT_EMAIL || !PRIVATE_KEY) {
    throw new Error("Google service account credentials not configured");
  }

  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: SERVICE_ACCOUNT_EMAIL,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const toBase64Url = (data: string) =>
    btoa(data).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  const headerB64 = toBase64Url(JSON.stringify(header));
  const claimB64 = toBase64Url(JSON.stringify(claim));
  const signingInput = `${headerB64}.${claimB64}`;

  const pemBody = PRIVATE_KEY.replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");

  const binaryDer = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput)
  );

  const signatureB64 = toBase64Url(
    String.fromCharCode(...new Uint8Array(signature))
  );

  const jwt = `${signingInput}.${signatureB64}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    throw new Error(`Google auth failed: ${errText}`);
  }

  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

// ──────────────────────────────────────────────
// Direct Sheets API helpers (SA / API Key)
// ──────────────────────────────────────────────

function sheetsUrl(range: string, extra?: string): string {
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}`;
  return extra ? `${base}?${extra}` : base;
}

async function getAuthHeaders(): Promise<{
  headers: Record<string, string>;
  urlSuffix: string;
}> {
  const mode = getAuthMode();
  if (mode === "service_account") {
    const token = await getServiceAccountToken();
    return { headers: { Authorization: `Bearer ${token}` }, urlSuffix: "" };
  }
  if (mode === "api_key") {
    return { headers: {}, urlSuffix: `key=${API_KEY}` };
  }
  throw new Error("No hay credenciales directas de Sheets API");
}

async function directReadRange(range: string): Promise<string[][]> {
  const auth = await getAuthHeaders();
  const url = sheetsUrl(range, auth.urlSuffix);
  const res = await fetch(url, { headers: auth.headers });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Sheets read failed (${res.status}): ${errText}`);
  }
  const data = await res.json();
  return data.values || [];
}

async function directWriteRange(range: string, values: string[][]): Promise<void> {
  const mode = getAuthMode();
  let headers: Record<string, string> = { "Content-Type": "application/json" };
  let suffix = "valueInputOption=USER_ENTERED";

  if (mode === "service_account") {
    const token = await getServiceAccountToken();
    headers.Authorization = `Bearer ${token}`;
  } else if (mode === "api_key") {
    suffix += `&key=${API_KEY}`;
  }

  const res = await fetch(sheetsUrl(range, suffix), {
    method: "PUT",
    headers,
    body: JSON.stringify({ values }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Sheets write failed (${res.status}): ${errText}`);
  }
}

// ──────────────────────────────────────────────
// Public API (used by the rest of the app)
// ──────────────────────────────────────────────

/**
 * Verify connection to Google Sheets.
 */
export async function verifyConnection(): Promise<{
  connected: boolean;
  message: string;
  mode: string;
}> {
  const mode = getAuthMode();

  if (mode === "none") {
    return {
      connected: false,
      message:
        "No hay credenciales configuradas. Agrega GOOGLE_SCRIPT_URL (recomendado), GOOGLE_API_KEY, o credenciales de Service Account.",
      mode: "none",
    };
  }

  try {
    if (mode === "apps_script") {
      const result = (await scriptGet("verify")) as {
        ok: boolean;
        sheets?: string[];
        error?: string;
      };
      if (result.ok) {
        return {
          connected: true,
          message: `Conectado via Apps Script. Pestanas: ${result.sheets?.join(", ") || "cargando..."}`,
          mode: "apps_script",
        };
      }
      return { connected: false, message: result.error || "Error desconocido", mode };
    }

    // SA or API Key - try reading a small range
    const rows = await directReadRange("steam-5!A1:A1");
    return {
      connected: true,
      message: `Conectado via ${mode === "service_account" ? "Service Account" : "API Key"} al sheet ${SHEET_ID.slice(0, 8)}...`,
      mode,
    };
  } catch (err) {
    return {
      connected: false,
      message: err instanceof Error ? err.message : "Error desconocido",
      mode,
    };
  }
}

/**
 * Get an available code from the specified product sheet tab.
 */
export async function getAvailableCode(
  sheetName: string
): Promise<{ code: string; row: number } | null> {
  const mode = getAuthMode();

  if (mode === "apps_script") {
    const result = (await scriptGet("getCode", { sheet: sheetName })) as {
      code?: string;
      row?: number;
      empty?: boolean;
    };
    if (result.empty || !result.code) return null;
    return { code: result.code, row: result.row! };
  }

  const rows = await directReadRange(`${sheetName}!A:D`);
  for (let i = 1; i < rows.length; i++) {
    const code = rows[i]?.[0];
    const status = (rows[i]?.[1] || "").toLowerCase().trim();
    if (code && (!status || status === "disponible" || status === "available")) {
      return { code: code.trim(), row: i + 1 };
    }
  }
  return null;
}

/**
 * Mark a code as delivered in the sheet.
 */
export async function markCodeDelivered(
  sheetName: string,
  row: number,
  orderId: string
): Promise<void> {
  const mode = getAuthMode();

  if (mode === "apps_script") {
    await scriptPost("markDelivered", {
      sheet: sheetName,
      row,
      orderId,
      date: new Date().toISOString(),
    });
    return;
  }

  await directWriteRange(`${sheetName}!B${row}:D${row}`, [
    ["entregado", orderId, new Date().toISOString()],
  ]);
}

/**
 * Get inventory counts for all product sheets.
 */
export async function getInventoryCounts(): Promise<
  Record<string, { available: number; delivered: number }>
> {
  const sheets = ["steam-5", "steam-10", "roblox-10", "roblox-400", "roblox-800"];

  const mode = getAuthMode();

  if (mode === "apps_script") {
    const result = (await scriptGet("inventory")) as {
      counts: Record<string, { available: number; delivered: number }>;
    };
    return result.counts;
  }

  const counts: Record<string, { available: number; delivered: number }> = {};
  for (const sheet of sheets) {
    try {
      const rows = await directReadRange(`${sheet}!A:B`);
      let available = 0;
      let delivered = 0;
      for (let i = 1; i < rows.length; i++) {
        const code = rows[i]?.[0];
        const status = (rows[i]?.[1] || "").toLowerCase().trim();
        if (!code) continue;
        if (!status || status === "disponible" || status === "available") available++;
        else delivered++;
      }
      counts[sheet] = { available, delivered };
    } catch {
      counts[sheet] = { available: 0, delivered: 0 };
    }
  }
  return counts;
}

/**
 * The Google Apps Script code that users paste into their sheet.
 * This is displayed in the SheetsGuide component.
 */
export const APPS_SCRIPT_CODE = `// ===== GIFT CARD BOT - Apps Script =====
// 1. Abri tu Google Sheet
// 2. Menu: Extensiones > Apps Script
// 3. Borra todo el codigo y pega esto
// 4. Click en "Implementar" > "Nueva implementacion"
// 5. Tipo: "App web", Acceso: "Cualquier persona"
// 6. Copia la URL y pegala como GOOGLE_SCRIPT_URL en v0

function doGet(e) {
  var action = e.parameter.action;
  
  if (action === "verify") {
    return jsonResponse(handleVerify());
  }
  if (action === "getCode") {
    return jsonResponse(handleGetCode(e.parameter.sheet));
  }
  if (action === "inventory") {
    return jsonResponse(handleInventory());
  }
  
  return jsonResponse({ error: "Accion no reconocida" });
}

function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  
  if (data.action === "markDelivered") {
    return jsonResponse(handleMarkDelivered(data.sheet, data.row, data.orderId, data.date));
  }
  
  return jsonResponse({ error: "Accion no reconocida" });
}

function handleVerify() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets().map(function(s) { return s.getName(); });
  return { ok: true, sheets: sheets };
}

function handleGetCode(sheetName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { empty: true, error: "Pestana no encontrada: " + sheetName };
  
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var code = data[i][0];
    var status = (data[i][1] || "").toString().toLowerCase().trim();
    if (code && (!status || status === "disponible" || status === "available")) {
      return { code: code.toString().trim(), row: i + 1 };
    }
  }
  return { empty: true };
}

function handleMarkDelivered(sheetName, row, orderId, date) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { ok: false, error: "Pestana no encontrada" };
  
  sheet.getRange(row, 2).setValue("entregado");
  sheet.getRange(row, 3).setValue(orderId);
  sheet.getRange(row, 4).setValue(date);
  return { ok: true };
}

function handleInventory() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ["steam-5", "steam-10", "roblox-10", "roblox-400", "roblox-800"];
  var counts = {};
  
  sheets.forEach(function(name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      counts[name] = { available: 0, delivered: 0 };
      return;
    }
    var data = sheet.getDataRange().getValues();
    var available = 0, delivered = 0;
    for (var i = 1; i < data.length; i++) {
      var code = data[i][0];
      if (!code) continue;
      var status = (data[i][1] || "").toString().toLowerCase().trim();
      if (!status || status === "disponible" || status === "available") available++;
      else delivered++;
    }
    counts[name] = { available: available, delivered: delivered };
  });
  
  return { counts: counts };
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}`;
