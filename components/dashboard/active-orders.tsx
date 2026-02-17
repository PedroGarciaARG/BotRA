"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface PackState {
  packId: string;
  orderId: string;
  productType: string;
  productTitle: string;
  status: string;
  codeDelivered?: string;
  createdAt: string;
  updatedAt: string;
}

const STATUS_MAP: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  initial_sent: { label: "Esperando respuesta", variant: "outline" },
  instructions_sent: { label: "Instrucciones enviadas", variant: "secondary" },
  code_sent: { label: "Codigo entregado", variant: "default" },
  cancelled: { label: "Cancelado", variant: "destructive" },
  human_requested: { label: "Atencion humana", variant: "destructive" },
};

const PRODUCT_SHORT: Record<string, string> = {
  "steam-5": "Steam 5",
  "steam-10": "Steam 10",
  "roblox-10": "Roblox 10",
  "roblox-400": "Roblox 400",
  "roblox-800": "Roblox 800",
};

function formatDate(ts: string) {
  try {
    const date = new Date(ts);
    return date.toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function ActiveOrders({ packs }: { packs: PackState[] }) {
  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground">Ordenes Activas</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px] px-6 pb-6">
          {packs.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No hay ordenes activas. Las ordenes apareceran cuando los
              compradores realicen compras.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {packs.map((pack) => {
                const statusInfo = STATUS_MAP[pack.status] || {
                  label: pack.status,
                  variant: "outline" as const,
                };
                const productLabel =
                  PRODUCT_SHORT[pack.productType] || pack.productType;

                return (
                  <div
                    key={pack.packId}
                    className="flex items-center justify-between rounded-lg border border-border p-3"
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {productLabel}
                        </span>
                        <Badge variant={statusInfo.variant}>
                          {statusInfo.label}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Pack: {pack.packId} | {formatDate(pack.updatedAt)}
                      </span>
                    </div>
                    {pack.codeDelivered && (
                      <span className="font-mono text-xs text-muted-foreground">
                        {pack.codeDelivered.slice(0, 4)}...
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
