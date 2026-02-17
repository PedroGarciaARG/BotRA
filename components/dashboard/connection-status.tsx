"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  RefreshCw,
  Wifi,
  WifiOff,
  Sheet,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Loader2,
  Stethoscope,
} from "lucide-react";
import { toast } from "sonner";

export function ConnectionStatus({
  authenticated,
  authError,
  botEnabled,
  tokenExpiresAt,
  onRefresh,
  refreshing,
  onBotToggle,
}: {
  authenticated: boolean;
  authError?: string | null;
  botEnabled: boolean;
  tokenExpiresAt?: number;
  onRefresh: () => void;
  refreshing: boolean;
  onBotToggle: (enabled: boolean) => void;
}) {
  const [sheetsStatus, setSheetsStatus] = useState<
    "idle" | "checking" | "connected" | "error"
  >("idle");
  const [sheetsMessage, setSheetsMessage] = useState<string | null>(null);
  const [refreshingToken, setRefreshingToken] = useState(false);
  const [togglingBot, setTogglingBot] = useState(false);
  const [runningDiag, setRunningDiag] = useState(false);

  async function handleVerifySheets() {
    setSheetsStatus("checking");
    setSheetsMessage(null);
    try {
      const res = await fetch("/api/sheets/verify");
      const data = await res.json();
      if (data.connected) {
        setSheetsStatus("connected");
        setSheetsMessage(data.message);
        toast.success("Google Sheets conectado", {
          description: data.message,
        });
      } else {
        setSheetsStatus("error");
        setSheetsMessage(data.message);
        toast.error("Error de conexion con Google Sheets", {
          description: data.message,
        });
      }
    } catch {
      setSheetsStatus("error");
      setSheetsMessage("No se pudo conectar");
      toast.error("Error verificando Google Sheets");
    }
  }

  async function handleToggleBot(checked: boolean) {
    setTogglingBot(true);
    try {
      const res = await fetch("/api/bot/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: checked }),
      });
      const data = await res.json();
      if (data.error) {
        toast.error("Error al cambiar estado del bot", {
          description: data.error,
        });
      } else {
        onBotToggle(data.enabled);
        toast.success(data.enabled ? "Bot activado" : "Bot pausado");
      }
    } catch {
      toast.error("Error al cambiar estado del bot");
    } finally {
      setTogglingBot(false);
    }
  }

  async function handleRefreshToken() {
    setRefreshingToken(true);
    try {
      const res = await fetch("/api/auth/mercadolibre/refresh", {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Token refrescado", {
          description: `Valido hasta: ${new Date(data.expiresAt).toLocaleString("es-AR")}`,
        });
        onRefresh();
      } else {
        toast.error("Error al refrescar token", {
          description: data.error,
        });
      }
    } catch {
      toast.error("Error al refrescar token");
    } finally {
      setRefreshingToken(false);
    }
  }

  async function handleRunDiagnostic() {
    setRunningDiag(true);
    try {
      const res = await fetch("/api/test");
      const data = await res.json();

      const envOk = data.envVars
        ? Object.entries(data.envVars)
            .filter(([, v]) => !v)
            .map(([k]) => k)
        : [];
      const mlOk = data.mercadolibre?.status === "ok";
      const sheetsOk = data.googleSheets?.connected === true;

      const lines: string[] = [];

      if (envOk.length > 0) {
        lines.push(`Variables faltantes: ${envOk.join(", ")}`);
      } else {
        lines.push("Todas las variables de entorno OK");
      }

      if (mlOk) {
        const nick = data.mercadolibre?.nickname || "desconocido";
        lines.push(`ML conectado como: ${nick} (ID: ${data.mercadolibre?.sellerId || data.mercadolibre?.userId})`);
      } else {
        lines.push(`ML error: ${data.mercadolibre?.error || "desconocido"}`);
      }

      if (sheetsOk) {
        lines.push(`Sheets: ${data.googleSheets?.message || "OK"}`);
      } else {
        lines.push(`Sheets: ${data.googleSheets?.message || data.googleSheets?.error || "no conectado"}`);
      }

      lines.push(`Bot: ${data.botEnabled ? "ACTIVO" : "PAUSADO"}`);

      if (mlOk && sheetsOk && envOk.length === 0) {
        toast.success("Todo funciona correctamente", {
          description: lines.join("\n"),
          duration: 8000,
        });
      } else {
        toast.warning("Hay problemas por resolver", {
          description: lines.join("\n"),
          duration: 10000,
        });
      }
    } catch {
      toast.error("No se pudo ejecutar diagnostico");
    } finally {
      setRunningDiag(false);
    }
  }

  const tokenExpiry = tokenExpiresAt
    ? new Date(tokenExpiresAt).toLocaleString("es-AR", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
      })
    : null;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Google Sheets status */}
      <Badge
        variant="outline"
        className={
          sheetsStatus === "connected"
            ? "cursor-pointer border-chart-2 text-chart-2"
            : sheetsStatus === "error"
              ? "cursor-pointer border-destructive text-destructive"
              : "cursor-pointer border-muted-foreground text-muted-foreground"
        }
        onClick={handleVerifySheets}
      >
        {sheetsStatus === "checking" ? (
          <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
        ) : (
          <Sheet className="mr-1.5 h-3 w-3" />
        )}
        {sheetsStatus === "connected"
          ? "Sheets OK"
          : sheetsStatus === "error"
            ? "Sheets Error"
            : sheetsStatus === "checking"
              ? "Verificando..."
              : "Verificar Sheets"}
      </Badge>

      {/* ML connection status */}
      <Badge
        variant="outline"
        className={
          authenticated
            ? "border-chart-2 text-chart-2"
            : "border-destructive text-destructive"
        }
      >
        {authenticated ? (
          <Wifi className="mr-1.5 h-3 w-3" />
        ) : (
          <WifiOff className="mr-1.5 h-3 w-3" />
        )}
        {authenticated ? "ML Conectado" : "ML Desconectado"}
      </Badge>

      {/* Token expiry + refresh */}
      {authenticated && (
        <div className="flex items-center gap-1.5">
          {tokenExpiry && (
            <span className="text-xs text-muted-foreground">
              Exp: {tokenExpiry}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefreshToken}
            disabled={refreshingToken}
            className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            {refreshingToken ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <KeyRound className="h-3 w-3" />
            )}
            Refrescar Token
          </Button>
        </div>
      )}

      {/* Connect ML button when not authenticated */}
      {!authenticated && (
        <Button variant="outline" size="sm" asChild>
          <a href="/api/auth/mercadolibre">Conectar MercadoLibre</a>
        </Button>
      )}

      {authError && (
        <div className="flex items-center gap-2">
          <span className="max-w-xs truncate text-xs text-destructive">
            {authError}
          </span>
          {authenticated && (authError.includes("invalid_client") || authError.includes("invalid_grant") || authError.includes("Token refresh failed")) && (
            <Button variant="destructive" size="sm" asChild>
              <a href="/api/auth/mercadolibre">Re-autenticar ML</a>
            </Button>
          )}
        </div>
      )}

      {/* Bot toggle */}
      <div className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5">
        {botEnabled ? (
          <ShieldCheck className="h-3.5 w-3.5 text-chart-2" />
        ) : (
          <ShieldAlert className="h-3.5 w-3.5 text-destructive" />
        )}
        <Label
          htmlFor="bot-toggle"
          className="cursor-pointer text-xs font-medium"
        >
          {botEnabled ? "Bot Activo" : "Bot Pausado"}
        </Label>
        <Switch
          id="bot-toggle"
          checked={botEnabled}
          onCheckedChange={handleToggleBot}
          disabled={togglingBot}
        />
      </div>

      {/* Diagnostic */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleRunDiagnostic}
        disabled={runningDiag}
        className="h-8 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
      >
        {runningDiag ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Stethoscope className="h-3.5 w-3.5" />
        )}
        Diagnostico
      </Button>

      {/* Refresh data */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onRefresh}
        disabled={refreshing}
        className="h-8 w-8 text-muted-foreground hover:text-foreground"
      >
        <RefreshCw
          className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
        />
        <span className="sr-only">Actualizar datos</span>
      </Button>
    </div>
  );
}
