"use client";

import {BookOpen, ChevronRight} from 'lucide-react';
import {useId, useSyncExternalStore, type ReactNode} from 'react';
import useHoverNavigation from '../components/use-hover-navigation';

const desktopQuery = '(min-width: 1001px)';
function subscribeDesktop(callback: () => void) {
  const query = window.matchMedia(desktopQuery);
  query.addEventListener('change', callback);
  return () => query.removeEventListener('change', callback);
}
const desktopSnapshot = () => window.matchMedia(desktopQuery).matches;
const serverSnapshot = () => false;

export default function CourseNavigationRail({label, children}: {label: string; children: ReactNode}) {
  const {expanded, rootRef, toggleRef, toggle, handlers} = useHoverNavigation();
  const desktop = useSyncExternalStore(subscribeDesktop, desktopSnapshot, serverSnapshot);
  const open = desktop || expanded;
  const panelId = useId();
  return <div className="course-navigation-rail" ref={rootRef} data-expanded={open} data-desktop={desktop} {...(desktop ? {} : handlers)}>
    <button type="button" className="course-navigation-toggle" ref={toggleRef}
      aria-label={label} aria-controls={panelId} aria-expanded={open} onClick={toggle}>
      <BookOpen size={20} aria-hidden="true"/><span>{label}</span><ChevronRight size={16} aria-hidden="true"/>
    </button>
    <div className="course-navigation-panel" id={panelId} inert={!open} aria-hidden={!open}>
      <div className="course-navigation-heading">{label}</div>
      {children}
    </div>
  </div>;
}
