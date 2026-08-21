"use client";

import { useEffect } from "react";

export default function AuthHashRedirect() {
  useEffect(() => {
    if (!location.hash.includes("access_token=")) return;
    const params = new URLSearchParams(location.hash.replace(/^#/, ""));
    const target = params.get("type") === "recovery" ? "/reset" : "/auth-callback";
    if (location.pathname === target) return;
    location.replace(`${target}${location.hash}`);
  }, []);
  return null;
}
