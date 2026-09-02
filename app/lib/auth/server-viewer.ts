import { createSupabaseServerClient } from "../supabase/server";

export type ServerViewer = {
  id: string;
  email: string;
  displayName: string;
  avatar: string;
};

export async function getServerViewer(): Promise<ServerViewer | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getClaims();
    const claims = data?.claims;
    if (error || !claims?.sub) return null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name,preferences")
      .eq("id", claims.sub)
      .maybeSingle();
    const email = typeof claims.email === "string" ? claims.email : "";
    const preferences = profile?.preferences && typeof profile.preferences === "object"
      ? profile.preferences as Record<string, unknown>
      : {};
    return {
      id: claims.sub,
      email,
      displayName: typeof profile?.display_name === "string" && profile.display_name.trim()
        ? profile.display_name
        : email.split("@")[0] || "Acaora 用户",
      avatar: typeof preferences.avatar === "string" ? preferences.avatar : "",
    };
  } catch {
    return null;
  }
}
