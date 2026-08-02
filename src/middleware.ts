import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Commissioner-only gate. Two tiers:
 *  - /admin/* is a pure management surface (photo uploads etc.) — gated on
 *    every method, including GET, since there's no reason for other league
 *    members to see it at all.
 *  - Everything else covered by the matcher (bonuses, manager photo writes)
 *    stays open for reads; only writes require the commissioner.
 * Quick HTTP Basic Auth rather than a full login system — see FEATURE_PLAN
 * Phase 6, real per-user auth is intentionally deferred.
 */
const PROTECTED_METHODS = new Set(["POST", "PATCH", "DELETE"]);

function isAuthorized(req: NextRequest): boolean {
  const expectedUser = process.env.COMMISSIONER_USER;
  const expectedPassword = process.env.COMMISSIONER_PASSWORD;

  const authHeader = req.headers.get("authorization");
  if (!expectedUser || !expectedPassword || !authHeader?.startsWith("Basic ")) {
    return false;
  }

  const [user, password] = atob(authHeader.slice("Basic ".length)).split(":");
  return user === expectedUser && password === expectedPassword;
}

function challenge() {
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="League Hub Commissioner"' },
  });
}

export function middleware(req: NextRequest) {
  const isAdminSurface = req.nextUrl.pathname.startsWith("/admin");

  if (!isAdminSurface && !PROTECTED_METHODS.has(req.method)) {
    return NextResponse.next();
  }

  return isAuthorized(req) ? NextResponse.next() : challenge();
}

export const config = {
  matcher: ["/api/bonuses", "/api/bonuses/:path*", "/api/managers/:path*", "/admin", "/admin/:path*"],
};
