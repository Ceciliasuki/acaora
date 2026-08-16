import Link from "next/link";

type AppSection = "dashboard" | "papers" | "data" | "projects";

type AppSidebarProps = {
  active: AppSection;
  initials?: string;
  profileTitle?: string;
  profileSubtitle?: string;
};

const navigation: Array<{ id: AppSection | "courses"; href: string; icon: string; label: string }> = [
  { id: "dashboard", href: "/dashboard", icon: "⌂", label: "总览" },
  { id: "courses", href: "/dashboard#courses", icon: "◫", label: "我的课程" },
  { id: "papers", href: "/papers", icon: "文", label: "论文研究" },
  { id: "data", href: "/data", icon: "Σ", label: "数据分析" },
  { id: "projects", href: "/projects", icon: "◇", label: "项目空间" },
];

export default function AppSidebar({
  active,
  initials = "AC",
  profileTitle = "Acaora 用户",
  profileSubtitle = "本地优先模式",
}: AppSidebarProps) {
  return (
    <aside className="student-sidebar app-sidebar">
      <Link className="acaora-brand light" href="/" aria-label="返回 Acaora 首页">
        <span>A</span>
        <div><strong>Acaora</strong><small>学曦</small></div>
      </Link>
      <nav aria-label="主要导航">
        {navigation.map((item) => (
          <a className={item.id === active ? "active" : ""} href={item.href} key={item.id} aria-current={item.id === active ? "page" : undefined}>
            <i aria-hidden="true">{item.icon}</i><span>{item.label}</span>
          </a>
        ))}
      </nav>
      <div className="student-sidebar-foot">
        <a href="/dashboard#settings"><i aria-hidden="true">⚙</i><span>设置与隐私</span></a>
        <div><b>{initials}</b><p><strong>{profileTitle}</strong><small>{profileSubtitle}</small></p></div>
      </div>
    </aside>
  );
}
