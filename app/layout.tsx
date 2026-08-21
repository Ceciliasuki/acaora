import type { Metadata } from "next";
import AuthHashRedirect from "./components/auth-hash-redirect";
import "./globals.css";

const title = "Acaora 学曦 · 大学生智能学习与研究平台";
const description = "把课程、论文、数据分析与研究项目放进同一个可信、可追溯的智能学习工作台。";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://acaora-dp12ulx0tbef.edgeone.dev";
const image = "/og-acaora.png";

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
      <body><AuthHashRedirect />{children}</body>
    </html>
  );
}
