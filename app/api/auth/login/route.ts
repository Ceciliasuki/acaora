import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { authError, privateNoStore } from "../_shared";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json() as { email?: string; password?: string };
    const normalizedEmail = email?.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      return privateNoStore(NextResponse.json({ error: "请输入邮箱和密码。" }, { status: 400 }));
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });
    if (error || !data.user) {
      return privateNoStore(NextResponse.json({
        error: "邮箱或密码不正确，或账户尚未完成邮箱确认。",
      }, { status: 401 }));
    }

    return privateNoStore(NextResponse.json({
      user: { id: data.user.id, email: data.user.email },
    }));
  } catch (error) {
    return authError(error);
  }
}
