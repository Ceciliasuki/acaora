"use client";

import { fetchWithTimeout } from "./http";
import {clearAiKey} from './ai-settings';

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

// Share only an in-flight read, never a completed authentication result.
// A new auth event starts a fresh read even if an older one is still pending.
let pendingUser: Promise<AuthUser | null> | undefined;
let authReadEpoch=0;
let observedOwner:string|null|undefined;
let authChannel:BroadcastChannel|undefined;
let checkingIdentity:Promise<void>|undefined;
const authSignalKey='acaora:auth-signal:v1';
const remoteEvents=new WeakSet<Event>();

function publishAuthSignal(){
 try{if(authChannel){authChannel.postMessage('session-changed');return;}}catch{/* Use the storage signal if the channel was closed or denied. */}
 try{localStorage.setItem(authSignalKey,`${Date.now()}:${Math.random()}`);localStorage.removeItem(authSignalKey);}catch{/* Focus/pageshow revalidation also works when browser storage is denied. */}
}
function emitRemoteAuthChange(){const event=new Event(authChangeEvent);remoteEvents.add(event);window.dispatchEvent(event);}
function checkIdentity(explicitSignal=false){
 if(observedOwner===undefined||checkingIdentity)return;
 pendingUser=undefined;authReadEpoch++;
 checkingIdentity=getCurrentUser().then(()=>undefined).catch(()=>{if(explicitSignal)emitRemoteAuthChange();}).finally(()=>{checkingIdentity=undefined;});
}
function openAuthChannel(){
 if(authChannel||typeof BroadcastChannel==='undefined')return;
 try{authChannel=new BroadcastChannel(authSignalKey);authChannel.onmessage=event=>{if(event.data==='session-changed')checkIdentity(true);};}catch{authChannel=undefined;}
}
if (typeof window !== "undefined") {
  openAuthChannel();
  window.addEventListener(authChangeEvent,event=>{pendingUser=undefined;authReadEpoch++;clearAiKey();if(!remoteEvents.has(event))publishAuthSignal();});
  window.addEventListener('storage',event=>{if(event.key===authSignalKey&&event.newValue)checkIdentity(true);});
  window.addEventListener('focus',()=>checkIdentity());
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')checkIdentity();});
  window.addEventListener('pagehide',()=>{authChannel?.close();authChannel=undefined;});
  window.addEventListener('pageshow',()=>{openAuthChannel();checkIdentity();});
}

export function getCurrentUser(): Promise<AuthUser | null> {
  if (!pendingUser) {
    const epoch=authReadEpoch;
    const request = authFetch("/api/auth/session")
      .then(response => readJson<{ configured: boolean; user: AuthUser | null }>(response))
      .then(payload => {
        if(epoch===authReadEpoch&&pendingUser===request){const previous=observedOwner;observedOwner=payload.user?.id??null;if(previous===undefined)publishAuthSignal();else if(previous!==observedOwner){emitRemoteAuthChange();publishAuthSignal();}}
        return payload.user;
      });
    pendingUser=request;
  }
  const request = pendingUser;
  return request.finally(() => { if (pendingUser === request) pendingUser = undefined; });
}

export async function getAuthStatus() {
  const response = await authFetch("/api/auth/status");
  return readJson<{ configured: boolean }>(response);
}

export async function getProfile(expectedOwnerId?:string) {
  const response = await authFetch("/api/profile");
  const payload = await readJson<{ profile: Profile | null;user?:AuthUser }>(response);
  if(expectedOwnerId&&payload.user?.id!==expectedOwnerId){notifyAuthChanged();throw new Error('账户已变化，请重新读取个人资料。');}
  return payload.profile;
}

export async function saveProfile(profile: Profile,expectedOwnerId:string) {
  if((await getCurrentUser())?.id!==expectedOwnerId)throw new Error('账户已变化，未保存旧账户资料。');
  const response = await authFetch("/api/profile", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({...profile,expectedOwnerId}),
  });
  const payload = await readJson<{ profile: Profile }>(response);
  window.dispatchEvent(new Event("acaora:profile-change"));
  return payload.profile;
}

export async function updatePassword(password: string,expectedOwnerId:string) {
  if((await getCurrentUser())?.id!==expectedOwnerId)throw new Error('账户已变化，请重新验证后设置密码。');
  const response = await authFetch("/api/auth/password", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password,expectedOwnerId }),
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
