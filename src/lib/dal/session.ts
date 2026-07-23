import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getAuthentication } from "@/lib/auth";

export const getCurrentSession = cache(async () => {
  const authentication = getAuthentication();
  return authentication.api.getSession({
    headers: await headers(),
  });
});

export async function requireCurrentUser() {
  const currentSession = await getCurrentSession();

  if (!currentSession?.user) {
    redirect("/entrar");
  }

  return {
    id: currentSession.user.id,
    name: currentSession.user.name,
    email: currentSession.user.email,
    image: currentSession.user.image ?? null,
  };
}

export async function getCurrentUserOrNull() {
  const currentSession = await getCurrentSession();

  if (!currentSession?.user) {
    return null;
  }

  return {
    id: currentSession.user.id,
    name: currentSession.user.name,
    email: currentSession.user.email,
    image: currentSession.user.image ?? null,
  };
}
