import { NextRequest, NextResponse } from "next/server";
import { accessCookie, authConfig, authError, clearSessionCookies, privateNoStore, readRequestSession, readUser, refreshCookie, setSessionCookies } from "../_shared";

export async function GET(request: NextRequest) {
  if (!authConfig()) return privateNoStore(NextResponse.json({ configured: false, user: null }));
  try {
    const session = await readRequestSession(request);
    if (!session) {
      const response = NextResponse.json({ configured: true, user: null });
      if (request.cookies.has(accessCookie) || request.cookies.has(refreshCookie)) clearSessionCookies(response);
      return privateNoStore(response);
    }
    const response = NextResponse.json({ configured: true, user: { id: session.user.id, email: session.user.email } });
    if (session.refreshed) setSessionCookies(response, session.refreshed);
    return privateNoStore(response);
  } catch (error) {
    return authError(error);
  }
}

export async function POST(request: NextRequest) {
  if (!authConfig()) return NextResponse.json({ error: "登录服务尚未配置。" }, { status: 503 });
  try {
    const body = await request.json() as { accessToken?: string; refreshToken?: string; expiresIn?: number; access_token?: string; refresh_token?: string; expires_in?: number };
    const accessToken = body.accessToken || body.access_token;
    const refreshToken = body.refreshToken || body.refresh_token;
    const expiresIn = body.expiresIn || body.expires_in;
    if (!accessToken || !refreshToken) return NextResponse.json({ error: "确认链接无效或已经过期。" }, { status: 400 });
    const user = await readUser(accessToken);
    if (!user) return NextResponse.json({ error: "无法验证此登录链接，请重新申请。" }, { status: 401 });
    const response = NextResponse.json({ user: { id: user.id, email: user.email } });
    setSessionCookies(response, { access_token: accessToken, refresh_token: refreshToken, expires_in: expiresIn, user });
    return privateNoStore(response);
  } catch (error) {
    return authError(error);
  }
}

