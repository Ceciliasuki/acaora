import { NextRequest, NextResponse } from "next/server";
import { passwordPolicy, validatePassword } from "../../../lib/auth/password-policy";
import { requireSiteUrl } from "../../../lib/site-url";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { authError, privateNoStore } from "../_shared";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  try {
    const { email, password, displayName } = await request.json() as {
      email?: string;
      password?: string;
      displayName?: string;
    };
    const normalizedEmail = email?.trim().toLowerCase();
    const normalizedName = displayName?.trim().slice(0, 40);
    if (!normalizedEmail || !emailPattern.test(normalizedEmail) || normalizedEmail.length > 254) {
      return privateNoStore(NextResponse.json({ error: "请输入有效的邮箱地址。" }, { status: 400 }));
    }
    if (!password || !validatePassword(password)) {
      return privateNoStore(NextResponse.json({ error: passwordPolicy.message }, { status: 400 }));
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo: requireSiteUrl("/auth/callback"),
        data: normalizedName ? { display_name: normalizedName } : {},
      },
    });
    if (error) {
      const alreadyRegistered = /already|registered|exists/i.test(error.message);
      return privateNoStore(NextResponse.json({
        error: alreadyRegistered
          ? "该邮箱已注册，请直接登录或使用“忘记密码”。"
          : error.message || "账户创建失败。",
      }, { status: error.status === 429 ? 429 : 400 }));
    }

    if (data.session && data.user) {
      return privateNoStore(NextResponse.json({
        signedIn: true,
        confirmationRequired: false,
        user: { id: data.user.id, email: data.user.email },
      }));
    }
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return privateNoStore(NextResponse.json({
        signedIn: false,
        confirmationRequired: false,
        accountMayExist: true,
        email: normalizedEmail,
      }));
    }
    return privateNoStore(NextResponse.json({
      signedIn: false,
      confirmationRequired: true,
      email: normalizedEmail,
    }));
  } catch (error) {
    return authError(error);
  }
}
