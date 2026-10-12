"use client";

import {useEffect, useState} from 'react';
import MotionNavigation from '../components/motion-navigation';

const sections = [['profile', '个人资料'], ['security', '账户与安全'], ['ai-models', 'AI 与模型'], ['privacy', '隐私与数据'], ['about', '关于']] as const;

/** Keeps the directory in step with the form being read, without remounting it. */
export default function SettingsNavigation() {
  const [active, setActive] = useState('profile');
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setActive(visible[0].target.id);
    }, {rootMargin: '-12% 0px -65% 0px'});
    sections.forEach(([id]) => {const section = document.getElementById(id); if (section) observer.observe(section);});
    return () => observer.disconnect();
  }, []);
  return <MotionNavigation className="settings-nav" label="设置分区" value={active}>{sections.map(([id, label]) =>
    <a key={id} href={`#${id}`} aria-current={active === id ? 'location' : undefined} onClick={() => setActive(id)}>{label}</a>,
  )}</MotionNavigation>;
}
