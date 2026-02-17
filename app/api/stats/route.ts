// Dashboard stats endpoint

import { NextResponse } from "next/server";
import { getStats, getActivityLogs, getAllPackStates, isTokenValid, getBotEnabled, getTokens } from "@/lib/storage";
import { getAccessToken } from "@/lib/mercadolibre/auth";

export async function GET() {
  const stats = getStats();
  const logs = getActivityLogs(50);
  const packs = getAllPackStates();

  // Try to authenticate if we have a refresh token but no valid access token
  let authenticated = isTokenValid();
  let authError: string | null = null;

  if (!authenticated) {
    try {
      await getAccessToken();
      authenticated = true;
      authError = null;
    } catch (error) {
      authenticated = false;
      authError = error instanceof Error ? error.message : "Error desconocido";
    }
  }

  const { expiresAt: tokenExpiresAt } = getTokens();

  return NextResponse.json({
    authenticated,
    authError,
    botEnabled: getBotEnabled(),
    tokenExpiresAt,
    stats,
    recentActivity: logs,
    activePacks: packs
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )
      .slice(0, 20),
  });
}
