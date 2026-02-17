"use client";

import { useState } from "react";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, ExternalLink, ChevronDown, Loader2 } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Question {
  id: number;
  text: string;
  answer: { text: string; date_created: string } | null;
  item_id: string;
  date_created: string;
  status: string;
  from: { id: number };
}

export function QuestionsPanel() {
  const [offset, setOffset] = useState(0);
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const limit = 20;

  const { data, error, isLoading } = useSWR(
    `/api/questions?offset=${offset}&limit=${limit}`,
    fetcher,
    {
      onSuccess: (newData) => {
        if (newData.questions && offset > 0) {
          setAllQuestions((prev) => {
            const existingIds = new Set(prev.map((q) => q.id));
            const unique = newData.questions.filter(
              (q: Question) => !existingIds.has(q.id)
            );
            return [...prev, ...unique];
          });
        } else if (newData.questions && offset === 0) {
          setAllQuestions(newData.questions);
        }
      },
    }
  );

  const questions = offset === 0 ? data?.questions || [] : allQuestions;
  const total = data?.total || 0;
  const hasMore = questions.length < total;

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (error) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="flex items-center justify-center py-12">
          <p className="text-sm text-destructive">
            Error al cargar preguntas: {error.message || "Error desconocido"}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">
            Preguntas Contestadas
          </h2>
          {total > 0 && (
            <Badge variant="secondary" className="text-xs">
              {total}
            </Badge>
          )}
        </div>
      </div>

      {isLoading && offset === 0 ? (
        <Card className="border-border bg-card">
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : questions.length === 0 ? (
        <Card className="border-border bg-card">
          <CardContent className="flex items-center justify-center py-12">
            <p className="text-sm text-muted-foreground">
              No hay preguntas contestadas todavia.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[calc(100vh-220px)]">
          <div className="flex flex-col gap-3 pr-4">
            {questions.map((q: Question) => (
              <Card key={q.id} className="border-border bg-card">
                <CardHeader className="pb-2 pt-4 px-4">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm font-medium text-foreground leading-snug">
                      {q.text}
                    </CardTitle>
                    <a
                      href={`https://articulo.mercadolibre.com.ar/${q.item_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
                      aria-label="Ver publicacion"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(q.date_created)}
                  </p>
                </CardHeader>
                {q.answer && (
                  <CardContent className="px-4 pb-4 pt-0">
                    <div className="rounded-md bg-secondary/50 px-3 py-2">
                      <p className="text-sm text-secondary-foreground">
                        {q.answer.text}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Respondida: {formatDate(q.answer.date_created)}
                      </p>
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}

            {hasMore && (
              <Button
                variant="outline"
                className="mx-auto"
                onClick={() => setOffset((prev) => prev + limit)}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ChevronDown className="mr-2 h-4 w-4" />
                )}
                Cargar mas ({questions.length} de {total})
              </Button>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
