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
import { useEffect, useRef, useState } from "react";
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
  const [isDrawer, setIsDrawer] = useState(false);
  const [profile, setProfile] = useState({ initials, title: profileTitle, subtitle: profileSubtitle, avatarUrl });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

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
    const query = window.matchMedia("(max-width: 600px)");
    const update = () => {
      setIsDrawer(query.matches);
      if (!query.matches) setOpen(false);
    };
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!open || !isDrawer) return;
    const previous = document.body.style.overflow;
    const trigger = triggerRef.current;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(sidebarRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? []);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
      trigger?.focus();
    };
  }, [isDrawer, open]);

  return <>
    <IconButton ref={triggerRef} className="sidebar-menu-button" variant="secondary" label="打开主导航" aria-expanded={open} aria-controls="app-sidebar" onClick={() => setOpen(true)}><Menu size={21} /></IconButton>
    {open && <button className="sidebar-backdrop" type="button" aria-label="关闭主导航" onClick={() => setOpen(false)} />}
    <aside ref={sidebarRef} className={`student-sidebar app-sidebar ${open ? "is-open" : ""}`} id="app-sidebar" aria-label="应用导航" inert={isDrawer && !open ? true : undefined}>
      <div className="sidebar-head">
        <Link className="acaora-brand light" href="/dashboard" aria-label="返回 Acaora 工作台" onClick={() => setOpen(false)}>
          <span>A</span>
          <div><strong>Acaora</strong><small>学曦</small></div>
        </Link>
        <IconButton ref={closeRef} className="sidebar-close-button" variant="ghost" label="关闭主导航" onClick={() => setOpen(false)}><X size={21} /></IconButton>
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
