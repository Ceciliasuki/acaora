export function getSupabaseConfig(env: NodeJS.ProcessEnv = process.env) {
  const url = env.SUPABASE_URL?.replace(/\/$/, "");
  const key = env.SUPABASE_PUBLISHABLE_KEY?.trim() || env.SUPABASE_ANON_KEY?.trim();
  return url && key ? { url, key } : null;
}

export function requireSupabaseConfig() {
  const config = getSupabaseConfig();
  if (!config) throw new Error("AUTH_NOT_CONFIGURED");
  return config;
}
