// Shared between middleware.ts (enforces the gate) and the /api/commissioner/status
// route (lets the client check auth state without triggering a browser challenge).
export function isCommissionerAuthorized(headers: Headers): boolean {
  const expectedUser = process.env.COMMISSIONER_USER;
  const expectedPassword = process.env.COMMISSIONER_PASSWORD;

  const authHeader = headers.get("authorization");
  if (!expectedUser || !expectedPassword || !authHeader?.startsWith("Basic ")) {
    return false;
  }

  const [user, password] = atob(authHeader.slice("Basic ".length)).split(":");
  return user === expectedUser && password === expectedPassword;
}

// Browsers only reattach cached HTTP Basic Auth credentials to a request
// when that response itself challenges with WWW-Authenticate — which
// /api/commissioner/status deliberately never sends, to avoid popping the
// native login dialog for every visitor. That means a background fetch()
// from an already-authenticated commissioner's browser carries no
// Authorization header at all (confirmed against real Chrome). So
// middleware mirrors a successful Basic Auth into this cookie instead,
// which the browser DOES send automatically on every same-origin request.
export const COMMISSIONER_SESSION_COOKIE = "commissioner_session";
