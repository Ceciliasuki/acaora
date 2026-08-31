import { NextResponse } from "next/server";
import { getBuildVersion } from "../../lib/version";

export const dynamic = "force-dynamic";

export function GET() {
  const response = NextResponse.json(getBuildVersion());
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}
