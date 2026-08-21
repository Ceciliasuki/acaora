import { NextResponse } from "next/server";
import { authConfig } from "../_shared";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    { configured: Boolean(authConfig()), provider: "Supabase", methods: ["email_password", "password_recovery"] },
    { headers: { "Cache-Control": "private, no-store, no-cache, must-revalidate" } },
  );
}
