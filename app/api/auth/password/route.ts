import { NextRequest, NextResponse } from "next/server";
import { authError, privateNoStore, readRequestSession, supabaseAuth } from "../_shared";

const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,72}$/;

export async function PUT(request: NextRequest) {
  try {
    const { password } = await request.json() as { password?: string };
    if (!password || !passwordPattern.test(password)) {
      return NextResponse.json({ error: "密码需为 8–72 位，并同时包含大写字母、小写字母和数字。" }, { status: 400 });
    }
    const session = await readRequestSession(request);
    if (!session) {
      return NextResponse.json({ error: "登录状态已失效，请重新打开重置链接或登录。" }, { status: 401 });
    }
    const supabaseResponse = await supabaseAuth("user", {
      method: "PUT",
      headers: { Authorization: `Bearer ${session.accessToken}` },
      body: JSON.stringify({ password }),
    });
    const payload = await supabaseResponse.json().catch(() => ({})) as { msg?: string; message?: string };
    if (!supabaseResponse.ok) {
      return NextResponse.json({ error: payload.msg || payload.message || "密码更新失败。" }, { status: 400 });
    }
    return privateNoStore(NextResponse.json({ updated: true }));
  } catch (error) {
    return authError(error);
  }
}

