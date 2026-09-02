import { NextRequest, NextResponse } from "next/server";
import { requireSiteUrl } from "../../../lib/site-url";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { authError, privateNoStore } from "../_shared";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json() as { email?: string };
    const normalizedEmail = email?.trim().toLowerCase();
    if (!normalizedEmail || !emailPattern.test(normalizedEmail)) {
      return privateNoStore(NextResponse.json({ error: "请输入有效的邮箱地址。" }, { status: 400 }));
    }

    const supabase = await createSupabaseServerClient();
    const callback = new URL(requireSiteUrl("/auth/callback"));
    callback.searchParams.set("next", "/auth/reset");
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: callback.toString(),
    });
    if (error) {
      return privateNoStore(NextResponse.json({
        error: error.status === 429 ? "邮件发送过于频繁，请稍后再试。" : "重置邮件发送失败。",
      }, { status: error.status === 429 ? 429 : 502 }));
    }
    return privateNoStore(NextResponse.json({ sent: true }));
  } catch (error) {
    return authError(error);
  }
}
