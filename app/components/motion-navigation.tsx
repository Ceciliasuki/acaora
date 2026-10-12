"use client";

import {useEffect, useRef, type ReactNode, type AriaRole} from "react";

type Marker = {x: number; y: number; width: number; height: number; rootWidth: number};
// Geometry only, for continuity when a workspace route replaces its sidebar.
const remembered = new Map<string, Marker>();

/** The existing buttons own state and focus; this rail only explains selection. */
export default function MotionNavigation({value, label, className, children, as: Tag = 'nav', role, rememberKey}: {
  value: string; label: string; className: string; children: ReactNode;
  as?: 'nav' | 'div'; role?: AriaRole; rememberKey?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const marker = markerRef.current;
    return () => marker?.getAnimations().forEach(animation => animation.cancel());
  }, []);
  useEffect(() => {
    const root = rootRef.current;
    const marker = markerRef.current;
    if (!root || !marker) return;
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    function update(animate = false) {
      const selected = root!.querySelector<HTMLElement>('[aria-pressed="true"], [aria-selected="true"], [aria-current="true"], [aria-current="page"], [aria-current="location"]');
      if (!selected || !selected.getClientRects().length) return;
      const bounds = root!.getBoundingClientRect();
      const button = selected.getBoundingClientRect();
      const next = {x: button.left - bounds.left + root!.scrollLeft, y: button.top - bounds.top + root!.scrollTop, width: button.width, height: button.height, rootWidth: bounds.width};
      const transform = `translate(${next.x}px, ${next.y}px)`;
      // ResizeObserver's initial delivery must not cancel a newly started move.
      if (marker!.style.transform === transform && marker!.style.width === `${next.width}px` && marker!.style.height === `${next.height}px`) return;
      const ready = root!.dataset.motionReady === "true";
      const previousBounds = marker!.getBoundingClientRect();
      const stored = rememberKey ? remembered.get(rememberKey) : undefined;
      const previous = ready ? {x: previousBounds.left - bounds.left + root!.scrollLeft, y: previousBounds.top - bounds.top + root!.scrollTop, width: previousBounds.width, height: previousBounds.height} : stored && Math.abs(stored.rootWidth - bounds.width) < 2 ? stored : undefined;
      marker!.getAnimations().forEach(animation => animation.cancel());
      root!.dataset.motionMoving = 'false';
      marker!.style.width = `${next.width}px`;
      marker!.style.height = `${next.height}px`;
      marker!.style.transform = transform;
      root!.dataset.motionReady = "true";
      if (rememberKey) remembered.set(rememberKey, next);
      if (animate && previous && !preference.matches) {
        root!.dataset.motionMoving = 'true';
        const animation = marker!.animate([
        {transform: `translate(${previous.x}px, ${previous.y}px) scale(${previous.width / next.width}, ${previous.height / next.height})`}, {transform},
        ], {duration: 280, easing: "cubic-bezier(.16,1,.3,1)"});
        animation.onfinish = () => {root!.dataset.motionMoving = 'false';};
      }
    }
    const observer = new ResizeObserver(() => update(true));
    observer.observe(root);
    root.querySelectorAll('button, a').forEach(element => observer.observe(element));
    const reduce = () => {marker.getAnimations().forEach(animation => animation.cancel()); root.dataset.motionMoving = 'false'; update();};
    preference.addEventListener("change", reduce);
    update(true);
    return () => {observer.disconnect(); preference.removeEventListener("change", reduce);};
  }, [value, rememberKey]);
  return <Tag ref={rootRef} className={`motion-navigation ${className}`} aria-label={label} role={role}>{children}<span ref={markerRef} className="motion-navigation-marker" aria-hidden="true" /></Tag>;
}
