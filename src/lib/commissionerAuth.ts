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
