import { NextResponse } from "next/server";
import { isCommissionerAuthorized } from "@/lib/commissionerAuth";

// Deliberately outside the middleware matcher and never sets WWW-Authenticate
// — this is polled from the client to decide whether to show the nav lock
// icon, and a challenge header on a background fetch would pop the browser's
// native Basic Auth dialog unprompted. Browsers still attach cached
// credentials to this request automatically once the commissioner has
// authenticated for the realm, so a 200 here reflects real auth state.
export async function GET(req: Request) {
  const authorized = isCommissionerAuthorized(req.headers);
  return NextResponse.json({ authorized }, { status: authorized ? 200 : 401 });
}
