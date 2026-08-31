import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { fetchWithTimeout } from "../http";
import { getSupabaseConfig } from "./config";

export async function refreshSupabaseSession(request: NextRequest) {
  const config = getSupabaseConfig();
  let response = NextResponse.next({ request });
  if (!config) return clearLegacyCookies(request, response);

  const supabase = createServerClient(config.url, config.key, {
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, {
            ...options,
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
          });
        });
        Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
      },
    },
    global: {
      fetch: (input, init) => fetchWithTimeout(input, init, 12_000),
    },
  });

  await supabase.auth.getClaims();

  const hasAuthCookie = request.cookies.getAll().some(({ name }) => name.includes("-auth-token"));
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
