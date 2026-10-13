"use client";

import {BookOpen, ChevronRight} from 'lucide-react';
import {useId, type ReactNode} from 'react';
import useHoverNavigation from '../components/use-hover-navigation';

export default function CourseNavigationRail({label, children}: {label: string; children: ReactNode}) {
  const {expanded, rootRef, toggleRef, toggle, handlers} = useHoverNavigation();
  const panelId = useId();
  return <div className="course-navigation-rail" ref={rootRef} data-expanded={expanded} {...handlers}>
    <button type="button" className="course-navigation-toggle" ref={toggleRef}
      aria-label={label} aria-controls={panelId} aria-expanded={expanded} onClick={toggle}>
      <BookOpen size={20} aria-hidden="true"/><span>{label}</span><ChevronRight size={16} aria-hidden="true"/>
    </button>
    <div className="course-navigation-panel" id={panelId} inert={!expanded} aria-hidden={!expanded}>
      <div className="course-navigation-heading">{label}</div>
      {children}
    </div>
  </div>;
}
