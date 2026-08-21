"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { browserRecover, browserSignIn, browserSignUp, getBrowserAuthConfig, saveBrowserSession } from "../lib/browser-auth";

type Mode = "login" | "register" | "recover" | "existing-account" | "check-email";
type MailPurpose = "confirmation" | "recovery";
type AuthAvailability = "checking" | "ready" | "not-configured" | "unreachable";

class SiteAuthUnavailableError extends Error {}

async function siteAuthRequest(endpoint: string, body: Record<string, string>) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let payload: { error?: string; confirmationRequired?: boolean; accountMayExist?: boolean };
  try {
    payload = text ? JSON.parse(text) as typeof payload : {};
  } catch {
    throw new SiteAuthUnavailableError("站点认证接口被部署预览限制拦截。");
  }
  if (!response.ok) throw new Error(payload.error || "操作失败，请稍后重试。");
  return payload;
}

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [authAvailability, setAuthAvailability] = useState<AuthAvailability>("checking");
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [mailPurpose, setMailPurpose] = useState<MailPurpose>("confirmation");

  useEffect(() => {
    let active = true;

    async function checkAuthAvailability() {
      try {
        const response = await fetch(`/api/auth/status?fresh=${Date.now()}`, {
          cache: "no-store",
          credentials: "same-origin",
          headers: { "Accept": "application/json" },
        });
        if (!response.ok) throw new Error(`AUTH_STATUS_${response.status}`);
        const payload = await response.json() as { configured?: boolean };
        if (active) setAuthAvailability(payload.configured === true ? "ready" : "not-configured");
      } catch {
        if (active) setAuthAvailability(getBrowserAuthConfig() ? "ready" : "unreachable");
      }
    }

    void checkAuthAvailability();
    return () => { active = false; };
  }, []);

  function switchMode(next: Mode) {
    setMode(next);
    setMessage("");
    setPassword("");
    setConfirmPassword("");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (working) return;
    if (mode === "register" && password !== confirmPassword) {
      setMessage("两次输入的密码不一致。");
      return;
    }
    setWorking(true);
    setMessage("");
    try {
      const endpoint = mode === "register" ? "/api/auth/register" : mode === "recover" ? "/api/auth/recover" : "/api/auth/login";
      let payload: { confirmationRequired?: boolean; accountMayExist?: boolean };
      try {
        payload = await siteAuthRequest(endpoint, { email, password, displayName });
      } catch (error) {
        if (!(error instanceof SiteAuthUnavailableError) || !getBrowserAuthConfig()) throw error;
        const normalizedEmail = email.trim().toLowerCase();
        if (mode === "recover") {
          await browserRecover(normalizedEmail, new URL("/reset", location.origin).toString());
          payload = {};
        } else if (mode === "register") {
          const directPayload = await browserSignUp(normalizedEmail, password, displayName.trim(), new URL("/auth-callback", location.origin).toString());
          if (directPayload.access_token && directPayload.refresh_token) {
            saveBrowserSession(directPayload);
            router.push("/dashboard");
            return;
          }
          payload = directPayload.user && Array.isArray(directPayload.user.identities) && directPayload.user.identities.length === 0
            ? { accountMayExist: true }
            : { confirmationRequired: true };
        } else {
          await browserSignIn(normalizedEmail, password);
          router.push("/dashboard");
          return;
        }
      }
      if (payload.accountMayExist) {
        setMode("existing-account");
        return;
      }
      if (mode === "recover") {
        setMailPurpose("recovery");
        setMode("check-email");
        return;
      }
      if (payload.confirmationRequired) {
        setMailPurpose("confirmation");
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

  async function sendPasswordSetup() {
    if (working) return;
    setWorking(true);
    setMessage("");
    try {
      try {
        await siteAuthRequest("/api/auth/recover", { email });
      } catch (error) {
        if (!(error instanceof SiteAuthUnavailableError) || !getBrowserAuthConfig()) throw error;
        await browserRecover(email.trim().toLowerCase(), new URL("/reset", location.origin).toString());
      }
      setMailPurpose("recovery");
      setMode("check-email");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "密码设置邮件发送失败，请稍后重试。");
    } finally {
      setWorking(false);
    }
  }

  const heading = mode === "login" ? "欢迎回来" : mode === "register" ? "创建你的账户" : mode === "recover" ? "找回账户" : mode === "existing-account" ? "账户可能已存在" : "检查你的邮箱";
  const intro = mode === "login"
    ? "使用邮箱和密码登录。会话将在当前设备安全保持。"
    : mode === "register"
      ? "设置密码并完成一次邮箱确认，之后即可直接登录。"
      : mode === "recover"
        ? "我们会发送安全链接，用于设置新密码。"
        : mode === "existing-account"
          ? "你以前可能已通过验证码创建过账户，无需再次注册。"
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

            {authAvailability === "not-configured" && <div className="auth-setup-note"><b>账户服务等待连接</b><p>当前部署尚未配置账户服务。你仍可使用匿名模式，或联系网站管理员完成配置。</p></div>}
            {authAvailability === "unreachable" && <div className="auth-message" role="status">账户状态检查暂时中断。你仍可继续登录或注册，提交时系统会再次连接。</div>}

            {mode === "check-email" ? <div className="auth-check-email">
              <span>✓</span><h3>{mailPurpose === "recovery" ? "密码设置链接已发送至" : "确认邮件已发送至"}</h3><strong>{email}</strong><p>{mailPurpose === "recovery" ? "请打开邮件中的链接设置新密码。设置完成后，即可使用邮箱和密码登录。" : "请打开邮件中的确认链接完成注册。完成后将自动返回 Acaora。"}</p><button type="button" onClick={() => switchMode("login")}>返回密码登录</button>
            </div> : mode === "existing-account" ? <div className="auth-check-email auth-existing-account">
              <span>i</span><h3>这个邮箱可能已经注册</h3><strong>{email}</strong><p>如果你以前使用过邮箱验证码，账户已经自动创建。发送密码设置链接后，以后可直接使用邮箱和密码登录。</p><button className="auth-primary-action" type="button" disabled={working} onClick={() => void sendPasswordSetup()}>{working ? "正在发送…" : "发送密码设置链接"}</button><button className="auth-secondary-action" type="button" onClick={() => switchMode("login")}>我已有密码，返回登录</button>
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
                <button className="auth-submit" type="submit" disabled={working}>{working ? "正在处理…" : mode === "login" ? "登录账户" : mode === "register" ? "创建账户" : "发送重置链接"}<span>→</span></button>
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

