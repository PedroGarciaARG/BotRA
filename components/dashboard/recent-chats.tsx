"use client";

import { useState } from "react";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  MessageCircle,
  Loader2,
  ChevronRight,
  ChevronLeft,
  User,
  Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface ChatSummary {
  orderId: number;
  packId: number;
  hasRealPack: boolean;
  status: string;
  dateCreated: string;
  productTitle: string;
  buyerNickname: string;
  unitPrice: number;
}

interface ChatMessage {
  id: string;
  fromUserId: string;
  text: string;
  createdAt: string;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusBadge(status: string) {
  switch (status) {
    case "paid":
      return (
        <Badge variant="default" className="text-[10px]">
          Pagado
        </Badge>
      );
    case "confirmed":
      return (
        <Badge variant="default" className="text-[10px]">
          Confirmado
        </Badge>
      );
    case "cancelled":
      return (
        <Badge variant="destructive" className="text-[10px]">
          Cancelado
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary" className="text-[10px]">
          {status}
        </Badge>
      );
  }
}

// Inline chat messages viewer
function InlineChatMessages({
  packId,
  sellerId,
  hasRealPack,
}: {
  packId: number;
  sellerId: string | null;
  hasRealPack: boolean;
}) {
  const chatUrl = hasRealPack
    ? `/api/chats/${packId}`
    : `/api/chats/${packId}?type=order`;

  const { data, isLoading, error } = useSWR(chatUrl, fetcher);

  const messages: ChatMessage[] = data?.messages || [];
  const resolvedSellerId = sellerId || data?.sellerId || "";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || messages.length === 0) {
    return (
      <p className="py-3 text-center text-xs text-muted-foreground">
        {error ? "Error al cargar mensajes" : "Sin mensajes"}
      </p>
    );
  }

  return (
    <ScrollArea className="max-h-72">
      <div className="flex flex-col gap-1.5 py-2">
        {messages.map((msg) => {
          const isSeller = msg.fromUserId === resolvedSellerId;
          return (
            <div
              key={msg.id}
              className={cn(
                "flex items-start gap-2 max-w-[90%]",
                isSeller ? "self-end flex-row-reverse" : "self-start"
              )}
            >
              <div
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full mt-0.5",
                  isSeller
                    ? "bg-primary/20 text-primary"
                    : "bg-secondary text-muted-foreground"
                )}
              >
                {isSeller ? (
                  <Bot className="h-3 w-3" />
                ) : (
                  <User className="h-3 w-3" />
                )}
              </div>
              <div
                className={cn(
                  "rounded-lg px-2.5 py-1.5 text-xs leading-relaxed",
                  isSeller
                    ? "bg-primary/10 text-foreground rounded-tr-sm"
                    : "bg-secondary text-secondary-foreground rounded-tl-sm"
                )}
              >
                <p className="whitespace-pre-wrap break-words line-clamp-4">
                  {msg.text}
                </p>
                <span className="mt-0.5 block text-[10px] text-muted-foreground opacity-70">
                  {formatTime(msg.createdAt)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}

export function RecentChats() {
  const { data, isLoading } = useSWR(
    "/api/chats?offset=0&limit=5",
    fetcher,
    { refreshInterval: 15000 }
  );
  const [expandedPackId, setExpandedPackId] = useState<number | null>(null);

  const chats: ChatSummary[] = data?.chats || [];

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center gap-2 pb-3">
        <MessageCircle className="h-4 w-4 text-primary" />
        <CardTitle className="text-foreground">
          Conversaciones Recientes
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[430px] px-4 pb-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : chats.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No hay conversaciones recientes.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {chats.map((chat) => {
                const isExpanded = expandedPackId === chat.packId;

                return (
                  <div
                    key={chat.orderId}
                    className="rounded-lg border border-border overflow-hidden"
                  >
                    {/* Chat summary row */}
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedPackId(isExpanded ? null : chat.packId)
                      }
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-secondary/30"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium text-foreground">
                            {chat.productTitle}
                          </p>
                          {statusBadge(chat.status)}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs text-muted-foreground">
                            {chat.buyerNickname}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(chat.dateCreated)}
                          </span>
                        </div>
                      </div>
                      {isExpanded ? (
                        <ChevronLeft className="h-4 w-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                    </button>

                    {/* Expanded: show messages inline */}
                    {isExpanded && (
                      <div className="border-t border-border bg-secondary/10 px-3 pb-2">
                        <InlineChatMessages
                          packId={chat.packId}
                          sellerId={null}
                          hasRealPack={chat.hasRealPack}
                        />
                      </div>
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
