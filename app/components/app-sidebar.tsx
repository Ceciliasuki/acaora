"use client";

/* eslint-disable @next/next/no-html-link-for-pages */

import { useEffect, useState } from "react";

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
    let active = true;
    fetch("/api/profile", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (!active || !data?.profile) return;
        const title = data.profile.display_name || data.user?.email || profileTitle;
        const nextInitials = String(title).slice(0, 2).toUpperCase();
        setProfile({
          initials: nextInitials,
          title,
          subtitle: data.profile.major || data.profile.university || profileSubtitle,
          avatarUrl: data.profile.preferences?.avatar || "",
        });
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [profileSubtitle, profileTitle]);

  return (
    <aside className="student-sidebar app-sidebar">
      <a className="acaora-brand light" href="/" aria-label="返回 Acaora 首页">
        <span>A</span>
        <div><strong>Acaora</strong><small>学曦</small></div>
      </a>
      <nav aria-label="主要导航">
        {navigation.map((item) => (
          <a className={item.id === active ? "active" : ""} href={item.href} key={item.id} aria-current={item.id === active ? "page" : undefined}>
            <i aria-hidden="true">{item.icon}</i><span>{item.label}</span>
          </a>
        ))}
      </nav>
      <div className="student-sidebar-foot">
        <a className={active === "settings" ? "active" : ""} href="/settings"><i aria-hidden="true">⚙</i><span>设置与隐私</span></a>
        <a className="sidebar-profile-link" href="/settings" aria-label="编辑个人资料">
          {profile.avatarUrl ? <img src={profile.avatarUrl} alt="个人头像" /> : <b>{profile.initials}</b>}
          <p><strong>{profile.title}</strong><small>{profile.subtitle}</small></p>
        </a>
      </div>
    </aside>
  );
}
