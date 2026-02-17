"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FileSpreadsheet,
  ExternalLink,
  Copy,
  Check,
  Terminal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { APPS_SCRIPT_CODE } from "@/lib/google-sheets";

const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/18CL9J0juFqhYLy4po-gh3qQ0xWSqOq5_-In87JyCHk0/edit";

const TABS = [
  { name: "steam-5", label: "Steam 5 USD", color: "bg-blue-500/20 text-blue-400" },
  { name: "steam-10", label: "Steam 10 USD", color: "bg-blue-500/20 text-blue-400" },
  { name: "roblox-10", label: "Roblox 10 USD", color: "bg-red-500/20 text-red-400" },
  { name: "roblox-400", label: "Roblox 400 Robux", color: "bg-red-500/20 text-red-400" },
  { name: "roblox-800", label: "Roblox 800 Robux", color: "bg-red-500/20 text-red-400" },
];

export function SheetsGuide() {
  const [copiedTab, setCopiedTab] = useState<string | null>(null);
  const [copiedScript, setCopiedScript] = useState(false);
  const [showScript, setShowScript] = useState(false);

  function copyTabName(name: string) {
    navigator.clipboard.writeText(name);
    setCopiedTab(name);
    setTimeout(() => setCopiedTab(null), 2000);
  }

  function copyScript() {
    navigator.clipboard.writeText(APPS_SCRIPT_CODE);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 3000);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <FileSpreadsheet className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">
          Configuracion de Stock en Google Sheets
        </h2>
      </div>

      {/* Link to sheet */}
      <Card className="border-border bg-card">
        <CardContent className="flex items-center justify-between py-4">
          <div>
            <p className="text-sm font-medium text-foreground">Tu Google Sheet</p>
            <p className="text-xs text-muted-foreground">
              Aca se guardan los codigos de las Gift Cards
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <a href={SHEET_URL} target="_blank" rel="noopener noreferrer">
              Abrir Sheet
              <ExternalLink className="ml-2 h-4 w-4" />
            </a>
          </Button>
        </CardContent>
      </Card>

      {/* Step 1: Tabs */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base">
            Paso 1: Crear las pestanas (tabs)
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Crea una pestana por cada producto con estos nombres exactos:
          </p>
          <div className="flex flex-col gap-2">
            {TABS.map((tab) => (
              <div
                key={tab.name}
                className="flex items-center justify-between rounded-md border border-border bg-secondary/30 px-3 py-2"
              >
                <div className="flex items-center gap-3">
                  <code className="rounded bg-secondary px-2 py-0.5 text-sm font-mono text-foreground">
                    {tab.name}
                  </code>
                  <Badge className={tab.color} variant="secondary">
                    {tab.label}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => copyTabName(tab.name)}
                  aria-label={`Copiar nombre ${tab.name}`}
                >
                  {copiedTab === tab.name ? (
                    <Check className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Step 2: Column structure */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base">
            Paso 2: Estructura de columnas
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            En cada pestana, la fila 1 son los headers. A partir de la fila 2 van los codigos:
          </p>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="px-3 py-2 text-left font-medium text-foreground">
                    A (Codigo)
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-foreground">
                    B (Estado)
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-foreground">
                    C (OrderID)
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-foreground">
                    D (Fecha)
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border">
                  <td className="px-3 py-2 font-mono text-xs text-foreground">
                    XXXX-YYYY-ZZZZ
                  </td>
                  <td className="px-3 py-2 text-xs text-primary">disponible</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground" />
                  <td className="px-3 py-2 text-xs text-muted-foreground" />
                </tr>
                <tr className="border-b border-border">
                  <td className="px-3 py-2 font-mono text-xs text-foreground">
                    AAAA-BBBB-CCCC
                  </td>
                  <td className="px-3 py-2 text-xs text-primary">disponible</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground" />
                  <td className="px-3 py-2 text-xs text-muted-foreground" />
                </tr>
                <tr>
                  <td className="px-3 py-2 font-mono text-xs text-foreground">
                    1111-2222-3333
                  </td>
                  <td className="px-3 py-2 text-xs text-orange-400">entregado</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    987654321
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    2026-02-16
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Step 3: Connect via Apps Script (RECOMMENDED) */}
      <Card className="border-primary/30 bg-card ring-1 ring-primary/20">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">
              Paso 3: Conectar con Apps Script (sin API)
            </CardTitle>
            <Badge variant="secondary" className="bg-primary/20 text-primary">
              Recomendado
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            No necesitas API Key ni Service Account. Solo pegas un codigo en tu sheet y listo.
          </p>

          <ol className="flex flex-col gap-3 text-sm text-muted-foreground">
            <li className="flex gap-2">
              <span className="shrink-0 text-primary font-semibold">1.</span>
              <span>
                Abri tu Google Sheet y anda a{" "}
                <strong className="text-foreground">Extensiones &gt; Apps Script</strong>
              </span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 text-primary font-semibold">2.</span>
              <span>
                Borra todo el codigo que haya y pega el script de abajo
              </span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 text-primary font-semibold">3.</span>
              <span>
                Click en{" "}
                <strong className="text-foreground">Implementar &gt; Nueva implementacion</strong>
              </span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 text-primary font-semibold">4.</span>
              <span>
                Tipo: <strong className="text-foreground">App web</strong> | Acceso:{" "}
                <strong className="text-foreground">Cualquier persona</strong>
              </span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 text-primary font-semibold">5.</span>
              <span>
                Copia la URL que te da y pegala como{" "}
                <code className="rounded bg-secondary px-1 text-xs text-foreground">
                  GOOGLE_SCRIPT_URL
                </code>{" "}
                en la seccion <strong className="text-foreground">Vars</strong> del sidebar
              </span>
            </li>
          </ol>

          {/* Script preview + copy */}
          <div className="rounded-md border border-border bg-secondary/30">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Terminal className="h-3.5 w-3.5" />
                <span>Codigo.gs</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setShowScript(!showScript)}
                >
                  {showScript ? "Ocultar" : "Ver codigo"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={copyScript}
                >
                  {copiedScript ? (
                    <>
                      <Check className="mr-1 h-3 w-3 text-primary" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="mr-1 h-3 w-3" />
                      Copiar codigo
                    </>
                  )}
                </Button>
              </div>
            </div>
            {showScript && (
              <pre className="max-h-80 overflow-auto p-3 text-xs font-mono text-foreground leading-relaxed">
                {APPS_SCRIPT_CODE}
              </pre>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Step 4: How it works */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base">
            Paso 4: Como funciona
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
            <li className="flex gap-2">
              <span className="shrink-0 text-primary font-medium">1.</span>
              <span>
                Carga los codigos en la columna A y escribe{" "}
                <code className="rounded bg-secondary px-1 text-xs text-foreground">
                  disponible
                </code>{" "}
                en la columna B.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 text-primary font-medium">2.</span>
              <span>
                Cuando un comprador confirma, el bot toma el primer codigo{" "}
                <code className="rounded bg-secondary px-1 text-xs text-foreground">
                  disponible
                </code>{" "}
                de la pestana correcta.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 text-primary font-medium">3.</span>
              <span>
                El bot cambia el estado a{" "}
                <code className="rounded bg-secondary px-1 text-xs text-foreground">
                  entregado
                </code>
                , guarda el OrderID y la fecha automaticamente.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 text-primary font-medium">4.</span>
              <span>
                Si se acaban los codigos, el bot avisa y pide atencion humana.
              </span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
