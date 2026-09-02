import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../lib/supabase/server";

const emailOtpTypes = new Set([
  "email",
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
] as const);

type EmailOtpType = "email" | "signup" | "invite" | "magiclink" | "recovery" | "email_change";

function safeNextPath(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

function safeEmailOtpType(value: string | null): EmailOtpType | null {
  return value && emailOtpTypes.has(value as EmailOtpType) ? value as EmailOtpType : null;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = safeEmailOtpType(request.nextUrl.searchParams.get("type"));
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  if (!code && !(tokenHash && type)) {
    return NextResponse.redirect(new URL("/auth?auth_error=invalid_link", request.url));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : await supabase.auth.verifyOtp({ token_hash: tokenHash!, type: type! });
  if (error) {
    return NextResponse.redirect(new URL("/auth?auth_error=otp_expired", request.url));
  }

  const response = NextResponse.redirect(new URL(next, request.url));
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Vary", "Cookie, Authorization");
  return response;
}
