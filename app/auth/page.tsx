"use client";

import { FormEvent, useEffect, useState } from "react";

type Step = "email" | "code";

export default function AuthPage() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    void fetch("/api/auth/status").then((response) => response.json()).then((payload: { configured?: boolean }) => setConfigured(Boolean(payload.configured))).catch(() => setConfigured(false));
  }, []);

  useEffect(() => {
    if (retry <= 0) return;
    const timer = window.setInterval(() => setRetry((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [retry]);

  async function sendCode(event?: FormEvent) {
    event?.preventDefault();
    if (!configured || retry > 0) return;
    setWorking(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/otp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const payload = await response.json() as { error?: string; retryAfter?: number };
      if (!response.ok) throw new Error(payload.error ?? "验证码发送失败。" );
      setStep("code");
      setRetry(payload.retryAfter ?? 60);
      setMessage("验证码已发送，请检查收件箱和垃圾邮件。" );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "验证码发送失败。" );
    } finally {
      setWorking(false);
    }
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault();
    if (code.length !== 6) return;
    setWorking(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, token: code }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "验证码验证失败。" );
      window.location.assign("/dashboard");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "验证码验证失败。" );
    } finally {
      setWorking(false);
    }
  }

  return (
    <main className="auth-page">
      <a className="auth-back" href="/">← 返回 Acaora</a>
      <section className="auth-shell">
        <div className="auth-story">
          <a className="acaora-brand light" href="/"><span>A</span><div><strong>Acaora</strong><small>学曦</small></div></a>
          <div className="auth-story-copy"><span>YOUR LEARNING, CONTINUED</span><h1>在每台设备上，<br />继续你的思考。</h1><p>登录后同步论文进度、笔记、AI 分析与课程项目。原始 PDF 和数据仍默认留在你的设备。</p></div>
          <div className="auth-privacy"><b>◉</b><div><strong>隐私分层</strong><p>本地文件、云端记忆和 AI 请求分别控制，不会因为登录自动上传全部内容。</p></div></div>
          <div className="auth-orbit"><i /><i /><i /><b>A</b></div>
        </div>

        <div className="auth-form-side">
          <div className="auth-form-wrap">
            <div className="auth-form-head"><span>{step === "email" ? "WELCOME" : "CHECK YOUR EMAIL"}</span><h2>{step === "email" ? "登录或创建账户" : "输入六位验证码"}</h2><p>{step === "email" ? "无需密码。新邮箱验证成功后会自动创建账户。" : <>验证码已发送至 <strong>{email}</strong></>}</p></div>

            {configured === false && <div className="auth-setup-note"><b>云端认证等待连接</b><p>登录界面已经就绪；完成 Supabase 与发信服务连接后，即可向 QQ、163、Outlook、Gmail 和学校邮箱发送验证码。</p></div>}

            {step === "email" ? <form onSubmit={(event) => void sendCode(event)}>
              <label htmlFor="account-email">邮箱地址</label>
              <div className="email-field"><span>@</span><input id="account-email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@qq.com" /></div>
              <button className="auth-submit" type="submit" disabled={working || configured !== true}>{working ? "正在发送…" : "发送验证码"}<span>→</span></button>
            </form> : <form onSubmit={(event) => void verifyCode(event)}>
              <label htmlFor="account-code">邮箱验证码</label>
              <input className="otp-input" id="account-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" />
              <button className="auth-submit" type="submit" disabled={working || code.length !== 6}>{working ? "正在验证…" : "验证并登录"}<span>→</span></button>
              <div className="otp-actions"><button type="button" onClick={() => setStep("email")}>更换邮箱</button><button type="button" disabled={retry > 0} onClick={() => void sendCode()}>{retry > 0 ? `${retry}s 后重新发送` : "重新发送"}</button></div>
            </form>}

            {message && <div className="auth-message" role="status">{message}</div>}
            <div className="auth-divider"><span>或</span></div>
            <a className="guest-entry" href="/dashboard?guest=1">先以匿名模式体验 <span>→</span></a>
            <p className="auth-legal">继续即表示你同意平台仅按隐私说明处理账户与学习数据。你可以随时导出数据或注销账户。</p>
            <div className="email-support"><span>支持</span><b>QQ 邮箱</b><b>163 / 126</b><b>Outlook</b><b>Gmail</b><b>学校邮箱</b></div>
          </div>
        </div>
      </section>
    </main>
  );
}
