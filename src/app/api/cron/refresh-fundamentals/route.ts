import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { refreshFundamentalsData } from "@/lib/market-data/refresh";

export const maxDuration = 300;

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return Response.json({ message: "Não autorizado." }, { status: 401 });
  }

  const result = await refreshFundamentalsData();
  return Response.json({ ok: true, datasets: result });
}
