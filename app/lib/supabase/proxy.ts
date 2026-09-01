import { type NextRequest, NextResponse } from "next/server";

export function refreshSupabaseSession(request: NextRequest) {
  const response = NextResponse.next({ request });
  const hasAuthCookie = request.cookies.getAll().some(({ name }) => name.includes("-auth-token"));
  // Session refresh is performed by the same-origin /api/auth/* route handlers.
  // Keeping the global proxy SDK-free avoids loading Node-oriented dependencies
  // in EdgeOne's Edge Runtime before the request handler can run.
  if (hasAuthCookie) {
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    response.headers.append("Vary", "Cookie");
  }
  return clearLegacyCookies(request, response);
}

function clearLegacyCookies(request: NextRequest, response: NextResponse) {
  for (const name of ["acaora_access", "acaora_refresh"]) {
    if (request.cookies.has(name)) {
      response.cookies.set(name, "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      });
    }
  }
  return response;
}
