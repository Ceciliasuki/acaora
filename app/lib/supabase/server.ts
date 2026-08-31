import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { fetchWithTimeout } from "../http";
import { requireSupabaseConfig } from "./config";

const secureCookies = process.env.NODE_ENV === "production";

export async function createSupabaseServerClient() {
  const config = requireSupabaseConfig();
  const cookieStore = await cookies();

  return createServerClient(config.url, config.key, {
    cookieOptions: {
      httpOnly: true,
      secure: secureCookies,
      sameSite: "lax",
      path: "/",
    },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, {
              ...options,
              httpOnly: true,
              secure: secureCookies,
              sameSite: "lax",
              path: "/",
            });
          });
        } catch {
          // Server Components cannot write cookies; proxy.ts performs refresh.
        }
      },
    },
    global: {
      fetch: (input, init) => fetchWithTimeout(input, init, 12_000),
    },
  });
}
