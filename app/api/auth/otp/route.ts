import { NextRequest, NextResponse } from "next/server";
import { authError, supabaseAuth } from "../_shared";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json() as { email?: string };
    const normalized = email?.trim().toLowerCase();
    if (!normalized || !emailPattern.test(normalized) || normalized.length > 254) {
      return NextResponse.json({ error: "请输入有效的邮箱地址。" }, { status: 400 });
    }
    const response = await supabaseAuth("otp", {
      method: "POST",
      body: JSON.stringify({ email: normalized, create_user: true }),
    });
    const payload = await response.json().catch(() => ({})) as { msg?: string; message?: string; error_description?: string };
    if (!response.ok) {
      const message = response.status === 429 ? "验证码发送过于频繁，请稍后再试。" : payload.msg || payload.message || payload.error_description || "验证码发送失败。";
      return NextResponse.json({ error: message }, { status: response.status === 429 ? 429 : 502 });
    }
    return NextResponse.json({ sent: true, email: normalized, retryAfter: 60 });
  } catch (error) {
    return authError(error);
  }
}
