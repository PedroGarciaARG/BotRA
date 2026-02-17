"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  KeyRound,
  Save,
  Loader2,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";

interface ConfigField {
  key: string;
  label: string;
  placeholder: string;
  secret: boolean;
  group: "mercadolibre" | "telegram" | "sheets";
}

const CONFIG_FIELDS: ConfigField[] = [
  {
    key: "ML_APP_ID",
    label: "App ID",
    placeholder: "Ej: 8051674180971751",
    secret: false,
    group: "mercadolibre",
  },
  {
    key: "ML_CLIENT_SECRET",
    label: "Client Secret",
    placeholder: "Tu client secret de ML",
    secret: true,
    group: "mercadolibre",
  },
  {
    key: "ML_REFRESH_TOKEN",
    label: "Refresh Token",
    placeholder: "TG-...",
    secret: true,
    group: "mercadolibre",
  },
  {
    key: "TELEGRAM_TOKEN",
    label: "Bot Token",
    placeholder: "123456:ABC-...",
    secret: true,
    group: "telegram",
  },
  {
    key: "TELEGRAM_CHAT_ID",
    label: "Chat ID",
    placeholder: "Ej: 1127444354",
    secret: false,
    group: "telegram",
  },
  {
    key: "GOOGLE_SCRIPT_URL",
    label: "Apps Script URL",
    placeholder: "https://script.google.com/macros/s/.../exec",
    secret: false,
    group: "sheets",
  },
];

export function CredentialsPanel() {
  const [currentValues, setCurrentValues] = useState<Record<string, string>>(
    {}
  );
  const [setStatus, setSetStatus] = useState<Record<string, boolean>>({});
  const [sourceStatus, setSourceStatus] = useState<Record<string, string>>({});
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchConfig();
  }, []);

  async function fetchConfig() {
    try {
      const res = await fetch("/api/config");
      const data = await res.json();
      const vals: Record<string, string> = {};
      const setFlags: Record<string, boolean> = {};
      const sources: Record<string, string> = {};
      for (const field of CONFIG_FIELDS) {
        vals[field.key] = data[field.key] || "";
        setFlags[field.key] = data._set?.[field.key] || false;
        sources[field.key] = data._source?.[field.key] || "missing";
      }
      setCurrentValues(vals);
      setSetStatus(setFlags);
      setSourceStatus(sources);
    } catch {
      toast.error("No se pudo cargar la configuracion");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    const update: Record<string, string> = {};
    for (const [key, value] of Object.entries(formValues)) {
      if (value.trim()) {
        update[key] = value.trim();
      }
    }

    if (Object.keys(update).length === 0) {
      toast.info("No hay cambios para guardar");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update),
      });
      const data = await res.json();

      if (data.success) {
        toast.success(data.message);
        setFormValues({});
        await fetchConfig();
      } else {
        toast.error(data.error || "Error al guardar");
      }
    } catch {
      toast.error("Error de conexion");
    } finally {
      setSaving(false);
    }
  }

  function renderGroup(
    group: "mercadolibre" | "telegram" | "sheets",
    title: string
  ) {
    const fields = CONFIG_FIELDS.filter((f) => f.group === group);
    return (
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {fields.map((field) => {
          const isSet = setStatus[field.key];
          const source = sourceStatus[field.key] || "missing";
          const currentMasked = currentValues[field.key];
          const isSecret = field.secret;
          const isRevealed = showSecrets[field.key];

          return (
            <div key={field.key} className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <Label
                  htmlFor={field.key}
                  className="text-xs text-muted-foreground"
                >
                  {field.label}
                </Label>
                {isSet ? (
                  <Badge
                    variant="secondary"
                    className="h-4 gap-0.5 px-1 text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  >
                    <CheckCircle2 className="h-2.5 w-2.5" />
                    {source === "env" ? "Env" : "Memoria"}
                  </Badge>
                ) : (
                  <Badge
                    variant="secondary"
                    className="h-4 gap-0.5 px-1 text-[10px] bg-red-500/10 text-red-400 border-red-500/20"
                  >
                    <XCircle className="h-2.5 w-2.5" />
                    Falta
                  </Badge>
                )}
                {source === "memoria" && isSet && (
                  <span className="text-[10px] text-amber-400">
                    (temporal, configurala en Netlify)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Input
                    id={field.key}
                    type={isSecret && !isRevealed ? "password" : "text"}
                    placeholder={
                      isSet ? `Actual: ${currentMasked}` : field.placeholder
                    }
                    value={formValues[field.key] || ""}
                    onChange={(e) =>
                      setFormValues((prev) => ({
                        ...prev,
                        [field.key]: e.target.value,
                      }))
                    }
                    className="h-8 text-xs pr-8"
                  />
                  {isSecret && (
                    <button
                      type="button"
                      onClick={() =>
                        setShowSecrets((prev) => ({
                          ...prev,
                          [field.key]: !prev[field.key],
                        }))
                      }
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {isRevealed ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  const hasChanges = Object.values(formValues).some((v) => v.trim());

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="h-4 w-4" />
          Credenciales
        </CardTitle>
        <CardDescription>
          Credenciales de MercadoLibre, Telegram y Google Sheets. Se leen desde
          las variables de entorno del hosting (Netlify, Vercel, etc). Si
          aparecen como &quot;Falta&quot;, configuralas en tu panel de hosting en
          Site Settings &gt; Environment Variables.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {renderGroup("mercadolibre", "MercadoLibre")}
            {renderGroup("telegram", "Telegram")}
            {renderGroup("sheets", "Google Sheets")}

            <Button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="w-full gap-2"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saving ? "Guardando..." : "Guardar cambios"}
            </Button>

            <p className="text-[11px] text-muted-foreground text-center">
              Los cambios desde aqui son temporales (se pierden al reiniciar).
              Para que persistan, configura las variables de entorno en tu
              hosting: Netlify (Site Settings &gt; Environment Variables) o
              Vercel (Settings &gt; Environment Variables).
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
