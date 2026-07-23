import "server-only";

import { timingSafeEqual } from "node:crypto";

export function isAuthorizedCronRequest(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  const authorizationHeader = request.headers.get("authorization");
  const providedSecret = authorizationHeader?.startsWith("Bearer ")
    ? authorizationHeader.slice(7)
    : "";

  if (!cronSecret || !providedSecret) {
    return false;
  }

  const expectedBuffer = Buffer.from(cronSecret);
  const providedBuffer = Buffer.from(providedSecret);

  return (
    expectedBuffer.length === providedBuffer.length &&
    timingSafeEqual(expectedBuffer, providedBuffer)
  );
}
