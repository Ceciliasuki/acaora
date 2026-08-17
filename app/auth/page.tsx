"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

type Mode = "login" | "register" | "recover" | "check-email";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void fetch("/api/auth/status")
      .then((response) => response.json())
      .then((payload: { configured?: boolean }) => setConfigured(Boolean(payload.configured)))
      .catch(() => setConfigured(false));
  }, []);

  function switchMode(next: Mode) {
    setMode(next);
    setMessage("");
    setPassword("");
    setConfirmPassword("");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!configured || working) return;
    if (mode === "register" && password !== confirmPassword) {
      setMessage("两次输入的密码不一致。");
      return;
    }
    setWorking(true);
    setMessage("");
    try {
      const endpoint = mode === "register" ? "/api/auth/register" : mode === "recover" ? "/api/auth/recover" : "/api/auth/login";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, displayName }),
      });
      const payload = await response.json() as { error?: string; confirmationRequired?: boolean };
      if (!response.ok) throw new Error(payload.error || "操作失败，请稍后重试。");
      if (mode === "recover" || payload.confirmationRequired) {
        setMode("check-email");
        return;
      }
      router.push("/dashboard");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "操作失败，请稍后重试。");
    } finally {
      setWorking(false);
    }
  }

  const heading = mode === "login" ? "欢迎回来" : mode === "register" ? "创建你的账户" : mode === "recover" ? "找回账户" : "检查你的邮箱";
  const intro = mode === "login"
    ? "使用邮箱和密码登录。会话将在当前设备安全保持。"
    : mode === "register"
      ? "设置密码并完成一次邮箱确认，之后即可直接登录。"
      : mode === "recover"
        ? "我们会发送安全链接，用于设置新密码。"
        : "安全链接已经发送，请打开邮件完成操作。";

  return (
    <main className="auth-page">
      <Link className="auth-back" href="/">← 返回 Acaora</Link>
      <section className="auth-shell">
        <div className="auth-story">
          <Link className="acaora-brand light" href="/"><span>A</span><div><strong>Acaora</strong><small>学曦</small></div></Link>
          <div className="auth-story-copy"><span>ONE ACCOUNT · ALL YOUR WORK</span><h1>你的课程、研究与数据，<br />持续积累。</h1><p>一个账户管理课程进度、论文笔记、数据项目和 AI 学习记录。原始文件仍默认留在你的设备。</p></div>
          <div className="auth-privacy"><b>◉</b><div><strong>账户安全</strong><p>密码由 Supabase Auth 安全处理；本站不保存或读取你的明文密码。</p></div></div>
          <div className="auth-orbit"><i /><i /><i /><b>A</b></div>
        </div>

        <div className="auth-form-side">
          <div className="auth-form-wrap">
            <div className="auth-form-head"><span>ACCOUNT</span><h2>{heading}</h2><p>{intro}</p></div>

            {configured === false && <div className="auth-setup-note"><b>账户服务等待连接</b><p>Supabase 环境变量尚未配置，当前仍可使用匿名模式。</p></div>}

            {mode === "check-email" ? <div className="auth-check-email">
              <span>✓</span><h3>邮件已发送至</h3><strong>{email}</strong><p>请打开邮件中的安全链接完成操作。完成后将自动返回 Acaora。</p><button type="button" onClick={() => switchMode("login")}>返回密码登录</button>
            </div> : <>
              {mode !== "recover" && <div className="auth-mode-tabs" role="tablist" aria-label="账户操作">
                <button type="button" role="tab" aria-selected={mode === "login"} className={mode === "login" ? "active" : ""} onClick={() => switchMode("login")}>密码登录</button>
                <button type="button" role="tab" aria-selected={mode === "register"} className={mode === "register" ? "active" : ""} onClick={() => switchMode("register")}>注册账户</button>
              </div>}
              <form onSubmit={(event) => void submit(event)}>
                {mode === "register" && <label htmlFor="display-name">昵称<input className="auth-text-input" id="display-name" type="text" required maxLength={40} autoComplete="name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="你的昵称" /></label>}
                <label htmlFor="account-email">邮箱地址<div className="email-field"><span>@</span><input id="account-email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@qq.com" /></div></label>
                {mode !== "recover" && <label htmlFor="account-password">密码<div className="password-field"><input id="account-password" type="password" required minLength={8} maxLength={72} autoComplete={mode === "register" ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="至少 8 位，含大小写字母和数字" /></div></label>}
                {mode === "register" && <label htmlFor="confirm-password">确认密码<input className="auth-text-input" id="confirm-password" type="password" required minLength={8} maxLength={72} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="再次输入密码" /></label>}
                {mode === "login" && <button className="auth-forgot" type="button" onClick={() => switchMode("recover")}>忘记密码？</button>}
                <button className="auth-submit" type="submit" disabled={working || configured !== true}>{working ? "正在处理…" : mode === "login" ? "登录账户" : mode === "register" ? "创建账户" : "发送重置链接"}<span>→</span></button>
              </form>
              {mode === "recover" && <button className="auth-return" type="button" onClick={() => switchMode("login")}>← 返回密码登录</button>}
            </>}

            {message && <div className="auth-message error" role="alert">{message}</div>}
            <div className="auth-divider"><span>或</span></div>
            <a className="guest-entry" href="/dashboard?guest=1">先以匿名模式体验 <span>→</span></a>
            <p className="auth-legal">注册即表示你同意平台按隐私说明处理账户与学习数据。密码只由认证服务验证，Acaora 不保存明文密码。</p>
            <div className="email-support"><span>支持</span><b>QQ 邮箱</b><b>163 / 126</b><b>Outlook</b><b>Gmail</b><b>学校邮箱</b></div>
          </div>
        </div>
      </section>
    </main>
  );
}
