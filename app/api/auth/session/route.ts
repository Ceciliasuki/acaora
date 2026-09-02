import { NextResponse } from "next/server";
import { authConfig, authError, privateNoStore, readRequestSession } from "../_shared";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!authConfig()) {
    return privateNoStore(NextResponse.json({ configured: false, user: null }));
  }
  try {
    const session = await readRequestSession();
    return privateNoStore(NextResponse.json({
      configured: true,
      user: session ? { id: session.user.id, email: session.user.email } : null,
    }));
  } catch (error) {
    return authError(error);
  }
}
