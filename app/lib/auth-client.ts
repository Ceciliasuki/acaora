"use client";

import { fetchWithTimeout } from "./http";

export type AuthUser = {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
};

export type Profile = {
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

export const authChangeEvent = "acaora:auth-change";
const legacySessionKey = "acaora_supabase_session";

function removeLegacySession() {
  try {
    localStorage.removeItem(legacySessionKey);
  } catch {
    // Storage can be unavailable in hardened/private browsing contexts.
  }
}

function assertSameOrigin(input: RequestInfo | URL) {
  const raw = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  const url = new URL(raw, typeof location === "undefined" ? "http://localhost" : location.origin);
  if (typeof location !== "undefined" && url.origin !== location.origin) {
    throw new Error("账户请求必须通过 Acaora 同源接口发送。");
  }
}

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  removeLegacySession();
  assertSameOrigin(input);
  return fetchWithTimeout(input, {
    ...init,
    credentials: "same-origin",
    cache: init.cache ?? "no-store",
    headers: {
      Accept: "application/json",
      ...init.headers,
    },
  });
}

async function readJson<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error("账户服务返回了无法识别的响应，请稍后重试。");
  }
  const payload = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || "账户操作失败，请稍后重试。");
  return payload;
}

export async function getCurrentUser() {
  const response = await authFetch("/api/auth/session");
  const payload = await readJson<{ configured: boolean; user: AuthUser | null }>(response);
  return payload.user;
}

export async function getAuthStatus() {
  const response = await authFetch("/api/auth/status");
  return readJson<{ configured: boolean }>(response);
}

export async function getProfile() {
  const response = await authFetch("/api/profile");
  const payload = await readJson<{ profile: Profile | null }>(response);
  return payload.profile;
}

export async function saveProfile(profile: Profile) {
  const response = await authFetch("/api/profile", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profile),
  });
  const payload = await readJson<{ profile: Profile }>(response);
  window.dispatchEvent(new Event("acaora:profile-change"));
  return payload.profile;
}

export async function updatePassword(password: string) {
  const response = await authFetch("/api/auth/password", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  return readJson<{ updated: true }>(response);
}

export async function signOut() {
  const response = await authFetch("/api/auth/logout", { method: "POST" });
  const payload = await readJson<{ signedOut: true }>(response);
  window.dispatchEvent(new Event(authChangeEvent));
  return payload;
}

export function notifyAuthChanged() {
  window.dispatchEvent(new Event(authChangeEvent));
}
