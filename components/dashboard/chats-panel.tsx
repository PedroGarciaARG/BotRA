"use client";

import { useState } from "react";
import useSWR from "swr";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  MessageCircle,
  ChevronDown,
  Loader2,
  ArrowLeft,
  PackageCheck,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface ChatSummary {
  orderId: number;
  packId: number;
  status: string;
  dateCreated: string;
  productTitle: string;
  productItemId: string;
  unitPrice: number;
  buyerNickname: string;
  buyerId: number;
  shipmentId: number | null;
  isPaid: boolean;
}

interface ChatMessage {
  id: string;
  fromUserId: string;
  fromRole: string;
  toUserId: string;
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

function statusLabel(status: string) {
  switch (status) {
    case "paid":
      return { text: "Pagado", variant: "default" as const };
    case "confirmed":
      return { text: "Confirmado", variant: "default" as const };
    case "cancelled":
      return { text: "Cancelado", variant: "destructive" as const };
    default:
      return { text: status, variant: "secondary" as const };
  }
}

// ---- Chat List (left column) ----

function ChatList({
  onSelectChat,
  selectedPackId,
}: {
  onSelectChat: (chat: ChatSummary) => void;
  selectedPackId: number | null;
}) {
  const [offset, setOffset] = useState(0);
  const [allChats, setAllChats] = useState<ChatSummary[]>([]);
  const limit = 30;

  const { data, isLoading } = useSWR(
    `/api/chats?offset=${offset}&limit=${limit}`,
    fetcher,
    {
      onSuccess: (newData) => {
        if (newData.chats && offset > 0) {
          setAllChats((prev) => {
            const existingIds = new Set(prev.map((c) => c.orderId));
            const unique = newData.chats.filter(
              (c: ChatSummary) => !existingIds.has(c.orderId)
            );
            return [...prev, ...unique];
          });
        } else if (newData.chats && offset === 0) {
          setAllChats(newData.chats);
        }
      },
    }
  );

  const chats = offset === 0 ? data?.chats || [] : allChats;
  const total = data?.total || 0;
  const hasMore = chats.length < total;

  if (isLoading && offset === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (chats.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-muted-foreground">No hay ventas todavia.</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[calc(100vh-220px)]">
      <div className="flex flex-col gap-1 pr-2">
        {chats.map((chat: ChatSummary) => {
          const st = statusLabel(chat.status);
          const isSelected = selectedPackId === chat.packId;

          return (
            <button
              key={chat.orderId}
              type="button"
              onClick={() => onSelectChat(chat)}
              className={cn(
                "flex w-full flex-col gap-1 rounded-lg border border-transparent px-3 py-2.5 text-left transition-colors",
                isSelected
                  ? "border-primary/30 bg-primary/10"
                  : "hover:bg-secondary/50"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="line-clamp-1 text-sm font-medium text-foreground">
                  {chat.productTitle}
                </p>
                <Badge variant={st.variant} className="shrink-0 text-[10px]">
                  {st.text}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <User className="h-3 w-3" />
                  {chat.buyerNickname}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(chat.dateCreated)}
                </span>
              </div>
            </button>
          );
        })}

        {hasMore && (
          <Button
            variant="ghost"
            size="sm"
            className="mx-auto mt-2"
            onClick={() => setOffset((prev) => prev + limit)}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ChevronDown className="mr-2 h-4 w-4" />
            )}
            Cargar mas ventas ({chats.length} de {total})
          </Button>
        )}
      </div>
    </ScrollArea>
  );
}

// ---- Chat Detail (right column) ----

function ChatDetail({
  chat,
  onBack,
}: {
  chat: ChatSummary;
  onBack: () => void;
}) {
  const [delivering, setDelivering] = useState(false);
  const [delivered, setDelivered] = useState(false);

  const { data, error, isLoading } = useSWR(
    `/api/chats/${chat.packId}`,
    fetcher
  );

  const messages: ChatMessage[] = data?.messages || [];
  const sellerId = data?.sellerId || "";

  async function handleDeliver() {
    setDelivering(true);
    try {
      const res = await fetch(`/api/chats/${chat.packId}/deliver`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: chat.orderId,
          shipmentId: chat.shipmentId,
        }),
      });
      if (res.ok) {
        setDelivered(true);
      } else {
        const err = await res.json();
        alert(`Error: ${err.error || "No se pudo marcar entregado"}`);
      }
    } catch {
      alert("Error de conexion");
    } finally {
      setDelivering(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-220px)] flex-col">
      {/* Chat header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 lg:hidden"
          onClick={onBack}
          aria-label="Volver a la lista"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {chat.productTitle}
          </p>
          <p className="text-xs text-muted-foreground">
            {chat.buyerNickname} -- Orden #{chat.orderId}
          </p>
        </div>
        {!delivered && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleDeliver}
            disabled={delivering}
            className="shrink-0"
          >
            {delivering ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <PackageCheck className="mr-2 h-4 w-4" />
            )}
            Marcar Entregado
          </Button>
        )}
        {delivered && (
          <Badge className="bg-primary/20 text-primary">Entregado</Badge>
        )}
      </div>

      {/* Messages area */}
      <ScrollArea className="flex-1 px-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-destructive">
              Error al cargar mensajes
            </p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-muted-foreground">
              No hay mensajes en esta conversacion.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 py-4">
            {messages.map((msg) => {
              const isSeller = msg.fromUserId === sellerId;
              return (
                <div
                  key={msg.id}
                  className={cn(
                    "flex flex-col max-w-[85%]",
                    isSeller ? "self-end items-end" : "self-start items-start"
                  )}
                >
                  <div
                    className={cn(
                      "rounded-xl px-3 py-2 text-sm leading-relaxed",
                      isSeller
                        ? "bg-primary/20 text-foreground rounded-br-sm"
                        : "bg-secondary text-secondary-foreground rounded-bl-sm"
                    )}
                  >
                    <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                  </div>
                  <span className="mt-0.5 text-[10px] text-muted-foreground px-1">
                    {formatTime(msg.createdAt)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

// ---- Main Chats Panel ----

export function ChatsPanel() {
  const [selectedChat, setSelectedChat] = useState<ChatSummary | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <MessageCircle className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">
          Chats Post-Venta
        </h2>
      </div>

      <Card className="border-border bg-card overflow-hidden">
        <CardContent className="p-0">
          <div className="flex">
            {/* Left: Chat list */}
            <div
              className={cn(
                "w-full border-r border-border lg:w-[380px] lg:block",
                selectedChat ? "hidden lg:block" : "block"
              )}
            >
              <ChatList
                onSelectChat={setSelectedChat}
                selectedPackId={selectedChat?.packId ?? null}
              />
            </div>

            {/* Right: Chat detail */}
            <div
              className={cn(
                "flex-1",
                selectedChat ? "block" : "hidden lg:block"
              )}
            >
              {selectedChat ? (
                <ChatDetail
                  chat={selectedChat}
                  onBack={() => setSelectedChat(null)}
                />
              ) : (
                <div className="flex h-[calc(100vh-220px)] items-center justify-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <MessageCircle className="h-10 w-10 opacity-30" />
                    <p className="text-sm">
                      Selecciona una conversacion para ver los mensajes
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
