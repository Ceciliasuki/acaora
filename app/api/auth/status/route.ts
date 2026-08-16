import { NextResponse } from "next/server";
import { authConfig } from "../_shared";

export async function GET() {
  return NextResponse.json({ configured: Boolean(authConfig()), provider: "Supabase", method: "email_otp" });
}
