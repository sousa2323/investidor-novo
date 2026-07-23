import { redirect } from "next/navigation";

import { getCurrentUserOrNull } from "@/lib/dal/session";

export default async function HomePage() {
  const currentUser = await getCurrentUserOrNull();
  redirect(currentUser ? "/painel" : "/entrar");
}
