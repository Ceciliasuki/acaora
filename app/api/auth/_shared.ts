import { NextRequest, NextResponse } from "next/server";

export type SupabaseUser = {
  id: string;
  email?: string;
  created_at?: string;
  user_metadata?: Record<string, unknown>;
};

type AuthSession = {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  user: SupabaseUser;
};

export type RequestSession = {
  accessToken: string;
  user: SupabaseUser;
  refreshed: AuthSession | null;
};

export const accessCookie = "acaora_access";
export const refreshCookie = "acaora_refresh";

export function authConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_ANON_KEY;
  return url && key ? { url, key } : null;
}

export async function supabaseAuth(path: string, init: RequestInit = {}) {
  const config = authConfig();
  if (!config) throw new Error("AUTH_NOT_CONFIGURED");
  return fetch(`${config.url}/auth/v1/${path}`, {
    ...init,
    headers: {
      "apikey": config.key,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
}

export async function supabaseRest(path: string, accessToken: string, init: RequestInit = {}) {
  const config = authConfig();
  if (!config) throw new Error("AUTH_NOT_CONFIGURED");
  return fetch(`${config.url}/rest/v1/${path}`, {
    ...init,
    headers: {
      "apikey": config.key,
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
}

export function setSessionCookies(response: NextResponse, session: AuthSession) {
  const secure = process.env.NODE_ENV === "production";
  response.cookies.set(accessCookie, session.access_token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: Math.max(300, session.expires_in ?? 3600),
  });
  response.cookies.set(refreshCookie, session.refresh_token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function clearSessionCookies(response: NextResponse) {
  response.cookies.set(accessCookie, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
  response.cookies.set(refreshCookie, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
}

export async function readUser(accessToken: string) {
  const response = await supabaseAuth("user", { headers: { "Authorization": `Bearer ${accessToken}` } });
  if (!response.ok) return null;
  return response.json() as Promise<SupabaseUser>;
}

export async function refreshSession(refreshToken: string) {
  const response = await supabaseAuth("token?grant_type=refresh_token", {
    method: "POST",
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!response.ok) return null;
  return response.json() as Promise<AuthSession>;
}

export function privateNoStore(response: NextResponse) {
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Vary", "Cookie, Authorization");
  return response;
}

function bearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization")?.trim();
  return authorization?.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() : undefined;
}

export async function readRequestSession(request: NextRequest): Promise<RequestSession | null> {
  const candidates = [bearerToken(request), request.cookies.get(accessCookie)?.value].filter(Boolean) as string[];
  for (const accessToken of new Set(candidates)) {
    const user = await readUser(accessToken);
    if (user) return { accessToken, user, refreshed: null };
  }

  const refreshToken = request.cookies.get(refreshCookie)?.value;
  if (!refreshToken) return null;
  const refreshed = await refreshSession(refreshToken);
  return refreshed ? { accessToken: refreshed.access_token, user: refreshed.user, refreshed } : null;
}

export function authError(error: unknown) {
  if (error instanceof Error && error.message === "AUTH_NOT_CONFIGURED") {
    return privateNoStore(NextResponse.json({ error: "邮箱登录服务正在等待安全连接，当前可继续使用匿名模式。", code: "not_configured" }, { status: 503 }));
  }
  return privateNoStore(NextResponse.json({ error: "登录服务暂时不可用，请稍后重试。" }, { status: 503 }));
}
