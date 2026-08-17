"use client";

import { ChangeEvent, useEffect, useState } from "react";
import AppSidebar from "../components/app-sidebar";

type Profile = {
  display_name: string;
  university: string;
  major: string;
  graduation_year: number | "";
  preferences: { avatar: string; bio: string; interests: string[]; language: string };
};

const emptyProfile: Profile = { display_name: "", university: "", major: "", graduation_year: "", preferences: { avatar: "", bio: "", interests: [], language: "zh-CN" } };

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [email, setEmail] = useState("");
  const [interestInput, setInterestInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    fetch("/api/profile", { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) return null;
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "资料读取失败。" );
        return payload;
      })
      .then((payload) => {
        if (!payload) return;
        setSignedIn(true);
        setEmail(payload.user?.email || "");
        const next = payload.profile || {};
        setProfile({
          display_name: next.display_name || "",
          university: next.university || "",
          major: next.major || "",
          graduation_year: next.graduation_year || "",
          preferences: { avatar: "", bio: "", interests: [], language: "zh-CN", ...(next.preferences || {}) },
        });
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "资料读取失败。" ))
      .finally(() => setLoading(false));
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
    if (!file.type.startsWith("image/")) {
      setError("请选择图片文件。" );
      return;
    }
    try {
      updatePreference("avatar", await compressAvatar(file));
      setError("");
    } catch {
      setError("头像处理失败，请换一张图片。" );
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
      const response = await fetch("/api/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(profile) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "保存失败。" );
      setMessage("个人资料已保存，并会显示在平台导航中。" );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存失败。" );
    } finally {
      setSaving(false);
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
    await fetch("/api/auth/logout", { method: "POST" });
    location.href = "/";
  }

  return <main className="student-app settings-app">
    <AppSidebar active="settings" />
    <section className="workspace settings-main">
      <header className="topbar settings-topbar"><div><p className="eyebrow">ACCOUNT</p><h1>设置与隐私</h1><p>管理个人资料、数据边界与当前设备。</p></div><button type="button" disabled={!signedIn || saving} onClick={() => void saveProfile()}>{saving ? "正在保存…" : "保存更改"}</button></header>
      {loading ? <div className="settings-state">正在读取账户资料…</div> : !signedIn ? <div className="settings-state"><span>ACCOUNT REQUIRED</span><h2>登录后管理个人资料</h2><p>匿名模式仍可使用本地数据分析，但头像、昵称和课程信息不会同步。</p><a href="/auth">邮箱登录</a></div> : <>
        {(message || error) && <div className={`settings-message ${error ? "error" : ""}`} role="status">{error || message}</div>}
        <div className="settings-grid">
          <section className="profile-card">
            <div className="settings-section-head"><span>01</span><div><p>PROFILE</p><h2>个人资料</h2></div></div>
            <div className="avatar-editor">{profile.preferences.avatar ? <img src={profile.preferences.avatar} alt="当前头像" /> : <b>{(profile.display_name || email).slice(0, 2).toUpperCase()}</b>}<div><label>更换头像<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void chooseAvatar(event)} /></label>{profile.preferences.avatar && <button type="button" onClick={() => updatePreference("avatar", "")}>移除</button>}<small>自动裁剪并压缩为 256 × 256</small></div></div>
            <div className="settings-form"><label>昵称<input value={profile.display_name} maxLength={40} onChange={(event) => updateField("display_name", event.target.value)} /></label><label>登录邮箱<input value={email} disabled /></label><label>学校<input value={profile.university} maxLength={80} placeholder="例如：××大学" onChange={(event) => updateField("university", event.target.value)} /></label><label>专业 / 双学位<input value={profile.major} maxLength={100} placeholder="应用统计学 · 国际经济与贸易" onChange={(event) => updateField("major", event.target.value)} /></label><label>预计毕业年份<input type="number" min={2000} max={2100} value={profile.graduation_year} onChange={(event) => updateField("graduation_year", event.target.value ? Number(event.target.value) : "")} /></label><label>界面语言<select value={profile.preferences.language} onChange={(event) => updatePreference("language", event.target.value)}><option value="zh-CN">简体中文</option><option value="en">English（预留）</option></select></label><label className="full">个人简介<textarea maxLength={240} value={profile.preferences.bio} placeholder="研究兴趣、学习目标或希望长期积累的方向" onChange={(event) => updatePreference("bio", event.target.value)} /></label></div>
            <div className="interest-editor"><label>学习与研究兴趣</label><div>{profile.preferences.interests.map((item) => <button type="button" key={item} onClick={() => updatePreference("interests", profile.preferences.interests.filter((current) => current !== item))}>{item} ×</button>)}</div><form onSubmit={(event) => { event.preventDefault(); addInterest(); }}><input value={interestInput} onChange={(event) => setInterestInput(event.target.value)} placeholder="如：计量经济学" /><button type="submit">添加</button></form></div>
          </section>
          <aside className="privacy-card">
            <div className="settings-section-head"><span>02</span><div><p>PRIVACY</p><h2>数据与隐私</h2></div></div>
            <article><b>原始文件</b><p>CSV、Excel、统计软件数据和论文 PDF 默认在当前浏览器读取，不会因登录自动上传。</p></article><article><b>账户资料</b><p>昵称、头像和学校信息保存在你的 Supabase 用户记录中，并由用户级权限隔离。</p></article><article><b>DeepSeek 密钥</b><p>研究工作台中的 Key 只放在当前浏览器会话；关闭会话后清除。</p><button type="button" onClick={() => { sessionStorage.removeItem("statlab-deepseek-key"); setMessage("已清除当前设备上的 DeepSeek 会话密钥。" ); }}>清除会话密钥</button></article><article><b>导出与退出</b><p>你可以随时导出当前个人资料，或结束此设备上的登录。</p><div><button type="button" onClick={exportProfile}>导出资料</button><button type="button" className="danger" onClick={() => void logout()}>退出登录</button></div></article>
          </aside>
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
  return canvas.toDataURL("image/webp", .78);
}
