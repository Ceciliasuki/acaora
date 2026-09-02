import { NextResponse } from "next/server";
import { RequestTimeoutError, fetchWithTimeout } from "../../lib/http";
import { getSupabaseConfig, requireSupabaseConfig } from "../../lib/supabase/config";
import { createSupabaseServerClient } from "../../lib/supabase/server";

export type SupabaseUser = {
  id: string;
  email?: string;
};

export type RequestSession = {
  accessToken: string;
  user: SupabaseUser;
  refreshed: null;
};

export function authConfig() {
  return getSupabaseConfig();
}

export async function supabaseRest(path: string, accessToken: string, init: RequestInit = {}) {
  const config = requireSupabaseConfig();
  return fetchWithTimeout(`${config.url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
}

export function privateNoStore(response: NextResponse) {
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  response.headers.set("Vary", "Cookie, Authorization");
  return response;
}

export async function readRequestSession(): Promise<RequestSession | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return null;

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) return null;

  return {
    accessToken,
    user: {
      id: claims.sub,
      email: typeof claims.email === "string" ? claims.email : undefined,
    },
    refreshed: null,
  };
}

export function authError(error: unknown) {
  if (error instanceof Error && error.message === "AUTH_NOT_CONFIGURED") {
    return privateNoStore(NextResponse.json({
      error: "邮箱登录服务正在等待安全连接，当前可继续使用匿名模式。",
      code: "not_configured",
    }, { status: 503 }));
  }
  if (error instanceof Error && error.message === "SITE_URL_NOT_CONFIGURED") {
    return privateNoStore(NextResponse.json({
      error: "生产站点地址尚未配置，邮件认证暂不可用。",
      code: "site_url_not_configured",
    }, { status: 503 }));
  }
  if (error instanceof RequestTimeoutError) {
    return privateNoStore(NextResponse.json({
      error: error.message,
      code: "upstream_timeout",
    }, { status: 504 }));
  }
  return privateNoStore(NextResponse.json({
    error: "登录服务暂时不可用，请稍后重试。",
    code: "auth_unavailable",
  }, { status: 503 }));
}
