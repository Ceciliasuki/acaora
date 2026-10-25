"use client";

/* eslint-disable @next/next/no-img-element */

import {
  Menu,
  CircleHelp,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { authChangeEvent, getCurrentUser, getProfile } from "../lib/auth-client";
import { IconButton } from "./ui";
import MotionNavigation from './motion-navigation';
import useHoverNavigation from './use-hover-navigation';
import {navigation, type AppSection} from './workspace-navigation';
import QuickNavigation from './quick-navigation';

type AppSidebarProps = {
  active: AppSection;
  initials?: string;
  profileTitle?: string;
  profileSubtitle?: string;
  avatarUrl?: string;
};

export default function AppSidebar({
  active,
  initials = "AC",
  profileTitle = "Acaora 用户",
  profileSubtitle = "个人设置",
  avatarUrl = "",
}: AppSidebarProps) {
  const [open, setOpen] = useState(false);
  const [isDrawer, setIsDrawer] = useState(false);
  const {expanded, rootRef, toggleRef, toggle, handlers} = useHoverNavigation();
  const [profile, setProfile] = useState<{initials: string; title: string; subtitle: string; avatarUrl: string} | null>(null);
  const [identity, setIdentity] = useState<'loading'|'guest'|'member'|'error'>('loading');
  const displayedProfile = profile ?? (identity==='member' ? {initials, title: profileTitle, subtitle: profileSubtitle, avatarUrl} : {initials:'AC',title:identity==='guest'?'未登录':identity==='error'?'账户暂不可用':'正在读取账户…',subtitle:identity==='guest'?'登录账户':identity==='error'?'前往设置重试':'',avatarUrl:''});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let mounted = true;
    let requestId = 0;
    async function loadProfile() {
      const currentRequest = ++requestId;
      let user;
      try {user=await getCurrentUser();}catch{if(mounted&&currentRequest===requestId){setIdentity('error');setProfile(null);}return;}
      const data = user ? await getProfile(user.id).catch(() => null) : null;
      if (!mounted || currentRequest !== requestId) return;
      if (!user) {
        setProfile(null);
        setIdentity('guest');
        return;
      }
      setIdentity('member');
      const title = data?.display_name || user.email || "Acaora 用户";
      setProfile({
        initials: String(title).slice(0, 2).toUpperCase(),
        title: String(title),
        subtitle: data?.major || data?.university || "个人设置",
        avatarUrl: data?.preferences?.avatar || "",
      });
    }
    const reload = () => { setProfile(null);setIdentity('loading');void loadProfile(); };
    void loadProfile();
    window.addEventListener(authChangeEvent, reload);
    window.addEventListener("acaora:profile-change", reload);
    return () => {
      mounted = false;
      window.removeEventListener(authChangeEvent, reload);
      window.removeEventListener("acaora:profile-change", reload);
    };
  }, []);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 760px)");
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

  const links = navigation.map((item, index) => {
    const Icon = item.icon;
    return <Link aria-current={item.id === active ? 'page' : undefined} aria-label={item.label}
      title={item.label} style={{'--navigation-step': Math.min(index, 4)} as React.CSSProperties} className={item.id === active ? 'active' : ''} href={item.href} key={item.id} onClick={() => setOpen(false)}>
      <Icon size={20} aria-hidden="true" /><span>{item.label}</span>
    </Link>;
  });

  return <>
    <IconButton ref={triggerRef} className="sidebar-menu-button" variant="secondary" label="打开主导航" aria-expanded={open} aria-controls="app-sidebar" onClick={() => setOpen(true)}><Menu size={21} /></IconButton>
    {open && <button className="sidebar-backdrop" type="button" aria-label="关闭主导航" onClick={() => setOpen(false)} />}
    <div className="sidebar-auto-slot" ref={rootRef} data-expanded={!isDrawer && expanded} {...(!isDrawer ? handlers : {})}>
    <aside ref={sidebarRef} className={`student-sidebar app-sidebar ${open ? "is-open" : ""}`} data-section={active} id="app-sidebar" aria-label="应用导航" inert={isDrawer && !open ? true : undefined}>
      <div className="sidebar-head">
        <Link className="acaora-brand light" href="/dashboard" aria-label="返回 Acaora 工作台" onClick={() => setOpen(false)}>
          <span>A</span>
          <div><strong>Acaora</strong><small>学曦</small></div>
        </Link>
        <IconButton ref={closeRef} className="sidebar-close-button" variant="ghost" label="关闭主导航" onClick={() => setOpen(false)}><X size={21} /></IconButton>
      </div>
      <button ref={toggleRef} className="sidebar-rail-toggle" type="button" aria-label="展开或收起主导航" aria-expanded={expanded} aria-controls="app-sidebar" onClick={toggle}>
        {expanded ? <PanelLeftClose size={20} aria-hidden="true"/> : <PanelLeftOpen size={20} aria-hidden="true"/>}<span>导航</span>
      </button>
      {active === 'dashboard' ? <nav aria-label="主要导航">{links}</nav> :
        <MotionNavigation className="sidebar-nav-motion" label="主要导航" value={active} rememberKey="workspace-sidebar">{links}</MotionNavigation>}
      <div className="student-sidebar-foot">
        <Link className="workspace-quick-launch" href="/help" aria-label="帮助与恢复" title="帮助与恢复" onClick={()=>setOpen(false)}><CircleHelp size={20} aria-hidden="true"/><span>帮助与恢复</span></Link>
        <QuickNavigation onNavigate={()=>setOpen(false)}/>
        <Link className="sidebar-profile-link" href={identity==='guest'?'/auth':'/settings'} aria-label={identity==='guest'?'登录账户':identity==='member'?'编辑个人资料':'账户设置'} onClick={() => setOpen(false)}>
          {displayedProfile.avatarUrl ? <img src={displayedProfile.avatarUrl} width="72" height="72" alt="" /> : <b>{displayedProfile.initials}</b>}
          <p><strong>{displayedProfile.title}</strong><small>{displayedProfile.subtitle}</small></p>
        </Link>
      </div>
    </aside>
    </div>
  </>;
}
