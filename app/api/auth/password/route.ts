import { NextRequest, NextResponse } from "next/server";
import { passwordPolicy, validatePassword } from "../../../lib/auth/password-policy";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { authError, privateNoStore } from "../_shared";

export async function PUT(request: NextRequest) {
  try {
    const { password,expectedOwnerId } = await request.json() as { password?: string;expectedOwnerId?:string };
    if (!password || !validatePassword(password)) {
      return privateNoStore(NextResponse.json({ error: passwordPolicy.message }, { status: 400 }));
    }

    const supabase = await createSupabaseServerClient();
    const { data: claimsData } = await supabase.auth.getClaims();
    if (!claimsData?.claims?.sub) {
      return privateNoStore(NextResponse.json({
        error: "登录状态已失效，请重新打开重置链接或登录。",
      }, { status: 401 }));
    }
    if(expectedOwnerId!==claimsData.claims.sub)return privateNoStore(NextResponse.json({error:'账户或页面版本已变化，未更新密码。请重新验证。'},{status:409}));
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      return privateNoStore(NextResponse.json({ error: error.message || "密码更新失败。" }, { status: 400 }));
    }
    return privateNoStore(NextResponse.json({ updated: true }));
  } catch (error) {
    return authError(error);
  }
}
