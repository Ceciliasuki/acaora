"use client";

/* eslint-disable @next/next/no-img-element */

import craft from '../operational-craft.module.css';
import { ChangeEvent, Suspense, useEffect, useRef,useState } from "react";
import { X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import AppSidebar from "../components/app-sidebar";
import SettingsNavigation from './settings-navigation';
import { Button, FormField, Input, PasswordField, StatusMessage, Textarea, PageHeader } from "../components/ui";
import { clearAiKey, readAiKey, saveAiKey } from "../lib/ai-settings";
import { authChangeEvent,getCurrentUser, getProfile, saveProfile as saveAccountProfile, signOut, updatePassword, type Profile } from "../lib/auth-client";
import { getShortCommit, type BuildVersion } from "../lib/version";

const emptyProfile: Profile = {
  display_name: "",
  university: "",
  major: "",
  graduation_year: "",
  preferences: { avatar: "", bio: "", interests: [], language: "zh-CN" },
};

function allowedAiReturnTo(value: string | null): string | null {
  if (!value || !value.startsWith('/papers?') || /[\\\p{Cc}]/u.test(value)) return null;
  try {
    const url = new URL(value, 'https://acaora.invalid');
    if (url.origin !== 'https://acaora.invalid' || url.pathname !== '/papers' || url.hash) return null;
    const allowed = ['paper', 'paragraph', 'view', 'mode', 'action'];
    if ([...url.searchParams.keys()].some(key => !allowed.includes(key) || url.searchParams.getAll(key).length !== 1)) return null;
    const paper = url.searchParams.get('paper'), paragraph = url.searchParams.get('paragraph');
    const action = url.searchParams.get('action') ?? 'paragraph';
    if (!paper || paper.length > 200 || /[\\\p{Cc}]/u.test(paper) || paragraph && (paragraph.length > 200 || /[\\\p{Cc}]/u.test(paragraph))) return null;
    if (url.searchParams.get('view') !== 'reader' || url.searchParams.get('mode') !== 'ai' || !['paragraph', 'summary', 'audit', 'replication', 'translate', 'chat', 'search'].includes(action)) return null;
    const query = new URLSearchParams({view: 'reader', paper, mode: 'ai', action});
    if (paragraph) query.set('paragraph', paragraph);
    return `/papers?${query}`;
  } catch {return null;}
}

function AiTaskReturn({configured, guest = false}: {configured: boolean; guest?: boolean}) {
  const search = useSearchParams();
  const returnTo = allowedAiReturnTo(search.get('returnTo'));
  if (!returnTo) return null;
  return <div className="settings-panel-copy">
    <p>{guest ? '登录后配置模型，再返回当前任务。' : configured ? '当前会话已有 Key。返回后请确认论文、段落和分析方式，再手动运行。' : '保存当前会话的 Key 后，可返回原来的论文与 AI 操作。返回不会自动调用模型。'}</p>
    <Link href={returnTo}>返回原来的 AI 任务</Link>
  </div>;
}

export default function SettingsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [email, setEmail] = useState("");
  const [savedProfile, setSavedProfile] = useState(JSON.stringify(emptyProfile));
  const profileDirty = JSON.stringify(profile) !== savedProfile;
  const [interestInput, setInterestInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  /* A failed request is its own state. Reporting it as "not signed in" tells the
     student something false about their account, which is the defect this fixes. */
  const [sessionError, setSessionError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  /* The model name is only trustworthy when the request succeeded AND the server
     declared one; a built-in default is not a confirmed configuration. */
  const [aiModelState, setAiModelState] = useState<"loading" | "ready" | "fallback" | "error">("loading");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [aiKey, setAiKey] = useState("");
  const [aiConfigured, setAiConfigured] = useState(false);
  const [aiModel, setAiModel] = useState("");
  const [version, setVersion] = useState<BuildVersion | null>(null);
  const [versionState, setVersionState] = useState<"loading" | "ready" | "error">("loading");
  const accountEpoch=useRef(0),ownerId=useRef<string|null>(null);

  useEffect(()=>{const accountGeneration=accountEpoch;const changed=()=>{accountEpoch.current++;ownerId.current=null;setLoading(true);setSessionError('');setSignedIn(false);setProfile(emptyProfile);setSavedProfile(JSON.stringify(emptyProfile));setEmail('');setNewPassword('');setConfirmNewPassword('');setInterestInput('');setAiKey('');setAiConfigured(false);setMessage('');setError('');setSaving(false);setChangingPassword(false);setReloadKey(key=>key+1);};window.addEventListener(authChangeEvent,changed);return()=>{accountGeneration.current++;window.removeEventListener(authChangeEvent,changed);};},[]);

  useEffect(() => {
    let mounted = true;
    const epoch=accountEpoch.current;
    const current=()=>mounted&&epoch===accountEpoch.current;
    async function load() {
      setLoading(true);
      setSessionError("");
      setAiKey(readAiKey());
      setAiConfigured(Boolean(readAiKey()));
      // Metadata is independent of account fields; an unavailable model endpoint
      // must not hold the entire settings form behind its network timeout.
      void Promise.allSettled([
        fetch("/api/version", { cache: "no-store" }).then((response) => {if (!response.ok) throw new Error("VERSION_UNAVAILABLE"); return response.json() as Promise<BuildVersion>;}),
        fetch("/api/papers/ai", { cache: "no-store" }).then((response) => {if (!response.ok) throw new Error("MODEL_UNAVAILABLE"); return response.json() as Promise<{ model?: string }>;}),
      ]).then(([versionResult, aiResult]) => {
      if (mounted) {
        if (versionResult.status === "fulfilled") {
          setVersion(versionResult.value);
          setVersionState("ready");
        } else {
          setVersionState("error");
        }
      }
      if (mounted) {
        const declared = aiResult.status === "fulfilled" ? (aiResult.value.model ?? "").trim() : "";
        setAiModel(declared);
        setAiModelState(aiResult.status !== "fulfilled" ? "error" : declared ? "ready" : "fallback");
      }
      });

      try {
        const user = await getCurrentUser();
        if (!current()) return;
        /* null user = genuinely signed out; a throw = the request failed. */
        if (!user) {
          setSignedIn(false);
          ownerId.current=null;
          return;
        }
        const next = await getProfile(user.id);
        if (!current()) return;
        ownerId.current=user.id;
        setSignedIn(true);
        setEmail(user.email || "");
        const loadedProfile = {
          ...emptyProfile,
          ...(next || {}),
          preferences: { ...emptyProfile.preferences, ...(next?.preferences || {}) },
        };
        setProfile(loadedProfile);
        setSavedProfile(JSON.stringify(loadedProfile));
      } catch (cause) {
        if (current()) {
          setSignedIn(false);
          setSessionError(cause instanceof Error ? cause.message : "账户状态读取失败。");
        }
      } finally {
        if (current()) setLoading(false);
      }
    }
    void load();
    return () => { mounted = false; };
  }, [reloadKey]);

  function updateField<Key extends keyof Omit<Profile, "preferences">>(key: Key, value: Profile[Key]) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  function updatePreference<Key extends keyof Profile["preferences"]>(key: Key, value: Profile["preferences"][Key]) {
    setProfile((current) => ({ ...current, preferences: { ...current.preferences, [key]: value } }));
  }

  async function chooseAvatar(event: ChangeEvent<HTMLInputElement>) {
    const epoch=accountEpoch.current;
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
      if(epoch!==accountEpoch.current)return;
      if (avatar.length > 260_000) throw new Error("AVATAR_TOO_LARGE");
      updatePreference("avatar", avatar);
      setError("");
    } catch {
      if(epoch===accountEpoch.current)setError("头像处理后仍然过大，请换一张更简单的图片。");
    }
  }

  function addInterest() {
    const value = interestInput.trim().slice(0, 24);
    if (!value || profile.preferences.interests.includes(value)) return;
    updatePreference("interests", [...profile.preferences.interests, value].slice(0, 12));
    setInterestInput("");
  }

  async function saveProfile() {
    const epoch=accountEpoch.current,actor=ownerId.current;if(!actor||saving)return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const saved = await saveAccountProfile(profile,actor);
      if(epoch!==accountEpoch.current||ownerId.current!==actor)return;
      setProfile(current => JSON.stringify(current) === JSON.stringify(profile) ? saved : current);
      setSavedProfile(JSON.stringify(saved));
      setMessage("个人资料已保存。");
    } catch (cause) {
      if(epoch===accountEpoch.current)setError(cause instanceof Error ? cause.message : "保存失败。");
    } finally {
      if(epoch===accountEpoch.current)setSaving(false);
    }
  }

  async function changePassword() {
    const epoch=accountEpoch.current,actor=ownerId.current;if(!actor||changingPassword)return;
    if (newPassword !== confirmNewPassword) {
      setError("两次输入的新密码不一致。");
      return;
    }
    setChangingPassword(true);
    setError("");
    setMessage("");
    try {
      await updatePassword(newPassword,actor);
      if(epoch!==accountEpoch.current||ownerId.current!==actor)return;
      setNewPassword("");
      setConfirmNewPassword("");
      setMessage("登录密码已更新。");
    } catch (cause) {
      if(epoch===accountEpoch.current)setError(cause instanceof Error ? cause.message : "密码更新失败。");
    } finally {
      if(epoch===accountEpoch.current)setChangingPassword(false);
    }
  }

  function saveAiSettings() {
    setError(""); setMessage("");
    try {
      saveAiKey(aiKey);
      setAiKey(readAiKey());
      setAiConfigured(Boolean(readAiKey()));
      setMessage(aiKey.trim() ? "AI Key 已保存到当前浏览器会话。" : "当前会话的 AI Key 已清除。");
    } catch {
      setError("当前浏览器无法保存会话设置。请检查存储权限后重试，输入仍保留在此处。");
    }
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
    try{await signOut();router.replace("/");router.refresh();}catch(cause){setError(cause instanceof Error?cause.message:'退出未完成，请重试。');}
  }

  return <main className={`student-app settings-app workspace-refresh ${craft.craft}`}>
    <AppSidebar active="settings" />
    <section className="workspace settings-main settings-shell">
      <PageHeader className="workspace-header" title="设置" description="管理个人资料、账户安全与模型设置。" actions={signedIn ? <>{profileDirty && <span className="workspace-draft-state">资料有未保存修改</span>}<Button disabled={saving} loading={saving} onClick={() => void saveProfile()}>保存资料</Button></> : undefined} />

      <div className="page-body">

      {signedIn && !loading && <SettingsNavigation />}

      {loading ? <div className="settings-state" role="status">正在读取账户…</div> : sessionError ? <div className="settings-state" role="alert"><h2>暂时无法读取账户状态</h2><p>{sessionError}这不代表你没有登录；请重试一次。</p><Button variant="secondary" onClick={() => setReloadKey((key) => key + 1)}>重新加载</Button></div> : !signedIn ? <div className="settings-state"><h2>登录后管理个人资料</h2><p>当前设备没有可用的登录会话。请重新登录后继续。</p><Link href="/auth">前往登录</Link><Suspense fallback={null}><AiTaskReturn configured={false} guest/></Suspense></div> : <>
        {(message || error) && <div className="workspace-feedback" data-tone={error ? "error" : "success"}><StatusMessage tone={error ? "error" : "success"}>{error || message}</StatusMessage></div>}
        <div className="settings-sections">
          <section className="settings-panel" id="profile">
            <div className="settings-section-head"><h2>个人资料</h2></div>
            <div className="avatar-editor">{profile.preferences.avatar ? <img src={profile.preferences.avatar} width="256" height="256" alt="当前头像" /> : <b>{(profile.display_name || email).slice(0, 2).toUpperCase()}</b>}<div><label>更换头像<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void chooseAvatar(event)} /></label>{profile.preferences.avatar && <Button variant="secondary" size="sm" onClick={() => updatePreference("avatar", "")}>移除头像</Button>}<small>支持 PNG、JPEG 和 WebP，最大 5 MB。保存时会压缩图片。</small></div></div>
            <div className="settings-form"><FormField label="昵称" id="settings-name"><Input name="display_name" autoComplete="nickname" value={profile.display_name} maxLength={40} onChange={(event) => updateField("display_name", event.target.value)} /></FormField><FormField label="登录邮箱" id="settings-email"><Input name="email" type="email" autoComplete="email" value={email} disabled /></FormField><FormField label="学校" id="settings-university"><Input name="university" autoComplete="organization" value={profile.university} maxLength={80} onChange={(event) => updateField("university", event.target.value)} /></FormField><FormField label="专业 / 双学位" id="settings-major"><Input name="major" value={profile.major} maxLength={100} onChange={(event) => updateField("major", event.target.value)} /></FormField><FormField label="预计毕业年份" id="settings-year"><Input name="graduation_year" type="number" min={2000} max={2100} value={profile.graduation_year} onChange={(event) => updateField("graduation_year", event.target.value ? Number(event.target.value) : "")} /></FormField><FormField label="个人简介" id="settings-bio" className="full"><Textarea name="bio" maxLength={240} value={profile.preferences.bio} onChange={(event) => updatePreference("bio", event.target.value)} /></FormField></div>
            <div className="interest-editor"><span className="interest-label">学习与研究兴趣</span><div>{profile.preferences.interests.map((item) => <button type="button" key={item} aria-label={`移除兴趣：${item}`} onClick={() => updatePreference("interests", profile.preferences.interests.filter((current) => current !== item))}>{item}<X size={14} aria-hidden="true" /></button>)}</div><form onSubmit={(event) => { event.preventDefault(); addInterest(); }}><Input aria-label="添加学习与研究兴趣" value={interestInput} onChange={(event) => setInterestInput(event.target.value)} placeholder="如：计量经济学" /><Button type="submit">添加</Button></form></div>
          </section>

          <section className="settings-panel" id="security">
            <div className="settings-section-head"><h2>账户与安全</h2></div>
            <p className="settings-panel-copy">更改密码后，请用新密码登录。</p>
            <div className="settings-narrow-form"><FormField label="新密码" id="settings-new-password"><PasswordField autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} showPolicy /></FormField><FormField label="确认新密码" id="settings-confirm-password" error={confirmNewPassword && newPassword !== confirmNewPassword ? "两次输入的新密码不一致。" : undefined}><PasswordField autoComplete="new-password" value={confirmNewPassword} onChange={(event) => setConfirmNewPassword(event.target.value)} /></FormField><Button loading={changingPassword} disabled={!newPassword || !confirmNewPassword} onClick={() => void changePassword()}>更新密码</Button></div>
          </section>

          <section className="settings-panel" id="ai-models">
            <div className="settings-section-head"><h2>AI 与模型</h2></div>
            <p className="settings-panel-copy">{aiModelState === "ready" ? <>当前模型：<strong>{aiModel}</strong>。</> : aiModelState === "fallback" ? <>服务端未声明模型名，实际按服务端默认模型运行。</> : aiModelState === "error" ? <>暂时无法确认当前模型：配置请求失败。</> : <>正在读取服务端模型配置…</>}</p>
            <div className="settings-narrow-form"><FormField label="DeepSeek API Key" id="settings-ai-key" ><Input type="password" name="deepseek-key" autoComplete="off" spellCheck={false} value={aiKey} onChange={(event) => setAiKey(event.target.value)} placeholder="sk-…" /></FormField><div className="settings-inline-actions"><Button onClick={saveAiSettings}>保存到当前会话</Button><Button variant="secondary" onClick={() => { clearAiKey(); setAiKey(""); setAiConfigured(false); setMessage("当前会话的 AI Key 已清除。"); }}>清除</Button></div></div>
            <Suspense fallback={null}><AiTaskReturn configured={aiConfigured}/></Suspense>
          </section>

          <section className="settings-panel" id="privacy">
            <div className="settings-section-head"><h2>隐私与数据</h2></div>
            <div className="settings-info-grid"><article><b>资料导出</b><Button variant="secondary" onClick={exportProfile}>导出资料</Button></article><article><b>账户</b><Button variant="danger" onClick={() => void logout()}>退出登录</Button></article></div>
          </section>

          <section className="settings-panel settings-about" id="about">
            <div className="settings-section-head"><h2>关于 Acaora</h2></div>
            <p>整理课程资料，阅读论文，分析数据和管理研究项目。</p>
            <small>{versionState === "error" ? "暂时无法读取版本" : versionState === "ready" && version ? `Build ${getShortCommit(version.commit)} · ${version.environment || "unknown"} · ${version.buildTime || "unknown"}` : "正在读取版本…"}</small>
          </section>
        </div>
      </>}
      </div>

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
