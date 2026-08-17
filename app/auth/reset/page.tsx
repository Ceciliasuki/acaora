"use client";

import { FormEvent, useEffect, useState } from "react";

export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("正在验证重置链接…");

  useEffect(() => {
    const params = new URLSearchParams(location.hash.replace(/^#/, ""));
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const expiresIn = Number(params.get("expires_in") || 3600);
    if (!accessToken || !refreshToken) {
      queueMicrotask(() => setMessage("重置链接无效或已经过期，请重新申请。"));
      return;
    }
    void fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken, refreshToken, expiresIn }),
    }).then(async (response) => {
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "无法验证重置链接。");
      history.replaceState(null, "", "/auth/reset");
      setReady(true);
      setMessage("");
    }).catch((cause) => setMessage(cause instanceof Error ? cause.message : "无法验证重置链接。"));
  }, []);

  async function updatePassword(event: FormEvent) {
    event.preventDefault();
    if (password !== confirmPassword) {
      setMessage("两次输入的密码不一致。");
      return;
    }
    setWorking(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/password", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "密码更新失败。");
      setMessage("密码已更新，正在进入账户…");
      window.setTimeout(() => location.replace("/dashboard"), 700);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "密码更新失败。");
    } finally {
      setWorking(false);
    }
  }

  return <main className="auth-result-page"><section className="reset-card"><span>A</span><p className="eyebrow">ACCOUNT RECOVERY</p><h1>设置新密码</h1><p>新密码需至少 8 位，并同时包含大写字母、小写字母和数字。</p>{ready ? <form onSubmit={(event) => void updatePassword(event)}><label>新密码<input type="password" required minLength={8} maxLength={72} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label><label>确认新密码<input type="password" required minLength={8} maxLength={72} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label><button type="submit" disabled={working}>{working ? "正在更新…" : "保存新密码"}</button></form> : <a href="/auth">返回账户页面</a>}{message && <div className="auth-message" role="status">{message}</div>}</section></main>;
}
