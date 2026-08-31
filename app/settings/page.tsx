"use client";

/* eslint-disable @next/next/no-img-element */

import { ChangeEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppSidebar from "../components/app-sidebar";
import { Button, FormField, Input, PageHeader, PasswordField, StatusMessage, Textarea } from "../components/ui";
import { clearAiKey, readAiKey, saveAiKey } from "../lib/ai-settings";
import { getCurrentUser, getProfile, saveProfile as saveAccountProfile, signOut, updatePassword, type Profile } from "../lib/auth-client";
import { getShortCommit, type BuildVersion } from "../lib/version";

const emptyProfile: Profile = {
  display_name: "",
  university: "",
  major: "",
  graduation_year: "",
  preferences: { avatar: "", bio: "", interests: [], language: "zh-CN" },
};

export default function SettingsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [email, setEmail] = useState("");
  const [interestInput, setInterestInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [aiKey, setAiKey] = useState("");
  const [aiModel, setAiModel] = useState("DeepSeek（服务器默认）");
  const [version, setVersion] = useState<BuildVersion | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setAiKey(readAiKey());
      const [versionResult, aiResult] = await Promise.allSettled([
        fetch("/api/version", { cache: "no-store" }).then((response) => response.json() as Promise<BuildVersion>),
        fetch("/api/papers/ai", { cache: "no-store" }).then((response) => response.json() as Promise<{ model?: string }>),
      ]);
      if (mounted && versionResult.status === "fulfilled") setVersion(versionResult.value);
      if (mounted && aiResult.status === "fulfilled") setAiModel(aiResult.value.model || "DeepSeek（服务器默认）");

      try {
        const user = await getCurrentUser();
        if (!user) return;
        const next = await getProfile();
        if (!mounted) return;
        setSignedIn(true);
        setEmail(user.email || "");
        setProfile({
          ...emptyProfile,
          ...(next || {}),
          preferences: { ...emptyProfile.preferences, ...(next?.preferences || {}) },
        });
      } catch (cause) {
        if (mounted) setError(cause instanceof Error ? cause.message : "资料读取失败。");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => { mounted = false; };
  }, []);

  function updateField<Key extends keyof Omit<Profile, "preferences">>(key: Key, value: Profile[Key]) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  function updatePreference<Key extends keyof Profile["preferences"]>(key: Key, value: Profile["preferences"][Key]) {
    setProfile((current) => ({ ...current, preferences: { ...current.preferences, [key]: value } }));
  }

  async function chooseAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("请选择 PNG、JPEG 或 WebP 图片。");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("头像原图不能超过 5 MB。");
      return;
    }
    try {
      const avatar = await compressAvatar(file);
      if (avatar.length > 260_000) throw new Error("AVATAR_TOO_LARGE");
      updatePreference("avatar", avatar);
      setError("");
    } catch {
      setError("头像处理后仍然过大，请换一张更简单的图片。");
    }
  }

  function addInterest() {
    const value = interestInput.trim().slice(0, 24);
    if (!value || profile.preferences.interests.includes(value)) return;
    updatePreference("interests", [...profile.preferences.interests, value].slice(0, 12));
    setInterestInput("");
  }

  async function saveProfile() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const saved = await saveAccountProfile(profile);
      setProfile(saved);
      setMessage("个人资料已保存。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存失败。");
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    if (newPassword !== confirmNewPassword) {
      setError("两次输入的新密码不一致。");
      return;
    }
    setChangingPassword(true);
    setError("");
    setMessage("");
    try {
      await updatePassword(newPassword);
      setNewPassword("");
      setConfirmNewPassword("");
      setMessage("登录密码已更新。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "密码更新失败。");
    } finally {
      setChangingPassword(false);
    }
  }

  function saveAiSettings() {
    saveAiKey(aiKey);
    setAiKey(readAiKey());
    setMessage(aiKey.trim() ? "AI Key 已保存到当前浏览器会话。" : "当前会话的 AI Key 已清除。");
  }

  function exportProfile() {
    const blob = new Blob([JSON.stringify({ email, ...profile, exported_at: new Date().toISOString() }, null, 2)], { type: "application/json" });
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = "acaora-profile.json";
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  }

  async function logout() {
    await signOut().catch(() => undefined);
    router.replace("/");
    router.refresh();
  }

  return <main className="student-app settings-app">
    <AppSidebar active="settings" />
    <section className="workspace settings-main">
      <PageHeader eyebrow="ACCOUNT SETTINGS" title="设置" description="管理个人资料、账户安全、AI 模型与数据边界。" actions={<Button disabled={!signedIn || saving} loading={saving} onClick={() => void saveProfile()}>保存资料</Button>} />
      <nav className="settings-nav" aria-label="设置分区"><a href="#profile">个人资料</a><a href="#security">账户与安全</a><a href="#ai-models">AI 与模型</a><a href="#privacy">隐私与数据</a><a href="#about">关于</a></nav>

      {loading ? <div className="settings-state" role="status">正在核验账户状态…</div> : !signedIn ? <div className="settings-state"><span>ACCOUNT REQUIRED</span><h2>登录后管理个人资料</h2><p>当前设备没有可用的登录会话。请重新登录后继续。</p><Link href="/auth">前往登录</Link></div> : <>
        {(message || error) && <StatusMessage tone={error ? "error" : "success"}>{error || message}</StatusMessage>}
        <div className="settings-sections">
          <section className="settings-panel" id="profile">
            <div className="settings-section-head"><span>01</span><div><p>PROFILE</p><h2>个人资料</h2></div></div>
            <div className="avatar-editor">{profile.preferences.avatar ? <img src={profile.preferences.avatar} width="256" height="256" alt="当前头像" /> : <b>{(profile.display_name || email).slice(0, 2).toUpperCase()}</b>}<div><label>更换头像<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void chooseAvatar(event)} /></label>{profile.preferences.avatar && <Button variant="secondary" size="sm" onClick={() => updatePreference("avatar", "")}>移除头像</Button>}<small>原图上限 5 MB；保存前压缩为 256 × 256 WebP。当前仍兼容 preferences 中的 base64，后续迁移到对象存储。</small></div></div>
            <div className="settings-form"><FormField label="昵称" id="settings-name"><Input name="display_name" autoComplete="nickname" value={profile.display_name} maxLength={40} onChange={(event) => updateField("display_name", event.target.value)} /></FormField><FormField label="登录邮箱" id="settings-email"><Input name="email" type="email" autoComplete="email" value={email} disabled /></FormField><FormField label="学校" id="settings-university"><Input name="university" autoComplete="organization" value={profile.university} maxLength={80} onChange={(event) => updateField("university", event.target.value)} /></FormField><FormField label="专业 / 双学位" id="settings-major"><Input name="major" value={profile.major} maxLength={100} onChange={(event) => updateField("major", event.target.value)} /></FormField><FormField label="预计毕业年份" id="settings-year"><Input name="graduation_year" type="number" min={2000} max={2100} value={profile.graduation_year} onChange={(event) => updateField("graduation_year", event.target.value ? Number(event.target.value) : "")} /></FormField><FormField label="个人简介" id="settings-bio" className="full"><Textarea name="bio" maxLength={240} value={profile.preferences.bio} onChange={(event) => updatePreference("bio", event.target.value)} /></FormField></div>
            <div className="interest-editor"><span className="interest-label">学习与研究兴趣</span><div>{profile.preferences.interests.map((item) => <button type="button" key={item} onClick={() => updatePreference("interests", profile.preferences.interests.filter((current) => current !== item))}>{item} ×</button>)}</div><form onSubmit={(event) => { event.preventDefault(); addInterest(); }}><Input aria-label="添加学习与研究兴趣" value={interestInput} onChange={(event) => setInterestInput(event.target.value)} placeholder="如：计量经济学" /><Button type="submit">添加</Button></form></div>
          </section>

          <section className="settings-panel" id="security">
            <div className="settings-section-head"><span>02</span><div><p>ACCOUNT & SECURITY</p><h2>账户与安全</h2></div></div>
            <p className="settings-panel-copy">Acaora 使用同源 HttpOnly Cookie 维持会话；浏览器脚本不能读取 access token 或 refresh token。</p>
            <div className="settings-narrow-form"><FormField label="新密码" id="settings-new-password"><PasswordField autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} showPolicy /></FormField><FormField label="确认新密码" id="settings-confirm-password" error={confirmNewPassword && newPassword !== confirmNewPassword ? "两次输入的新密码不一致。" : undefined}><PasswordField autoComplete="new-password" value={confirmNewPassword} onChange={(event) => setConfirmNewPassword(event.target.value)} /></FormField><Button loading={changingPassword} disabled={!newPassword || !confirmNewPassword} onClick={() => void changePassword()}>更新密码</Button></div>
          </section>

          <section className="settings-panel" id="ai-models">
            <div className="settings-section-head"><span>03</span><div><p>AI & MODELS</p><h2>AI 与模型</h2></div></div>
            <p className="settings-panel-copy">当前模型：<strong>{aiModel}</strong>。Key 仅保存在当前浏览器会话；发起分析时，Key 和所选文本会发送到 Acaora 服务端并转发给 DeepSeek。Acaora 不把 Key 写入账户数据库。</p>
            <div className="settings-narrow-form"><FormField label="DeepSeek API Key" id="settings-ai-key" hint="关闭浏览器会话后自动清除。"><Input type="password" name="deepseek-key" autoComplete="off" spellCheck={false} value={aiKey} onChange={(event) => setAiKey(event.target.value)} placeholder="sk-…" /></FormField><div className="settings-inline-actions"><Button onClick={saveAiSettings}>保存到当前会话</Button><Button variant="secondary" onClick={() => { clearAiKey(); setAiKey(""); setMessage("当前会话的 AI Key 已清除。"); }}>清除</Button></div></div>
          </section>

          <section className="settings-panel" id="privacy">
            <div className="settings-section-head"><span>04</span><div><p>PRIVACY & DATA</p><h2>隐私与数据</h2></div></div>
            <div className="settings-info-grid"><article><b>原始文件</b><p>CSV、Excel、统计软件数据和论文 PDF 默认只在当前浏览器读取，不会因登录自动上传。</p></article><article><b>账户同步</b><p>个人资料、项目、提取后的论文文本、译文与笔记按账户隔离同步；原始 PDF 不上传。</p></article><article><b>资料导出</b><p>导出当前个人资料的 JSON 副本，不包含密码和认证 token。</p><Button variant="secondary" onClick={exportProfile}>导出资料</Button></article><article><b>结束会话</b><p>退出会清除当前站点的服务端会话 Cookie。</p><Button variant="danger" onClick={() => void logout()}>退出登录</Button></article></div>
          </section>

          <section className="settings-panel settings-about" id="about">
            <div className="settings-section-head"><span>05</span><div><p>ABOUT</p><h2>关于 Acaora</h2></div></div>
            <p>大学生学习与研究工作台。生产构建可通过 <code>/api/version</code> 独立核验。</p>
            <small>Build {version ? getShortCommit(version.commit) : "读取中"} · {version?.environment || "unknown"} · {version?.buildTime || "unknown"}</small>
          </section>
        </div>
      </>}
    </section>
  </main>;
}

async function compressAvatar(file: File) {
  const bitmap = await createImageBitmap(file);
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("CANVAS_UNAVAILABLE");
  const crop = Math.min(bitmap.width, bitmap.height);
  context.drawImage(bitmap, (bitmap.width - crop) / 2, (bitmap.height - crop) / 2, crop, crop, 0, 0, size, size);
  bitmap.close();
  return canvas.toDataURL("image/webp", .72);
}
