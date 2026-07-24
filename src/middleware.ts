import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Commissioner-only gate for bonus creation/mutation. GET requests stay open
 * so anyone in the league can view bonuses; only writes require auth.
 * Quick HTTP Basic Auth rather than a full login system — see FEATURE_PLAN
 * Phase 6, real per-user auth is intentionally deferred.
 */
const PROTECTED_METHODS = new Set(["POST", "PATCH", "DELETE"]);

export function middleware(req: NextRequest) {
  if (!PROTECTED_METHODS.has(req.method)) {
    return NextResponse.next();
  }

  const expectedUser = process.env.COMMISSIONER_USER;
  const expectedPassword = process.env.COMMISSIONER_PASSWORD;

  const authHeader = req.headers.get("authorization");
  if (expectedUser && expectedPassword && authHeader?.startsWith("Basic ")) {
    const [user, password] = atob(authHeader.slice("Basic ".length)).split(":");
    if (user === expectedUser && password === expectedPassword) {
      return NextResponse.next();
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="League Hub Commissioner"' },
  });
}

export const config = {
  matcher: ["/api/bonuses", "/api/bonuses/:path*"],
};
