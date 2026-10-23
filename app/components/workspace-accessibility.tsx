'use client';
import {useEffect} from 'react';
import {usePathname} from 'next/navigation';
import styles from './workspace-accessibility.module.css';

export default function WorkspaceAccessibility() {
  const pathname = usePathname();
  function target() {return document.querySelector<HTMLElement>('.student-main, .learning-main, .data-main, .settings-main, .plab-main, .paper-main, [data-main-content], .acaora-hero')??document.querySelector<HTMLElement>('main');}
  useEffect(() => {
    const content = target();
    if (content) {content.id ||= 'main-content'; content.tabIndex = -1;}
  }, [pathname]);
  return <a className={styles.skip} href={pathname==='/data'?'#workspace':'#main-content'} onClick={event => {const content=target();if(content){event.preventDefault();content.focus();content.scrollIntoView({block:'start'});}}}>跳到主要内容</a>;
}
