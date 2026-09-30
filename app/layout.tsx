import type { Metadata, Viewport } from "next";
import { getSiteUrl } from "./lib/site-url";
import "./globals.css";
import "./white-theme.css";
import LightCurtain from "./components/light-curtain";

const title = "Acaora 学曦 · 大学生智能学习与研究平台";
const description = "整理课程资料，阅读和标注论文，分析数据，管理研究项目。";
const siteUrl = getSiteUrl();
const image = "/og-acaora.png";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: { title, description, images: [{ url: image, width: 1731, height: 909, alt: title }] },
  twitter: { card: "summary_large_image", title, description, images: [image] },
};

/* Matches --bg-app so the mobile browser chrome stays continuous with the
   app background instead of cutting to a white surface. */
export const viewport: Viewport = {
  themeColor: "#f4f8fe",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" data-scroll-behavior="smooth">
      <body><LightCurtain />{children}</body>
    </html>
  );
}
