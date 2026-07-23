import { z } from "zod";

import { listLiveQuotes } from "@/lib/dal/assets";
import { getCurrentUserOrNull } from "@/lib/dal/session";

/**
 * Cotações para o polling das listagens. Lê apenas do banco: quem fala com o
 * brapi é o cron, então abrir muitas abas não multiplica chamadas externas.
 */
export const dynamic = "force-dynamic";

const querySchema = z.object({
  type: z.enum(["STOCK", "FII"]),
});

export async function GET(request: Request) {
  const currentUser = await getCurrentUserOrNull();

  if (!currentUser) {
    return Response.json({ message: "Sessão expirada." }, { status: 401 });
  }

  const requestUrl = new URL(request.url);
  const parsedQuery = querySchema.safeParse({
    type: requestUrl.searchParams.get("type"),
  });

  if (!parsedQuery.success) {
    return Response.json(
      { message: "Informe type=STOCK ou type=FII." },
      { status: 400 },
    );
  }

  const quotes = await listLiveQuotes(parsedQuery.data.type);

  return Response.json(
    { quotes, refreshedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
