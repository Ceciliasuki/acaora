'use client';

import './home-motion.css';
import {useEffect, useRef, type ReactNode} from 'react';

export default function HomeMotion({children}: {children: ReactNode}) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const animations = new Set<Animation>();
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      if (media.matches || document.hidden || document.documentElement.dataset.interfaceMotion === 'off') return;
      const isTitle = entry.target.matches('.home-title-line > span');
      const animation = entry.target.animate(isTitle ? [{transform: 'translateY(105%) rotate(5deg)'}, {transform: 'none'}] : [{opacity: .35, transform: 'translateY(48px)'}, {opacity: 1, transform: 'none'}], {duration: isTitle ? 1050 : 800, delay: isTitle && entry.target.parentElement?.previousElementSibling ? 140 : 0, easing: 'cubic-bezier(.16,1,.3,1)'});
      animations.add(animation);
      animation.onfinish = () => animations.delete(animation);
    }), {threshold: .12});
    root.current?.querySelectorAll('.home-title-line > span, .acaora-modules .section-intro, .acaora-modules .module-card, .acaora-principles > div').forEach(node => observer.observe(node));
    let frame = 0;
    const updateScroll = () => {
      frame = 0;
      const hero = root.current?.querySelector<HTMLElement>('.acaora-hero');
      if (!hero) return;
      const progress = media.matches || document.documentElement.dataset.interfaceMotion === 'off' || innerWidth < 900 ? 0 : Math.max(0, Math.min(1, -hero.getBoundingClientRect().top / hero.offsetHeight));
      hero.style.setProperty('--hero-travel', `${progress * -50}px`);
    };
    const scroll = () => {if (!frame) frame = requestAnimationFrame(updateScroll);};
    window.addEventListener('scroll', scroll, {passive: true});
    window.addEventListener('resize', scroll);
    media.addEventListener('change', updateScroll);
    updateScroll();
    const stop = () => {if (media.matches || document.hidden) {animations.forEach(a => a.cancel()); animations.clear();}};
    media.addEventListener('change', stop);
    document.addEventListener('visibilitychange', stop);
    return () => {observer.disconnect(); animations.forEach(a => a.cancel()); cancelAnimationFrame(frame); window.removeEventListener('scroll', scroll); window.removeEventListener('resize', scroll); media.removeEventListener('change', updateScroll); media.removeEventListener('change', stop); document.removeEventListener('visibilitychange', stop);};
  }, []);
  return <div ref={root} className="home-motion">{children}</div>;
}
