"use client";

/* eslint-disable @next/next/no-html-link-for-pages, @next/next/no-img-element */

import { useEffect, useState } from "react";
import { authChangeEvent, browserAuthenticatedFetch, getBrowserUser } from "../lib/browser-auth";

type AppSection = "dashboard" | "courses" | "papers" | "data" | "projects" | "settings";

type AppSidebarProps = {
  active: AppSection;
  initials?: string;
  profileTitle?: string;
  profileSubtitle?: string;
  avatarUrl?: string;
};

const navigation: Array<{ id: AppSection; href: string; icon: string; label: string }> = [
  { id: "dashboard", href: "/dashboard", icon: "⌂", label: "总览" },
  { id: "courses", href: "/courses", icon: "◫", label: "课程中心" },
  { id: "papers", href: "/papers", icon: "文", label: "论文研究" },
  { id: "data", href: "/data", icon: "Σ", label: "数据分析" },
  { id: "projects", href: "/projects", icon: "◇", label: "项目空间" },
  { id: "settings", href: "/settings", icon: "⚙", label: "设置与隐私" },
];

export default function AppSidebar({
  active,
  initials = "AC",
  profileTitle = "Acaora 用户",
  profileSubtitle = "本地优先模式",
  avatarUrl = "",
}: AppSidebarProps) {
  const [profile, setProfile] = useState({ initials, title: profileTitle, subtitle: profileSubtitle, avatarUrl });

  useEffect(() => {
    let mounted = true;
    async function loadProfile() {
      const user = await getBrowserUser().catch(() => null);
      const response = await browserAuthenticatedFetch("/api/profile", { cache: "no-store" }).catch(() => null);
      const data = response?.ok ? await response.json().catch(() => null) : null;
      if (!mounted) return;
      if (!user && !data?.user) {
        setProfile({ initials, title: profileTitle, subtitle: profileSubtitle, avatarUrl });
        return;
      }
      const title = data?.profile?.display_name || user?.user_metadata?.display_name || data?.user?.email || user?.email || profileTitle;
      setProfile({
        initials: String(title).slice(0, 2).toUpperCase(),
        title: String(title),
        subtitle: data?.profile?.major || data?.profile?.university || "云端同步已开启",
        avatarUrl: data?.profile?.preferences?.avatar || "",
      });
    }
    const reload = () => { void loadProfile(); };
    void loadProfile();
    window.addEventListener(authChangeEvent, reload);
    window.addEventListener("acaora:profile-change", reload);
    return () => {
      mounted = false;
      window.removeEventListener(authChangeEvent, reload);
      window.removeEventListener("acaora:profile-change", reload);
    };
  }, [avatarUrl, initials, profileSubtitle, profileTitle]);

  return (
    <aside className="student-sidebar app-sidebar">
      <a className="acaora-brand light" href="/" aria-label="返回 Acaora 首页">
        <span>A</span>
        <div><strong>Acaora</strong><small>学曦</small></div>
      </a>
      <nav aria-label="主要导航">
        {navigation.map((item) => (
          <a
            aria-current={item.id === active ? "page" : undefined}
            aria-label={item.label}
            className={item.id === active ? "active" : ""}
            href={item.href}
            key={item.id}
          >
            <i aria-hidden="true">{item.icon}</i><span>{item.label}</span>
          </a>
        ))}
      </nav>
      <div className="student-sidebar-foot">
        <a className="sidebar-profile-link" href="/settings" aria-label="编辑个人资料">
          {profile.avatarUrl ? <img src={profile.avatarUrl} width="72" height="72" alt="个人头像" /> : <b>{profile.initials}</b>}
          <p><strong>{profile.title}</strong><small>{profile.subtitle}</small></p>
        </a>
      </div>
    </aside>
  );
}

