"use client";

import { useEffect, useState } from "react";
import { getBrowserUser, saveBrowserSession } from "../../lib/browser-auth";

export default function AuthCallbackPage() {
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(location.hash.replace(/^#/, ""));
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const expiresIn = Number(params.get("expires_in") || 3600);
    if (!accessToken || !refreshToken) {
      queueMicrotask(() => setError("确认链接无效或已经过期，请重新注册或申请重置密码。"));
      return;
    }
    saveBrowserSession({ access_token: accessToken, refresh_token: refreshToken, expires_in: expiresIn });
    void fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ accessToken, refreshToken, expiresIn }),
    }).then(async (response) => {
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) throw new Error("SITE_AUTH_UNAVAILABLE");
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "登录状态创建失败。");
    }).catch(async () => {
      const user = await getBrowserUser();
      if (!user) throw new Error("无法验证当前账户，请重新打开确认链接。");
    }).then(() => {
      history.replaceState(null, "", "/auth/callback");
      location.replace("/dashboard");
    }).catch((cause) => setError(cause instanceof Error ? cause.message : "登录状态创建失败。"));
  }, []);

  return <main className="auth-result-page"><section><span>{error ? "!" : "A"}</span><h1>{error ? "无法完成确认" : "正在确认账户"}</h1><p>{error || "请稍候，我们正在为当前设备建立安全会话。"}</p>{error && <a href="/auth">返回账户页面</a>}</section></main>;
}
