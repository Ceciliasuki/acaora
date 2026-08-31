import { NextResponse } from "next/server";
import { authConfig, privateNoStore } from "../_shared";

export const dynamic = "force-dynamic";

export function GET() {
  return privateNoStore(NextResponse.json({
    configured: Boolean(authConfig()),
    provider: "Supabase",
    methods: ["email_password", "password_recovery"],
  }));
}
