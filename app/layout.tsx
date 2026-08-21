import type { Metadata } from "next";
import AuthHashRedirect from "./components/auth-hash-redirect";
import { getSiteUrl } from "./lib/site-url";
import "./globals.css";

const title = "Acaora 学曦 · 大学生智能学习与研究平台";
const description = "把课程、论文、数据分析与研究项目放进同一个可信、可追溯的智能学习工作台。";
const siteUrl = getSiteUrl();
const image = "/og-acaora.png";
const publicSupabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
const configuredSupabaseKey = process.env.SUPABASE_ANON_KEY;
const publicSupabaseKey = configuredSupabaseKey?.startsWith("sb_publishable_") ? configuredSupabaseKey : undefined;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: { title, description, images: [{ url: image, width: 1731, height: 909, alt: title }] },
  twitter: { card: "summary_large_image", title, description, images: [image] },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body data-supabase-url={publicSupabaseKey ? publicSupabaseUrl : undefined} data-supabase-key={publicSupabaseKey}><AuthHashRedirect />{children}</body>
    </html>
  );
}
