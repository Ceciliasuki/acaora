export type BrowserAuthUser = {
  id: string;
  email?: string;
  identities?: unknown[];
  user_metadata?: Record<string, unknown>;
};

export type BrowserAuthPayload = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user?: BrowserAuthUser;
};

type StoredSession = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user?: BrowserAuthUser;
};

const storageKey = "acaora_supabase_session";
export const authChangeEvent = "acaora:auth-change";
let refreshInFlight: Promise<StoredSession | null> | null = null;

export function getBrowserAuthConfig() {
  if (typeof document === "undefined") return null;
  const url = document.body.dataset.supabaseUrl?.replace(/\/$/, "");
  const key = document.body.dataset.supabaseKey;
  return url && key ? { url, key } : null;
}

async function authRequest<T>(path: string, init: RequestInit = {}, accessToken?: string) {
  const config = getBrowserAuthConfig();
  if (!config) throw new Error("账户连接信息不可用，请重新打开最新部署页面。");
  const response = await fetch(`${config.url}/auth/v1/${path}`, {
    ...init,
    headers: {
      "apikey": config.key,
      "Content-Type": "application/json",
      ...(accessToken ? { "Authorization": `Bearer ${accessToken}` } : {}),
      ...init.headers,
    },
  });
  const text = await response.text();
  let payload: T & { msg?: string; message?: string; error_description?: string };
  try {
    payload = text ? JSON.parse(text) as typeof payload : {} as typeof payload;
  } catch {
    throw new Error("认证服务返回了无法识别的响应，请稍后重试。");
  }
  if (!response.ok) {
    throw new Error(payload.msg || payload.message || payload.error_description || "账户操作失败，请稍后重试。");
  }
  return payload;
}

export function saveBrowserSession(payload: BrowserAuthPayload) {
  if (!payload.access_token || !payload.refresh_token || typeof localStorage === "undefined") return false;
  const session: StoredSession = {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt: Date.now() + Math.max(300, payload.expires_in ?? 3600) * 1000,
    user: payload.user,
  };
  localStorage.setItem(storageKey, JSON.stringify(session));
  window.dispatchEvent(new Event(authChangeEvent));
  return true;
}

function readBrowserSession() {
  if (typeof localStorage === "undefined") return null;
  try {
    const session = JSON.parse(localStorage.getItem(storageKey) ?? "null") as StoredSession | null;
    return session?.accessToken && session.refreshToken ? session : null;
  } catch {
    localStorage.removeItem(storageKey);
    return null;
  }
}

export function clearBrowserSession() {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(storageKey);
    window.dispatchEvent(new Event(authChangeEvent));
  }
}

export async function browserSignUp(email: string, password: string, displayName: string, redirectTo: string) {
  return authRequest<BrowserAuthPayload & { identities?: unknown[] }>(`signup?redirect_to=${encodeURIComponent(redirectTo)}`, {
    method: "POST",
    body: JSON.stringify({ email, password, data: displayName ? { display_name: displayName } : {} }),
  });
}

export async function browserSignIn(email: string, password: string) {
  const payload = await authRequest<BrowserAuthPayload>("token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  saveBrowserSession(payload);
  return payload;
}

export async function browserRecover(email: string, redirectTo: string) {
  return authRequest<{ sent?: boolean }>(`recover?redirect_to=${encodeURIComponent(redirectTo)}`, {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

async function refreshBrowserSession(session: StoredSession) {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const payload = await authRequest<BrowserAuthPayload>("token?grant_type=refresh_token", {
        method: "POST",
        body: JSON.stringify({ refresh_token: session.refreshToken }),
      });
      if (!saveBrowserSession(payload)) return null;
      return readBrowserSession();
    } catch {
      clearBrowserSession();
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

export async function getBrowserSession() {
  let session = readBrowserSession();
  if (!session) return null;
  if (session.expiresAt <= Date.now() + 60_000) session = await refreshBrowserSession(session);
  if (!session) return null;
  return session;
}

export async function getBrowserUser() {
  const session = await getBrowserSession();
  if (!session) return null;
  try {
    const user = await authRequest<BrowserAuthUser>("user", { method: "GET" }, session.accessToken);
    localStorage.setItem(storageKey, JSON.stringify({ ...session, user } satisfies StoredSession));
    return user;
  } catch {
    const refreshed = await refreshBrowserSession(session);
    if (!refreshed) return null;
    try {
      return await authRequest<BrowserAuthUser>("user", { method: "GET" }, refreshed.accessToken);
    } catch {
      clearBrowserSession();
      return null;
    }
  }
}

export async function bridgeBrowserSession() {
  const session = await getBrowserSession();
  if (!session) return false;
  try {
    const response = await fetch("/api/auth/session", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        access_token: session.accessToken,
        refresh_token: session.refreshToken,
        expires_in: Math.max(60, Math.floor((session.expiresAt - Date.now()) / 1000)),
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function browserAuthenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const session = await getBrowserSession();
  const headers = new Headers(init.headers);
  if (session) headers.set("Authorization", `Bearer ${session.accessToken}`);
  return fetch(input, { ...init, credentials: "same-origin", headers });
}

export async function browserUpdatePassword(password: string) {
  let session = readBrowserSession();
  if (!session) throw new Error("登录状态已失效，请重新打开重置链接或登录。");
  if (session.expiresAt <= Date.now() + 60_000) session = await refreshBrowserSession(session);
  if (!session) throw new Error("登录状态已失效，请重新打开重置链接或登录。");
  return authRequest<{ user?: BrowserAuthUser }>("user", { method: "PUT", body: JSON.stringify({ password }) }, session.accessToken);
}

export async function browserSignOut() {
  const session = readBrowserSession();
  try {
    if (session) await authRequest("logout", { method: "POST" }, session.accessToken);
  } finally {
    clearBrowserSession();
  }
}
