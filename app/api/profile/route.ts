import { NextRequest, NextResponse } from "next/server";
import { accessCookie, authError, readUser, refreshCookie, refreshSession, setSessionCookies, supabaseRest } from "../auth/_shared";

type ProfilePreferences = {
  avatar?: string;
  bio?: string;
  interests?: string[];
  language?: string;
};

type ProfilePayload = {
  display_name?: unknown;
  university?: unknown;
  major?: unknown;
  graduation_year?: unknown;
  preferences?: unknown;
};

async function currentSession(request: NextRequest) {
  const accessToken = request.cookies.get(accessCookie)?.value;
  if (accessToken) {
    const user = await readUser(accessToken);
    if (user) return { accessToken, user, refreshed: null };
  }
  const refreshToken = request.cookies.get(refreshCookie)?.value;
  if (!refreshToken) return null;
  const refreshed = await refreshSession(refreshToken);
  return refreshed ? { accessToken: refreshed.access_token, user: refreshed.user, refreshed } : null;
}

function withRefresh(response: NextResponse, session: Awaited<ReturnType<typeof currentSession>>) {
  if (session?.refreshed) setSessionCookies(response, session.refreshed);
  return response;
}

function normalizeString(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function normalizePreferences(value: unknown): ProfilePreferences {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const avatar = normalizeString(source.avatar, 260000);
  if (avatar && !/^data:image\/(webp|png|jpeg);base64,/i.test(avatar)) throw new Error("INVALID_AVATAR");
  const interests = Array.isArray(source.interests)
    ? source.interests.map((item) => normalizeString(item, 24)).filter(Boolean).slice(0, 12)
    : [];
  return {
    avatar,
    bio: normalizeString(source.bio, 240),
    interests,
    language: ["zh-CN", "en"].includes(String(source.language)) ? String(source.language) : "zh-CN",
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = await currentSession(request);
    if (!session) return NextResponse.json({ error: "请先登录。" }, { status: 401 });
    const result = await supabaseRest(`profiles?id=eq.${encodeURIComponent(session.user.id)}&select=display_name,university,major,graduation_year,preferences,updated_at`, session.accessToken);
    if (!result.ok) return NextResponse.json({ error: "暂时无法读取个人资料。" }, { status: 502 });
    const profiles = await result.json() as Array<Record<string, unknown>>;
    return withRefresh(NextResponse.json({ user: { id: session.user.id, email: session.user.email }, profile: profiles[0] ?? null }), session);
  } catch (error) {
    return authError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await currentSession(request);
    if (!session) return NextResponse.json({ error: "请先登录。" }, { status: 401 });
    const body = await request.json() as ProfilePayload;
    const year = Number(body.graduation_year);
    const profile = {
      id: session.user.id,
      display_name: normalizeString(body.display_name, 40),
      university: normalizeString(body.university, 80),
      major: normalizeString(body.major, 100),
      graduation_year: Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : null,
      preferences: normalizePreferences(body.preferences),
      updated_at: new Date().toISOString(),
    };
    const result = await supabaseRest("profiles?on_conflict=id&select=display_name,university,major,graduation_year,preferences,updated_at", session.accessToken, {
      method: "POST",
      headers: { "Prefer": "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(profile),
    });
    if (!result.ok) {
      const detail = await result.text();
      console.error("Profile update failed", result.status, detail.slice(0, 500));
      return NextResponse.json({ error: "资料保存失败，请确认 Supabase 已运行账户迁移。" }, { status: 502 });
    }
    const profiles = await result.json() as Array<Record<string, unknown>>;
    return withRefresh(NextResponse.json({ profile: profiles[0] ?? profile }), session);
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_AVATAR") return NextResponse.json({ error: "头像格式无效。" }, { status: 400 });
    return authError(error);
  }
}
