import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { privateNoStore } from "../_shared";

export async function POST() {
  const supabase = await createSupabaseServerClient().catch(() => null);
  if (supabase) await supabase.auth.signOut().catch(() => undefined);
  return privateNoStore(NextResponse.json({ signedOut: true }));
}
