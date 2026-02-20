"use client";

import useSWR from "swr";
import { useCallback, useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";
import { ConnectionStatus } from "@/components/dashboard/connection-status";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { InventoryPanel } from "@/components/dashboard/inventory-panel";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { ActiveOrders } from "@/components/dashboard/active-orders";
import { QuestionsPanel } from "@/components/dashboard/questions-panel";
import { ChatsPanel } from "@/components/dashboard/chats-panel";
import { SheetsGuide } from "@/components/dashboard/sheets-guide";
import { WebhookGuide } from "@/components/dashboard/webhook-guide";
import { CredentialsPanel } from "@/components/dashboard/credentials-panel";
import { RecentChats } from "@/components/dashboard/recent-chats";
import {
  LayoutDashboard,
  MessageSquare,
  MessageCircle,
  Settings,
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function DashboardPage() {
  const {
    data: statsData,
    mutate: refreshStats,
    isValidating: statsValidating,
  } = useSWR("/api/stats", fetcher, { refreshInterval: 10000 });

  const {
    data: inventoryData,
    isLoading: inventoryLoading,
    mutate: refreshInventory,
  } = useSWR("/api/inventory", fetcher, { refreshInterval: 30000 });

  const handleRefresh = useCallback(() => {
    refreshStats();
    refreshInventory();
  }, [refreshStats, refreshInventory]);

  const [botEnabledLocal, setBotEnabledLocal] = useState<boolean | null>(null);

  // Sync botEnabledLocal with server value only on first load
  useEffect(() => {
    if (botEnabledLocal === null && statsData?.botEnabled !== undefined) {
      setBotEnabledLocal(statsData.botEnabled);
    }
  }, []); // Only run once on mount

  const handleBotToggle = useCallback((enabled: boolean) => {
    setBotEnabledLocal(enabled);
  }, []);

  const stats = statsData?.stats || {
    totalOrders: 0,
    codesDelivered: 0,
    pendingOrders: 0,
    humanRequested: 0,
    questionsAnswered: 0,
  };

  const logs = statsData?.recentActivity || [];
  const packs = statsData?.activePacks || [];
  const authenticated = statsData?.authenticated || false;
  const authError = statsData?.authError || null;
  const botEnabled = botEnabledLocal !== null ? botEnabledLocal : (statsData?.botEnabled ?? true);
  const tokenExpiresAt = statsData?.tokenExpiresAt ?? undefined;

  // Auto-check for new messages every 15 seconds (since ML webhooks may not work for messages)
  useEffect(() => {
    if (!authenticated || !botEnabled) return;

    const checkMessages = async () => {
      try {
        await fetch("/api/check-messages", { method: "POST" });
      } catch (err) {
        console.log("[v0] Auto check-messages failed:", err);
      }
    };

    // Check immediately on mount
    checkMessages();

    // Then check every 15 seconds
    const interval = setInterval(checkMessages, 15000);
    return () => clearInterval(interval);
  }, [authenticated, botEnabled]);

  return (
    <main className="min-h-screen bg-background px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl text-balance">
            Roblox Argentina Bot
          </h1>
        <ConnectionStatus
          authenticated={authenticated}
          authError={authError}
          botEnabled={botEnabled}
          tokenExpiresAt={tokenExpiresAt}
          onRefresh={handleRefresh}
          refreshing={statsValidating}
          onBotToggle={handleBotToggle}
        />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="panel" className="w-full">
          <TabsList className="w-full justify-start bg-secondary/50 border border-border">
            <TabsTrigger
              value="panel"
              className="flex items-center gap-1.5 data-[state=active]:bg-background"
            >
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden sm:inline">Panel</span>
            </TabsTrigger>
            <TabsTrigger
              value="preguntas"
              className="flex items-center gap-1.5 data-[state=active]:bg-background"
            >
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Preguntas</span>
            </TabsTrigger>
            <TabsTrigger
              value="chats"
              className="flex items-center gap-1.5 data-[state=active]:bg-background"
            >
              <MessageCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Chats</span>
            </TabsTrigger>
            <TabsTrigger
              value="config"
              className="flex items-center gap-1.5 data-[state=active]:bg-background"
            >
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Config</span>
            </TabsTrigger>
          </TabsList>

          {/* Panel Tab */}
          <TabsContent value="panel" className="mt-4 flex flex-col gap-6">
            <StatsCards stats={stats} />

            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-1 flex flex-col gap-6">
                <InventoryPanel
                  inventory={inventoryData?.inventory || null}
                  loading={inventoryLoading}
                />
              </div>
              <div className="lg:col-span-2">
                <RecentChats />
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <ActivityFeed logs={logs} />
              <ActiveOrders packs={packs} />
            </div>
          </TabsContent>

          {/* Preguntas Tab */}
          <TabsContent value="preguntas" className="mt-4">
            <QuestionsPanel />
          </TabsContent>

          {/* Chats Tab */}
          <TabsContent value="chats" className="mt-4">
            <ChatsPanel />
          </TabsContent>

          {/* Config Tab */}
          <TabsContent value="config" className="mt-4 flex flex-col gap-6">
            <CredentialsPanel />
            <WebhookGuide />
            <SheetsGuide />
          </TabsContent>
        </Tabs>
      </div>
      <Toaster position="bottom-right" richColors />
    </main>
  );
}
