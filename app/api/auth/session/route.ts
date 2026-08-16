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
