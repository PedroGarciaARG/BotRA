"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  Webhook,
  Play,
} from "lucide-react";
import { toast } from "sonner";

export function WebhookGuide() {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    details?: string;
  } | null>(null);

  const webhookUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/webhook`
      : "/api/webhook";

  function copyUrl() {
    navigator.clipboard.writeText(webhookUrl);
    toast.success("URL copiada");
  }

  async function handleTestWebhook() {
    setTesting(true);
    setTestResult(null);
    try {
      // First check that ML is connected and get recent orders
      const testRes = await fetch("/api/test");
      const testData = await testRes.json();

      if (testData.mercadolibre?.status !== "ok") {
        setTestResult({
          success: false,
          message: "ML no esta conectado",
          details: testData.mercadolibre?.error || "Authenticate first",
        });
        return;
      }

      // Simulate a webhook call to ourselves
      const simRes = await fetch("/api/webhook/simulate", { method: "POST" });
      const simData = await simRes.json();

      if (simData.success) {
        setTestResult({
          success: true,
          message: simData.message || "Webhook procesado correctamente",
          details: simData.details,
        });
      } else {
        setTestResult({
          success: false,
          message: simData.error || "Error en simulacion",
          details: simData.details,
        });
      }
    } catch (err) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : "Error desconocido",
      });
    } finally {
      setTesting(false);
    }
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Webhook className="h-4 w-4" />
          Configurar Webhook de MercadoLibre
        </CardTitle>
        <CardDescription>
          Para que el bot reciba las ventas y mensajes, necesitas configurar esta
          URL en tu aplicacion de ML
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* Step 1: Copy URL */}
        <div className="rounded-md border border-border bg-secondary/20 p-3">
          <p className="text-sm font-medium text-foreground">
            Paso 1: Copia esta URL
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 rounded bg-secondary px-2 py-1.5 text-xs text-foreground break-all">
              {webhookUrl}
            </code>
            <Button
              variant="outline"
              size="sm"
              onClick={copyUrl}
              className="shrink-0 gap-1.5"
            >
              <Copy className="h-3.5 w-3.5" />
              Copiar
            </Button>
          </div>
        </div>

        {/* Step 2: Go to ML DevCenter */}
        <div className="rounded-md border border-border bg-secondary/20 p-3">
          <p className="text-sm font-medium text-foreground">
            Paso 2: Configura en MercadoLibre
          </p>
          <ol className="mt-2 flex flex-col gap-1.5 text-sm text-muted-foreground">
            <li className="flex gap-2">
              <span className="shrink-0 font-medium text-primary">1.</span>
              <span>
                Anda a{" "}
                <a
                  href="https://developers.mercadolibre.com.ar/devcenter"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary underline"
                >
                  ML DevCenter
                  <ExternalLink className="h-3 w-3" />
                </a>
              </span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 font-medium text-primary">2.</span>
              <span>Selecciona tu aplicacion (App ID: {process.env.NEXT_PUBLIC_ML_APP_ID || "tu app"})</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 font-medium text-primary">3.</span>
              <span>
                En la seccion{" "}
                <strong>&quot;Notificaciones&quot;</strong>, pega la URL de
                arriba en{" "}
                <strong>&quot;Callback URL&quot;</strong>
              </span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 font-medium text-primary">4.</span>
              <span>
                Activa los topics:{" "}
                <Badge variant="secondary" className="text-xs">
                  orders_v2
                </Badge>{" "}
                <Badge variant="secondary" className="text-xs">
                  messages
                </Badge>{" "}
                <Badge variant="secondary" className="text-xs">
                  questions
                </Badge>
              </span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 font-medium text-primary">5.</span>
              <span>Guarda los cambios</span>
            </li>
          </ol>
        </div>

        {/* Step 3: Test */}
        <div className="rounded-md border border-border bg-secondary/20 p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">
              Paso 3: Probar que funciona
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestWebhook}
              disabled={testing}
              className="gap-1.5"
            >
              {testing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
              Simular Venta
            </Button>
          </div>

          {testResult && (
            <div
              className={`mt-3 flex items-start gap-2 rounded-md p-2 text-sm ${
                testResult.success
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "bg-red-500/10 text-red-400"
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <div>
                <p className="font-medium">{testResult.message}</p>
                {testResult.details && (
                  <p className="mt-1 text-xs opacity-80">{testResult.details}</p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <p className="text-xs text-amber-300">
            <strong>Importante:</strong> Si estas usando el preview de v0, la
            URL cambia cada vez que se reinicia. Para produccion, necesitas
            hacer deploy en Vercel y usar esa URL permanente.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
