"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Send, Clock, User } from "lucide-react";

interface Stats {
  totalOrders: number;
  codesDelivered: number;
  pendingOrders: number;
  humanRequested: number;
  questionsAnswered: number;
}

export function StatsCards({ stats }: { stats: Stats }) {
  const cards = [
    {
      title: "Ordenes Totales",
      value: stats.totalOrders,
      icon: Package,
      color: "text-chart-1",
    },
    {
      title: "Codigos Entregados",
      value: stats.codesDelivered,
      icon: Send,
      color: "text-chart-2",
    },
    {
      title: "Pendientes",
      value: stats.pendingOrders,
      icon: Clock,
      color: "text-chart-4",
    },
    {
      title: "Atencion Humana",
      value: stats.humanRequested,
      icon: User,
      color: "text-chart-5",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title} className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <card.icon className={`h-4 w-4 ${card.color}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${card.color}`}>
              {card.value}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
