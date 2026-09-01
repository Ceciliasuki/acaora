import { type NextRequest, NextResponse } from "next/server";

export function refreshSupabaseSession(request: NextRequest) {
  const response = NextResponse.next({ request });
  const cookieHeader = request.headers.get("cookie") ?? "";
  const hasAuthCookie = /(?:^|;\s*)[^=;]*-auth-token=/.test(cookieHeader);
  // Session refresh is performed by the same-origin /api/auth/* route handlers.
  // Keeping the global proxy SDK-free avoids loading Node-oriented dependencies
  // in EdgeOne's Edge Runtime before the request handler can run.
  if (hasAuthCookie) {
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    response.headers.append("Vary", "Cookie");
  }
  return clearLegacyCookies(cookieHeader, response);
}

function clearLegacyCookies(cookieHeader: string, response: NextResponse) {
  for (const name of ["acaora_access", "acaora_refresh"]) {
    if (new RegExp(`(?:^|;\\s*)${name}=`).test(cookieHeader)) {
      const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
      response.headers.append(
        "Set-Cookie",
        `${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure}`,
      );
    }
  }
  return response;
}
