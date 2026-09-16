import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COMMISSIONER_SESSION_COOKIE, isCommissionerAuthorized } from "@/lib/commissionerAuth";

// Deliberately outside the middleware matcher and never sets WWW-Authenticate
// — this is polled from the client to decide whether to show the nav lock
// icon (and the poster regenerate button), and a challenge header on a
// background fetch would pop the browser's native Basic Auth dialog
// unprompted. A background fetch() never carries a Basic Auth header on its
// own (browsers only reattach cached credentials in response to a fresh
// WWW-Authenticate challenge), so this checks the session cookie middleware
// sets on a successful Basic Auth instead — falling back to a direct Basic
// Auth header for non-browser callers (curl, scripts).
export async function GET(req: NextRequest) {
  const authorized =
    req.cookies.get(COMMISSIONER_SESSION_COOKIE)?.value === "1" ||
    isCommissionerAuthorized(req.headers);
  return NextResponse.json({ authorized }, { status: authorized ? 200 : 401 });
}
