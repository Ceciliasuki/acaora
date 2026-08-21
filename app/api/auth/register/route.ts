import { NextRequest, NextResponse } from "next/server";
import { getSiteUrl } from "../../../lib/site-url";
import { authError, setSessionCookies, supabaseAuth } from "../_shared";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,72}$/;

export async function POST(request: NextRequest) {
  try {
    const { email, password, displayName } = await request.json() as { email?: string; password?: string; displayName?: string };
    const normalizedEmail = email?.trim().toLowerCase();
    const normalizedName = displayName?.trim().slice(0, 40);
    if (!normalizedEmail || !emailPattern.test(normalizedEmail) || normalizedEmail.length > 254) {
      return NextResponse.json({ error: "请输入有效的邮箱地址。" }, { status: 400 });
    }
    if (!password || !passwordPattern.test(password)) {
      return NextResponse.json({ error: "密码需为 8–72 位，并同时包含大写字母、小写字母和数字。" }, { status: 400 });
    }

    const callbackUrl = getSiteUrl("/auth-callback");
    const supabaseResponse = await supabaseAuth(`signup?redirect_to=${encodeURIComponent(callbackUrl)}`, {
      method: "POST",
      body: JSON.stringify({
        email: normalizedEmail,
        password,
        data: normalizedName ? { display_name: normalizedName } : {},
      }),
    });
    const payload = await supabaseResponse.json().catch(() => ({})) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      user?: { id: string; email?: string; identities?: unknown[] };
      msg?: string;
      message?: string;
      error_description?: string;
    };
    if (!supabaseResponse.ok) {
      const detail = payload.msg || payload.message || payload.error_description || "账户创建失败。";
      const message = /already|registered|exists/i.test(detail) ? "该邮箱已注册，请直接登录或使用“忘记密码”。" : detail;
      return NextResponse.json({ error: message }, { status: supabaseResponse.status === 429 ? 429 : 400 });
    }

    if (payload.access_token && payload.refresh_token && payload.user) {
      const response = NextResponse.json({ signedIn: true, confirmationRequired: false, user: { id: payload.user.id, email: payload.user.email } });
      setSessionCookies(response, payload as Parameters<typeof setSessionCookies>[1]);
      return response;
    }

    // With email confirmation enabled, GoTrue deliberately returns an
    // obfuscated 200 response for an already registered account. The empty
    // identities array is the only signal available to the caller; no
    // confirmation email is sent for this response.
    if (payload.user && Array.isArray(payload.user.identities) && payload.user.identities.length === 0) {
      return NextResponse.json({
        signedIn: false,
        confirmationRequired: false,
        accountMayExist: true,
        email: normalizedEmail,
      });
    }
    return NextResponse.json({ signedIn: false, confirmationRequired: true, email: normalizedEmail });
  } catch (error) {
    return authError(error);
  }
}

