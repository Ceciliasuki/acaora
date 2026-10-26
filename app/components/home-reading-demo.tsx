'use client';

import Link from 'next/link';
import {useEffect, useRef, useState} from 'react';
import {Play, RotateCcw} from 'lucide-react';
import {samplePaper} from '../papers/paper-types';
import styles from '../home-preview.module.css';

const steps = ['阅读原文', '标出关键句', '写下笔记'];
export default function HomeReadingDemo() {
  const [step, setStep] = useState(2);
  const [playing, setPlaying] = useState(false);
  const [played, setPlayed] = useState(false);
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    let timers: ReturnType<typeof setTimeout>[] = [];
    const stop = () => {timers.forEach(clearTimeout); timers = []; setPlaying(false); setStep(2);};
    const interrupt = () => {if (media.matches || document.hidden) stop();};
    if (playing) {
      if (media.matches || document.hidden) stop();
      else {
        timers = [setTimeout(() => setStep(1), 550), setTimeout(() => setStep(2), 1250), setTimeout(() => setPlaying(false), 1950)];
      }
    }
    media.addEventListener('change', interrupt);
    document.addEventListener('visibilitychange', interrupt);
    const observer = new IntersectionObserver(entries => {if (playing && !entries[0]?.isIntersecting) stop();});
    if (root.current) observer.observe(root.current);
    return () => {timers.forEach(clearTimeout); observer.disconnect(); media.removeEventListener('change', interrupt); document.removeEventListener('visibilitychange', interrupt);};
  }, [playing]);
  const original = samplePaper.paragraphs[1].original;
  const split = original.indexOf('.') + 1;
  return <figure ref={root} className={styles.preview} aria-label="原文与笔记示例" data-demo-step={step}>
    <header className={styles.header}><h2>原文与独立笔记</h2></header>
    <div className={styles.demoControls}>
      <div role="group" aria-label="查看示例步骤">{steps.map((label, index) => <button type="button" key={label} aria-pressed={step === index} onClick={() => {setPlaying(false); setStep(index);}}><span>{index + 1}</span>{label}</button>)}</div>
      <button type="button" aria-label={playing ? '停止演示' : played ? '重播示例' : '播放示例'} onClick={() => {if (playing) {setPlaying(false); setStep(2);} else {setStep(0); setPlayed(true); setPlaying(true);}}}>{played ? <RotateCcw size={14} aria-hidden="true"/> : <Play size={14} aria-hidden="true"/>}{playing ? '停止' : played ? '重播' : '播放示例'}</button>
    </div>
    <div className={styles.stage}>
    <div className={styles.source}><h3>原文 · Methods · 第 2 页</h3><blockquote lang="en"><mark className={styles.exampleMark} data-emphasized={step >= 1}>{original.slice(0, split)}</mark>{original.slice(split)}</blockquote></div>
    <div className={styles.note} data-emphasized={step === 2}><h3>我的笔记</h3><p>{samplePaper.paragraphs[1].note}</p><span>对应上方方法段落，保留独立判断。</span></div>
    </div>
    <figcaption><span role="status">{steps[step]} · 来源：示例论文 Methods 段落</span><Link href="/papers?view=reader&paper=sample-paper">打开示例工作台，核对原文</Link></figcaption>
  </figure>;
}
