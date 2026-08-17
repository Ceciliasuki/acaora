import { NextRequest, NextResponse } from "next/server";
import { accessCookie, clearSessionCookies, supabaseAuth } from "../_shared";

export async function POST(request: NextRequest) {
  const accessToken = request.cookies.get(accessCookie)?.value;
  if (accessToken) {
    await supabaseAuth("logout", { method: "POST", headers: { Authorization: `Bearer ${accessToken}` } }).catch(() => undefined);
  }
  const response = NextResponse.json({ signedOut: true });
  clearSessionCookies(response);
  return response;
}
