import { NextRequest, NextResponse } from "next/server";
import { accessCookie, authConfig, authError, clearSessionCookies, readUser, refreshCookie, refreshSession, setSessionCookies } from "../_shared";

export async function GET(request: NextRequest) {
  if (!authConfig()) return NextResponse.json({ configured: false, user: null });
  try {
    const accessToken = request.cookies.get(accessCookie)?.value;
    if (accessToken) {
      const user = await readUser(accessToken);
      if (user) return NextResponse.json({ configured: true, user: { id: user.id, email: user.email } });
    }
    const refreshToken = request.cookies.get(refreshCookie)?.value;
    if (!refreshToken) return NextResponse.json({ configured: true, user: null });
    const session = await refreshSession(refreshToken);
    if (!session) {
      const response = NextResponse.json({ configured: true, user: null });
      clearSessionCookies(response);
      return response;
    }
    const response = NextResponse.json({ configured: true, user: { id: session.user.id, email: session.user.email } });
    setSessionCookies(response, session);
    return response;
  } catch (error) {
    return authError(error);
  }
}

export async function POST(request: NextRequest) {
  if (!authConfig()) return NextResponse.json({ error: "登录服务尚未配置。" }, { status: 503 });
  try {
    const { accessToken, refreshToken, expiresIn } = await request.json() as { accessToken?: string; refreshToken?: string; expiresIn?: number };
    if (!accessToken || !refreshToken) return NextResponse.json({ error: "确认链接无效或已经过期。" }, { status: 400 });
    const user = await readUser(accessToken);
    if (!user) return NextResponse.json({ error: "无法验证此登录链接，请重新申请。" }, { status: 401 });
    const response = NextResponse.json({ user: { id: user.id, email: user.email } });
    setSessionCookies(response, { access_token: accessToken, refresh_token: refreshToken, expires_in: expiresIn, user });
    return response;
  } catch (error) {
    return authError(error);
  }
}
