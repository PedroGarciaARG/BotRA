"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare,
  Package,
  Send,
  AlertTriangle,
  User,
} from "lucide-react";

interface ActivityLog {
  id: string;
  type: "question" | "order" | "message" | "code_delivery" | "error" | "human";
  message: string;
  details?: string;
  timestamp: string;
}

const TYPE_CONFIG: Record<
  string,
  { icon: typeof Package; color: string; badgeLabel: string }
> = {
  question: {
    icon: MessageSquare,
    color: "text-chart-3",
    badgeLabel: "Pregunta",
  },
  order: { icon: Package, color: "text-chart-1", badgeLabel: "Orden" },
  message: { icon: Send, color: "text-chart-2", badgeLabel: "Mensaje" },
  code_delivery: {
    icon: Send,
    color: "text-chart-2",
    badgeLabel: "Entrega",
  },
  error: {
    icon: AlertTriangle,
    color: "text-destructive",
    badgeLabel: "Error",
  },
  human: { icon: User, color: "text-chart-4", badgeLabel: "Humano" },
};

function formatTime(ts: string) {
  try {
    const date = new Date(ts);
    return date.toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function ActivityFeed({ logs }: { logs: ActivityLog[] }) {
  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground">Actividad Reciente</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px] px-6 pb-6">
          {logs.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No hay actividad reciente. El bot esta esperando notificaciones.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {logs.map((log) => {
                const config = TYPE_CONFIG[log.type] || TYPE_CONFIG.message;
                const Icon = config.icon;

                return (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 rounded-lg border border-border p-3"
                  >
                    <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${config.color}`} />
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={`text-xs ${config.color} border-current`}
                        >
                          {config.badgeLabel}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatTime(log.timestamp)}
                        </span>
                      </div>
                      <p className="text-sm text-foreground">{log.message}</p>
                      {log.details && (
                        <p className="truncate text-xs text-muted-foreground">
                          {log.details}
                        </p>
                      )}
                    </div>
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
