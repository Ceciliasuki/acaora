"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { getCurrentUser, updatePassword as updateAccountPassword } from "../../lib/auth-client";
import { FormField, PasswordField } from "../../components/ui";

export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("正在验证重置链接…");

  useEffect(() => {
    void getCurrentUser()
      .then((user) => {
        setReady(Boolean(user));
        setMessage(user ? "" : "重置链接无效或已经过期，请重新申请。");
      })
      .catch(() => setMessage("暂时无法验证重置链接，请稍后重试。"));
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
      await updateAccountPassword(password);
      setMessage("密码已更新，正在进入账户…");
      window.setTimeout(() => location.replace("/dashboard"), 700);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "密码更新失败。");
    } finally {
      setWorking(false);
    }
  }

  return <main className="auth-result-page"><section className="reset-card"><span>A</span><p className="eyebrow">ACCOUNT RECOVERY</p><h1>设置新密码</h1><p>新密码需至少 8 位，并同时包含大写字母、小写字母和数字。</p>{ready ? <form onSubmit={(event) => void updatePassword(event)}><FormField label="新密码" id="reset-password" required><PasswordField autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} showPolicy /></FormField><FormField label="确认新密码" id="reset-confirm-password" required error={confirmPassword && password !== confirmPassword ? "两次输入的密码不一致。" : undefined}><PasswordField autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></FormField><button type="submit" disabled={working}>{working ? "正在更新…" : "保存新密码"}</button></form> : <Link href="/auth">返回账户页面</Link>}{message && <div className="auth-message" role="status">{message}</div>}</section></main>;
}
