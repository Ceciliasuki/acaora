import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { authError,privateNoStore } from "../_shared";

export async function POST() {
  try{
    const supabase = await createSupabaseServerClient();
    const {error}=await supabase.auth.signOut({scope:'local'});
    if(error)return privateNoStore(NextResponse.json({error:'退出未完成，请检查连接后重试。当前会话状态尚未确认。'},{status:503}));
    return privateNoStore(NextResponse.json({ signedOut: true }));
  }catch(error){return authError(error);}
}
