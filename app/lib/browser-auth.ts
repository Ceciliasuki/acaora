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

export type BrowserProfile = {
  display_name: string;
  university: string;
  major: string;
  graduation_year: number | "";
  preferences: {
    avatar: string;
    bio: string;
    interests: string[];
    language: string;
  };
};

type BrowserProfileInput = Partial<Omit<BrowserProfile, "preferences">> & {
  preferences?: Partial<BrowserProfile["preferences"]> | null;
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

async function dataRequest<T>(path: string, init: RequestInit = {}) {
  const config = getBrowserAuthConfig();
  if (!config) throw new Error("账户连接信息不可用，请重新打开最新部署页面。");
  const session = await getBrowserSession();
  if (!session) throw new Error("登录状态已失效，请重新登录后继续。");
  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    ...init,
    headers: {
      "apikey": config.key,
      "Authorization": `Bearer ${session.accessToken}`,
      "Accept": "application/json",
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  const text = await response.text();
  let payload: T & { code?: string; message?: string; details?: string; hint?: string };
  try {
    payload = text ? JSON.parse(text) as typeof payload : {} as typeof payload;
  } catch {
    throw new Error("账户资料服务返回了无法识别的响应，请稍后重试。");
  }
  if (!response.ok) {
    if (response.status === 401) throw new Error("登录状态已失效，请重新登录后继续。");
    if (payload.code === "42P01" || payload.code === "PGRST205") {
      throw new Error("账户资料表尚未启用，请先在 Supabase 执行项目迁移。");
    }
    if (payload.code === "42501") throw new Error("当前账户没有保存资料的权限，请检查 Supabase RLS 配置。");
    throw new Error(payload.message || payload.details || "账户资料操作失败，请稍后重试。");
  }
  return payload;
}

function normalizeBrowserProfile(value?: BrowserProfileInput | null): BrowserProfile {
  const preferences: Partial<BrowserProfile["preferences"]> = value?.preferences && typeof value.preferences === "object" ? value.preferences : {};
  return {
    display_name: typeof value?.display_name === "string" ? value.display_name : "",
    university: typeof value?.university === "string" ? value.university : "",
    major: typeof value?.major === "string" ? value.major : "",
    graduation_year: typeof value?.graduation_year === "number" ? value.graduation_year : "",
    preferences: {
      avatar: typeof preferences.avatar === "string" ? preferences.avatar : "",
      bio: typeof preferences.bio === "string" ? preferences.bio : "",
      interests: Array.isArray(preferences.interests) ? preferences.interests.filter((item): item is string => typeof item === "string") : [],
      language: typeof preferences.language === "string" ? preferences.language : "zh-CN",
    },
  };
}

export async function browserReadProfile(userId: string) {
  const rows = await dataRequest<BrowserProfileInput[]>(
    `profiles?id=eq.${encodeURIComponent(userId)}&select=display_name,university,major,graduation_year,preferences&limit=1`,
    { method: "GET", cache: "no-store" },
  );
  return rows[0] ? normalizeBrowserProfile(rows[0]) : null;
}

export async function browserSaveProfile(userId: string, profile: BrowserProfile) {
  const rows = await dataRequest<BrowserProfileInput[]>(
    "profiles?on_conflict=id&select=display_name,university,major,graduation_year,preferences",
    {
      method: "POST",
      headers: { "Prefer": "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({
        id: userId,
        display_name: profile.display_name.trim().slice(0, 40) || null,
        university: profile.university.trim().slice(0, 80) || null,
        major: profile.major.trim().slice(0, 100) || null,
        graduation_year: profile.graduation_year === "" ? null : profile.graduation_year,
        preferences: profile.preferences,
        updated_at: new Date().toISOString(),
      }),
    },
  );
  return normalizeBrowserProfile(rows[0] || profile);
}

export async function browserUpdateDisplayName(displayName: string) {
  const session = await getBrowserSession();
  if (!session) throw new Error("登录状态已失效，请重新登录后继续。");
  const result = await authRequest<{ user?: BrowserAuthUser }>(
    "user",
    { method: "PUT", body: JSON.stringify({ data: { display_name: displayName.trim().slice(0, 40) } }) },
    session.accessToken,
  );
  if (result.user && typeof localStorage !== "undefined") {
    localStorage.setItem(storageKey, JSON.stringify({ ...session, user: result.user } satisfies StoredSession));
  }
  return result.user;
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

