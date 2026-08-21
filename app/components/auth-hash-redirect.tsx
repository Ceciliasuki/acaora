"use client";

import { useEffect } from "react";

export default function AuthHashRedirect() {
  useEffect(() => {
    const params = new URLSearchParams(location.hash.replace(/^#/, ""));
    if (params.get("error")) {
      const code = params.get("error_code") || "invalid_link";
      location.replace(`/auth?auth_error=${encodeURIComponent(code)}`);
      return;
    }
    if (!params.get("access_token")) return;
    const target = params.get("type") === "recovery" ? "/reset" : "/auth-callback";
    if (location.pathname === target) return;
    location.replace(`${target}${location.hash}`);
  }, []);
  return null;
}
