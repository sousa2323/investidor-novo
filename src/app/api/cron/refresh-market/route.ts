import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { refreshMarketData } from "@/lib/market-data/refresh";

export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return Response.json({ message: "Não autorizado." }, { status: 401 });
  }

  const result = await refreshMarketData();
  return Response.json({ ok: true, ...result });
}
