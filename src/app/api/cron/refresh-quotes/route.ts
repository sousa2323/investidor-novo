import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { refreshQuotes } from "@/lib/market-data/refresh";

export const maxDuration = 60;

/** Poll intradiário da lista pública do brapi; não consome cota de token. */
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return Response.json({ message: "Não autorizado." }, { status: 401 });
  }

  const result = await refreshQuotes();
  return Response.json({ ok: true, ...result });
}
