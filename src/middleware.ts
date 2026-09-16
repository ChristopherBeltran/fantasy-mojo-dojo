import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isCommissionerAuthorized } from "@/lib/commissionerAuth";

/**
 * Commissioner-only gate. Two tiers:
 *  - /commissioner/* is a pure management surface (photo uploads etc.) —
 *    gated on every method, including GET, since there's no reason for
 *    other league members to see it at all.
 *  - Everything else covered by the matcher (bonuses, manager photo writes)
 *    stays open for reads; only writes require the commissioner.
 * Quick HTTP Basic Auth rather than a full login system — see FEATURE_PLAN
 * Phase 6, real per-user auth is intentionally deferred.
 */
const PROTECTED_METHODS = new Set(["POST", "PATCH", "DELETE"]);

function challenge() {
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="League Hub Commissioner"' },
  });
}

export function middleware(req: NextRequest) {
  const isCommissionerSurface =
    req.nextUrl.pathname.startsWith("/commissioner");

  if (!isCommissionerSurface && !PROTECTED_METHODS.has(req.method)) {
    return NextResponse.next();
  }

  return isCommissionerAuthorized(req.headers)
    ? NextResponse.next()
    : challenge();
}

export const config = {
  matcher: [
    "/api/bonuses",
    "/api/bonuses/:path*",
    "/api/managers/:path*",
    "/api/last-man-standing/:path*",
    "/api/posters/:path*",
    "/commissioner",
    "/commissioner/:path*",
  ],
};
