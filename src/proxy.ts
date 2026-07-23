import { getSessionCookie } from "better-auth/cookies";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const publicAuthenticationPaths = ["/entrar", "/cadastro"];

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const sessionCookie = getSessionCookie(request);
  const isPublicAuthenticationPath = publicAuthenticationPaths.some(
    (publicPath) => pathname === publicPath,
  );

  if (!sessionCookie && !isPublicAuthenticationPath) {
    return NextResponse.redirect(new URL("/entrar", request.url));
  }

  if (sessionCookie && isPublicAuthenticationPath) {
    return NextResponse.redirect(new URL("/painel", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/painel/:path*",
    "/acoes/:path*",
    "/fiis/:path*",
    "/carteira/:path*",
    "/planejador/:path*",
    "/favoritos/:path*",
    "/perfil/:path*",
    "/entrar",
    "/cadastro",
  ],
};
