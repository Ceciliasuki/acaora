import { NextResponse } from "next/server";
import { clearSessionCookies } from "../_shared";

export async function POST() {
  const response = NextResponse.json({ signedOut: true });
  clearSessionCookies(response);
  return response;
}
