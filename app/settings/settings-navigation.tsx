"use client";
import SectionNavigation from '../components/section-navigation';
const sections = [['profile', '个人资料'], ['security', '账户与安全'], ['ai-models', 'AI 与模型'], ['privacy', '隐私与数据'], ['about', '关于']] as const;
export default function SettingsNavigation() {
  return <SectionNavigation sections={sections} className="settings-nav" label="设置分区" />;
}
