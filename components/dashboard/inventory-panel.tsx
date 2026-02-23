"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface InventoryData {
  [key: string]: { available: number; delivered: number };
}

const PRODUCT_LABELS: Record<string, string> = {
  "steam-5": "Steam 5 USD",
  "steam-10": "Steam 10 USD",
  "steam-20": "Steam 20 USD",
  "roblox-5": "Roblox 5 USD",
  "roblox-10": "Roblox 10 USD",
  "roblox-400": "Roblox 400 Robux",
  "roblox-800": "Roblox 800 Robux",
};

const PRODUCT_COLORS: Record<string, string> = {
  "steam-5": "bg-chart-3",
  "steam-10": "bg-chart-3",
  "steam-20": "bg-chart-3",
  "roblox-5": "bg-chart-5",
  "roblox-10": "bg-chart-5",
  "roblox-400": "bg-chart-5",
  "roblox-800": "bg-chart-5",
};

export function InventoryPanel({
  inventory,
  loading,
}: {
  inventory: InventoryData | null;
  loading: boolean;
}) {
  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground">Inventario de Codigos</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-12 animate-pulse rounded-md bg-secondary"
              />
            ))}
          </div>
        ) : inventory ? (
          <div className="flex flex-col gap-4">
            {Object.entries(inventory).map(([key, data]) => {
              const total = data.available + data.delivered;
              const percent = total > 0 ? (data.available / total) * 100 : 0;
              const label = PRODUCT_LABELS[key] || key;
              const isLow = data.available <= 3;

              return (
                <div key={key} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">
                      {label}
                    </span>
                    <div className="flex items-center gap-2">
                      {isLow && data.available > 0 && (
                        <Badge
                          variant="outline"
                          className="border-chart-4 text-chart-4 text-xs"
                        >
                          Stock bajo
                        </Badge>
                      )}
                      {data.available === 0 && (
                        <Badge
                          variant="outline"
                          className="border-destructive text-destructive text-xs"
                        >
                          Sin stock
                        </Badge>
                      )}
                      <span className="text-sm tabular-nums text-muted-foreground">
                        {data.available} / {total}
                      </span>
                    </div>
                  </div>
                  <Progress
                    value={percent}
                    className={`h-2 ${PRODUCT_COLORS[key] || "bg-primary"}`}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No se pudo cargar el inventario. Verifica la conexion con Google
            Sheets.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
