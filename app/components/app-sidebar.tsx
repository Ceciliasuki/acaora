"use client";

/* eslint-disable @next/next/no-img-element */

import {
  BarChart3,
  BookOpen,
  FileSearch,
  FolderKanban,
  LayoutDashboard,
  Menu,
  Settings,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { authChangeEvent, getCurrentUser, getProfile } from "../lib/auth-client";
import { IconButton } from "./ui";

type AppSection = "dashboard" | "courses" | "papers" | "data" | "projects" | "settings";

type AppSidebarProps = {
  active: AppSection;
  initials?: string;
  profileTitle?: string;
  profileSubtitle?: string;
  avatarUrl?: string;
};

const navigation: Array<{ id: AppSection; href: string; icon: LucideIcon; label: string }> = [
  { id: "dashboard", href: "/dashboard", icon: LayoutDashboard, label: "总览" },
  { id: "courses", href: "/courses", icon: BookOpen, label: "课程中心" },
  { id: "papers", href: "/papers", icon: FileSearch, label: "论文研究" },
  { id: "data", href: "/data", icon: BarChart3, label: "数据分析" },
  { id: "projects", href: "/projects", icon: FolderKanban, label: "项目空间" },
  { id: "settings", href: "/settings", icon: Settings, label: "设置与隐私" },
];

export default function AppSidebar({
  active,
  initials = "AC",
  profileTitle = "Acaora 用户",
  profileSubtitle = "本地优先模式",
  avatarUrl = "",
}: AppSidebarProps) {
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState({ initials, title: profileTitle, subtitle: profileSubtitle, avatarUrl });

  useEffect(() => {
    let mounted = true;
    async function loadProfile() {
      const user = await getCurrentUser().catch(() => null);
      const data = user ? await getProfile().catch(() => null) : null;
      if (!mounted) return;
      if (!user) {
        setProfile({ initials, title: profileTitle, subtitle: profileSubtitle, avatarUrl });
        return;
      }
      const title = data?.display_name || user.email || profileTitle;
      setProfile({
        initials: String(title).slice(0, 2).toUpperCase(),
        title: String(title),
        subtitle: data?.major || data?.university || "云端同步已开启",
        avatarUrl: data?.preferences?.avatar || "",
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

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  return <>
    <IconButton className="sidebar-menu-button" variant="secondary" label="打开主导航" aria-expanded={open} aria-controls="app-sidebar" onClick={() => setOpen(true)}><Menu size={21} /></IconButton>
    {open && <button className="sidebar-backdrop" type="button" aria-label="关闭主导航" onClick={() => setOpen(false)} />}
    <aside className={`student-sidebar app-sidebar ${open ? "is-open" : ""}`} id="app-sidebar">
      <div className="sidebar-head">
        <Link className="acaora-brand light" href="/dashboard" aria-label="返回 Acaora 工作台" onClick={() => setOpen(false)}>
          <span>A</span>
          <div><strong>Acaora</strong><small>学曦</small></div>
        </Link>
        <IconButton className="sidebar-close-button" variant="ghost" label="关闭主导航" onClick={() => setOpen(false)}><X size={21} /></IconButton>
      </div>
      <nav aria-label="主要导航">
        {navigation.map((item) => {
          const Icon = item.icon;
          return <Link
            aria-current={item.id === active ? "page" : undefined}
            aria-label={item.label}
            className={item.id === active ? "active" : ""}
            href={item.href}
            key={item.id}
            onClick={() => setOpen(false)}
          >
            <Icon size={20} aria-hidden="true" /><span>{item.label}</span>
          </Link>;
        })}
      </nav>
      <div className="student-sidebar-foot">
        <Link className="sidebar-profile-link" href="/settings" aria-label="编辑个人资料" onClick={() => setOpen(false)}>
          {profile.avatarUrl ? <img src={profile.avatarUrl} width="72" height="72" alt="" /> : <b>{profile.initials}</b>}
          <p><strong>{profile.title}</strong><small>{profile.subtitle}</small></p>
        </Link>
      </div>
    </aside>
  </>;
}
