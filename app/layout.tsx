import type { Metadata } from "next";
import { headers } from "next/headers";
import AuthHashRedirect from "./components/auth-hash-redirect";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const image = `${protocol}://${host}/og-acaora.png`;
  const title = "Acaora 学曦 · 大学生智能学习与研究平台";
  const description = "把课程、论文、数据分析与研究项目放进同一个可信、可追溯的智能学习工作台。";

  return {
    title,
    description,
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: { title, description, images: [{ url: image, width: 1731, height: 909, alt: title }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

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
