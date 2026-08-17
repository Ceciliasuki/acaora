import { NextRequest, NextResponse } from "next/server";
import { authError, setSessionCookies, supabaseAuth } from "../_shared";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json() as { email?: string; password?: string };
    const normalizedEmail = email?.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      return NextResponse.json({ error: "请输入邮箱和密码。" }, { status: 400 });
    }
    const supabaseResponse = await supabaseAuth("token?grant_type=password", {
      method: "POST",
      body: JSON.stringify({ email: normalizedEmail, password }),
    });
    const payload = await supabaseResponse.json().catch(() => ({})) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      user?: { id: string; email?: string };
      msg?: string;
      message?: string;
      error_description?: string;
    };
    if (!supabaseResponse.ok || !payload.access_token || !payload.refresh_token || !payload.user) {
      const detail = payload.msg || payload.message || payload.error_description || "邮箱或密码不正确。";
      const message = /confirm/i.test(detail) ? "请先打开注册邮件完成邮箱确认。" : "邮箱或密码不正确，或账户尚未完成邮箱确认。";
      return NextResponse.json({ error: message }, { status: 401 });
    }
    const response = NextResponse.json({ user: { id: payload.user.id, email: payload.user.email } });
    setSessionCookies(response, payload as Parameters<typeof setSessionCookies>[1]);
    return response;
  } catch (error) {
    return authError(error);
  }
}
