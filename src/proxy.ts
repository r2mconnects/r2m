import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PREFIXES = ["/login", "/register", "/forgot-password", "/reset-password", "/setup", "/verify", "/terms", "/privacy", "/unauthorized", "/api", "/manifest.json", "/icons", "/images"];

/**
 * Optimistic gate: redirects visitors without a session cookie to /login.
 * Real authorization (session validity, roles, permissions, scope) is enforced server-side
 * in every page, server action and route handler.
 */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === "/") {
    return NextResponse.redirect(new URL(req.cookies.get("r2m_session") ? "/home" : "/login", req.url));
  }
  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) return NextResponse.next();
  if (!req.cookies.get("r2m_session")) return NextResponse.redirect(new URL("/login", req.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
