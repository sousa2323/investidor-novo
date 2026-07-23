import { toNextJsHandler } from "better-auth/next-js";

import { getAuthentication } from "@/lib/auth";

async function handleAuthenticationRequest(request: Request): Promise<Response> {
  return getAuthentication().handler(request);
}

export const { GET, POST, PATCH, PUT, DELETE } = toNextJsHandler(
  handleAuthenticationRequest,
);
