"use client";
import {useEffect, useState} from 'react';
import MotionNavigation from './motion-navigation';
export default function SectionNavigation({sections, label, className}: {
  sections: ReadonlyArray<readonly [string, string]>; label: string; className: string;
}) {
  const [active, setActive] = useState(sections[0][0]);
  useEffect(() => {
    let frame = 0;
    function update() {
      frame = 0;
      const fields = sections.map(([id]) => document.getElementById(id)).filter((e): e is HTMLElement => Boolean(e));
      let current: HTMLElement | undefined = fields[0];
      for (const field of fields) if (field.getBoundingClientRect().top <= 120) current = field;
      if (window.scrollY > 0 && window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) current = fields.at(-1);
      if (current) setActive(current.id);
    }
    function schedule() {if (!frame) frame = requestAnimationFrame(update);}
    update(); window.addEventListener('scroll', schedule, {passive:true}); window.addEventListener('resize', schedule);
    return () => {cancelAnimationFrame(frame); window.removeEventListener('scroll', schedule); window.removeEventListener('resize', schedule);};
  }, [sections]);
  return <MotionNavigation className={className} label={label} value={active}>{sections.map(([id, text]) =>
    <a key={id} href={`#${id}`} aria-current={active === id ? 'location' : undefined} onClick={() => setActive(id)}>{text}</a>,
  )}</MotionNavigation>;
}
