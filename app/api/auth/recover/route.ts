import { NextRequest, NextResponse } from "next/server";
import { authError, supabaseAuth } from "../_shared";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json() as { email?: string };
    const normalizedEmail = email?.trim().toLowerCase();
    if (!normalizedEmail || !emailPattern.test(normalizedEmail)) {
      return NextResponse.json({ error: "请输入有效的邮箱地址。" }, { status: 400 });
    }
    const resetUrl = new URL("/auth/reset", request.nextUrl.origin).toString();
    const supabaseResponse = await supabaseAuth(`recover?redirect_to=${encodeURIComponent(resetUrl)}`, {
      method: "POST",
      body: JSON.stringify({ email: normalizedEmail }),
    });
    if (!supabaseResponse.ok) {
      const payload = await supabaseResponse.json().catch(() => ({})) as { msg?: string; message?: string };
      return NextResponse.json({ error: supabaseResponse.status === 429 ? "邮件发送过于频繁，请稍后再试。" : payload.msg || payload.message || "重置邮件发送失败。" }, { status: supabaseResponse.status === 429 ? 429 : 502 });
    }
    return NextResponse.json({ sent: true });
  } catch (error) {
    return authError(error);
  }
}
