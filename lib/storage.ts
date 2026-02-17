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
    | "cancelled"
    | "human_requested";
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
  // Fall back to runtime config (which reads from env vars)
  const envToken = runtimeConfig.ML_REFRESH_TOKEN;
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

  // Keep runtimeConfig in sync so getConfig() always returns the latest refresh token
  runtimeConfig.ML_REFRESH_TOKEN = refreshToken;
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

// Defaults are used when env vars are not set (e.g. Netlify deploys).
// Env vars override these defaults when present (e.g. Vercel deploys).
const DEFAULTS: RuntimeConfig = {
  ML_APP_ID: "8051674180971751",
  ML_CLIENT_SECRET: "0p489jUdgA3WcHnkevaO3AZkJzhdRpso",
  ML_REFRESH_TOKEN: "TG-699217bc16b9db00011a7573-77421292",
  TELEGRAM_TOKEN: "8505225408:AAE3tl54LKPzipi9VYeKnWEeT9M6QvweYuU",
  TELEGRAM_CHAT_ID: "1127444354",
  GOOGLE_SCRIPT_URL:
    "https://script.google.com/macros/s/AKfycbwPk12BlYqKSS-bLZMM3D9PeT2B5yd5sV0qAxmNuEBWev2ub0-O5GTcTVflmFqfdzcgAg/exec",
};

const runtimeConfig: RuntimeConfig = {
  ML_APP_ID: process.env.ML_APP_ID || DEFAULTS.ML_APP_ID,
  ML_CLIENT_SECRET: process.env.ML_CLIENT_SECRET || DEFAULTS.ML_CLIENT_SECRET,
  ML_REFRESH_TOKEN: process.env.ML_REFRESH_TOKEN || DEFAULTS.ML_REFRESH_TOKEN,
  TELEGRAM_TOKEN: process.env.TELEGRAM_TOKEN || DEFAULTS.TELEGRAM_TOKEN,
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID || DEFAULTS.TELEGRAM_CHAT_ID,
  GOOGLE_SCRIPT_URL: process.env.GOOGLE_SCRIPT_URL || DEFAULTS.GOOGLE_SCRIPT_URL,
};

export function getConfig(): RuntimeConfig {
  return { ...runtimeConfig };
}

export function setConfig(update: Partial<RuntimeConfig>): void {
  for (const [key, value] of Object.entries(update)) {
    if (key in runtimeConfig && typeof value === "string") {
      (runtimeConfig as Record<string, string>)[key] = value;
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
