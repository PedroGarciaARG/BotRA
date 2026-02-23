// In-memory storage for bot state.
// State is reconstructed from ML message history when needed.

export interface PackState {
  packId: string;
  orderId: string;
  sellerId: string;
  buyerId: string;
  productType: string;
  productTitle: string;
  status:
    | "initial_sent"
    | "instructions_sent"
    | "code_sent"
    | "waiting_choice" // Waiting for Premium or Robux choice (Roblox 5 USD only)
    | "premium_sent" // Premium instructions sent
    | "robux_sent" // Robux instructions sent
    | "completed" // Final message sent
    | "cancelled"
    | "human_requested"
    | "waiting_buyer";
  
  // Antifraud tracking
  codigo_enviado?: boolean;
  codigo_enviado_at?: string;
  instrucciones_enviadas?: boolean;
  intentos_reenvio?: number;
  ultimo_mensaje_comprador?: string;
  ultimo_mensaje_comprador_at?: string;
  ultimo_mensaje_hash?: string; // Hash del último mensaje del comprador que procesamos
  
  codeDelivered?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityLog {
  id: string;
  type: "question" | "order" | "message" | "code_delivery" | "error" | "human";
  message: string;
  details?: string;
  timestamp: string;
}

// -- Pack State --
const packStates = new Map<string, PackState>();

export function getPackState(packId: string): PackState | undefined {
  return packStates.get(packId);
}

export function setPackState(packId: string, state: PackState): void {
  packStates.set(packId, state);
}

export function updatePackState(
  packId: string,
  update: Partial<PackState>
): void {
  const current = packStates.get(packId);
  if (current) {
    packStates.set(packId, {
      ...current,
      ...update,
      updatedAt: new Date().toISOString(),
    });
  }
}

export function clearPackState(packId: string): void {
  packStates.delete(packId);
}

export function getAllPackStates(): PackState[] {
  return Array.from(packStates.values());
}

// -- Activity Logs --
const activityLogs: ActivityLog[] = [];
const MAX_LOGS = 200;

export function addActivityLog(
  log: Omit<ActivityLog, "id" | "timestamp">
): void {
  activityLogs.unshift({
    ...log,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
  });
  if (activityLogs.length > MAX_LOGS) {
    activityLogs.length = MAX_LOGS;
  }
}

export function getActivityLogs(limit = 50): ActivityLog[] {
  return activityLogs.slice(0, limit);
}

// -- Stats --
export function getStats() {
  const packs = Array.from(packStates.values());
  return {
    totalOrders: packs.length,
    codesDelivered: packs.filter((p) => p.status === "code_sent").length,
    pendingOrders: packs.filter(
      (p) =>
        p.status !== "code_sent" &&
        p.status !== "cancelled" &&
        p.status !== "human_requested"
    ).length,
    humanRequested: packs.filter((p) => p.status === "human_requested").length,
    questionsAnswered: activityLogs.filter((l) => l.type === "question").length,
  };
}

// -- Token Storage (in-memory, seeded from env vars on cold start) --
let currentAccessToken: string | null = null;
let currentRefreshToken: string | null = null;
let tokenExpiresAt: number = 0;
let sellerId: string | null = null;

// Always seed from env vars on cold start so credentials survive restarts
function ensureRefreshToken(): string | null {
  if (currentRefreshToken) return currentRefreshToken;
  // Fall back to config (reads env vars dynamically)
  const envToken = getConfig().ML_REFRESH_TOKEN;
  if (envToken) {
    currentRefreshToken = envToken;
  }
  return currentRefreshToken;
}

export function getTokens() {
  return {
    accessToken: currentAccessToken,
    refreshToken: ensureRefreshToken(),
    expiresAt: tokenExpiresAt,
    sellerId,
  };
}

export function setTokens(
  accessToken: string,
  refreshToken: string,
  expiresIn: number,
  userId?: string
): void {
  currentAccessToken = accessToken;
  currentRefreshToken = refreshToken;
  tokenExpiresAt = Date.now() + expiresIn * 1000;
  if (userId) sellerId = userId;

  // Keep overrides in sync so getConfig() always returns the latest refresh token
  configOverrides.ML_REFRESH_TOKEN = refreshToken;
}

export function isTokenValid(): boolean {
  return !!currentAccessToken && Date.now() < tokenExpiresAt - 60000;
}

// -- Runtime Config (editable from dashboard) --
interface RuntimeConfig {
  ML_APP_ID: string;
  ML_CLIENT_SECRET: string;
  ML_REFRESH_TOKEN: string;
  TELEGRAM_TOKEN: string;
  TELEGRAM_CHAT_ID: string;
  GOOGLE_SCRIPT_URL: string;
}

// In-memory overrides (set from dashboard UI via setConfig).
// These take priority over process.env when set.
const configOverrides: Partial<RuntimeConfig> = {};

// Keys we track, with alternative env var names for Netlify compatibility.
// Netlify uses MERCADO_LIBRE_* while Vercel uses ML_*.
const CONFIG_KEYS: (keyof RuntimeConfig)[] = [
  "ML_APP_ID", "ML_CLIENT_SECRET", "ML_REFRESH_TOKEN",
  "TELEGRAM_TOKEN", "TELEGRAM_CHAT_ID", "GOOGLE_SCRIPT_URL",
];

const ENV_ALIASES: Record<string, string[]> = {
  ML_APP_ID: ["ML_APP_ID", "MERCADO_LIBRE_APP_ID"],
  ML_CLIENT_SECRET: ["ML_CLIENT_SECRET", "MERCADO_LIBRE_CLIENT_SECRET"],
  ML_REFRESH_TOKEN: ["ML_REFRESH_TOKEN", "MERCADO_LIBRE_REFRESH_TOKEN"],
  TELEGRAM_TOKEN: ["TELEGRAM_TOKEN"],
  TELEGRAM_CHAT_ID: ["TELEGRAM_CHAT_ID"],
  GOOGLE_SCRIPT_URL: ["GOOGLE_SCRIPT_URL"],
};

function readEnvVar(key: string): string {
  const aliases = ENV_ALIASES[key] || [key];
  for (const alias of aliases) {
    const val = (process.env[alias] || "").trim();
    if (val) return val;
  }
  return "";
}

/**
 * Read config dynamically: override (dashboard) > process.env > empty.
 * Supports both ML_* (Vercel) and MERCADO_LIBRE_* (Netlify) env var names.
 */
export function getConfig(): RuntimeConfig {
  const config = {} as RuntimeConfig;
  for (const key of CONFIG_KEYS) {
    const override = configOverrides[key];
    const envVal = readEnvVar(key);
    config[key] = (override || envVal || "");
  }
  return config;
}

export function setConfig(update: Partial<RuntimeConfig>): void {
  for (const [key, value] of Object.entries(update)) {
    if (CONFIG_KEYS.includes(key as keyof RuntimeConfig) && typeof value === "string") {
      configOverrides[key as keyof RuntimeConfig] = value.trim();
    }
  }
  // Sync refresh token to token storage if changed
  if (update.ML_REFRESH_TOKEN && update.ML_REFRESH_TOKEN !== currentRefreshToken) {
    currentRefreshToken = update.ML_REFRESH_TOKEN;
  }
}

// -- Bot Enabled State --
let botEnabled = true;

export function getBotEnabled(): boolean {
  return botEnabled;
}

export function setBotEnabled(enabled: boolean): void {
  botEnabled = enabled;
}
