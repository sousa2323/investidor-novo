"use client";

import { useEffect, useState } from "react";

import type { AssetType, LiveQuote } from "@/types/investment";

/** A fonte gratuita da B3 tem atraso de ~15 min; poll mais rápido não traz dado novo. */
const pollIntervalMs = 60_000;

export interface LiveQuotesState {
  quotesByTicker: Map<string, LiveQuote>;
  refreshedAt: Date | null;
}

/**
 * Mantém as cotações da listagem atualizadas enquanto a aba está visível.
 *
 * Consulta `/api/market/assets`, que lê do banco — quem fala com o brapi é o
 * cron, então abas abertas não multiplicam chamadas externas. O polling pausa
 * em aba oculta e é retomado com uma busca imediata ao voltar.
 */
export function useLiveQuotes(type: AssetType): LiveQuotesState {
  const [state, setState] = useState<LiveQuotesState>({
    quotesByTicker: new Map(),
    refreshedAt: null,
  });

  useEffect(() => {
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | undefined;
    const abortController = new AbortController();

    async function fetchQuotes() {
      try {
        const response = await fetch(`/api/market/assets?type=${type}`, {
          signal: abortController.signal,
        });

        if (!response.ok || cancelled) {
          return;
        }

        const payload = (await response.json()) as {
          quotes: LiveQuote[];
          refreshedAt: string;
        };

        if (cancelled) {
          return;
        }

        setState({
          quotesByTicker: new Map(
            payload.quotes.map((quote) => [quote.ticker, quote]),
          ),
          refreshedAt: new Date(payload.refreshedAt),
        });
      } catch {
        // Falha de rede mantém os últimos valores renderizados; a próxima
        // rodada tenta de novo.
      }
    }

    function startPolling() {
      if (intervalId !== undefined) {
        return;
      }
      intervalId = setInterval(fetchQuotes, pollIntervalMs);
    }

    function stopPolling() {
      if (intervalId === undefined) {
        return;
      }
      clearInterval(intervalId);
      intervalId = undefined;
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void fetchQuotes();
        startPolling();
      } else {
        stopPolling();
      }
    }

    if (document.visibilityState === "visible") {
      void fetchQuotes();
      startPolling();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      stopPolling();
      abortController.abort();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [type]);

  return state;
}
