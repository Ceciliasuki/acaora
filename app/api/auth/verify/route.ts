import { NextRequest, NextResponse } from "next/server";
import { authError, setSessionCookies, supabaseAuth } from "../_shared";

export async function POST(request: NextRequest) {
  try {
    const { email, token } = await request.json() as { email?: string; token?: string };
    const normalizedEmail = email?.trim().toLowerCase();
    const normalizedToken = token?.replace(/\D/g, "");
    if (!normalizedEmail || !normalizedToken || normalizedToken.length !== 6) {
      return NextResponse.json({ error: "请输入邮件中的六位验证码。" }, { status: 400 });
    }
    const supabaseResponse = await supabaseAuth("verify", {
      method: "POST",
      body: JSON.stringify({ email: normalizedEmail, token: normalizedToken, type: "email" }),
    });
    const payload = await supabaseResponse.json().catch(() => ({})) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      user?: { id: string; email?: string };
      msg?: string;
      message?: string;
    };
    if (!supabaseResponse.ok || !payload.access_token || !payload.refresh_token || !payload.user) {
      return NextResponse.json({ error: payload.msg || payload.message || "验证码无效或已经过期。" }, { status: 401 });
    }
    const response = NextResponse.json({ user: { id: payload.user.id, email: payload.user.email } });
    setSessionCookies(response, payload as Parameters<typeof setSessionCookies>[1]);
    return response;
  } catch (error) {
    return authError(error);
  }
}
