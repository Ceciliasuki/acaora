"use client";

import {useEffect, useRef, type ReactNode, type AriaRole, type KeyboardEventHandler} from "react";

type Marker = {x: number; y: number; width: number; height: number; rootWidth: number};
// Geometry only, for continuity when a workspace route replaces its sidebar.
const remembered = new Map<string, Marker>();

/** The existing buttons own state and focus; this rail only explains selection. */
export default function MotionNavigation({value, label, className, children, as: Tag = 'nav', role, rememberKey, onKeyDown}: {
  value: string; label: string; className: string; children: ReactNode;
  as?: 'nav' | 'div'; role?: AriaRole; rememberKey?: string;
  onKeyDown?: KeyboardEventHandler<HTMLElement>;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<HTMLSpanElement>(null);
  const hoverRef = useRef<HTMLSpanElement>(null);
  const hovered = useRef<HTMLElement | null>(null);
  function moveHover(control: HTMLElement, animate = true) {
    const root = rootRef.current;
    const marker = hoverRef.current;
    if (!root || !marker || control.matches(':disabled')) return;
    const bounds = root.getBoundingClientRect();
    const target = control.getBoundingClientRect();
    const previous = marker.getBoundingClientRect();
    const ready = root.dataset.hoverVisible === 'true';
    const transform = `translate(${target.left-bounds.left+root.scrollLeft}px, ${target.top-bounds.top+root.scrollTop}px)`;
    marker.getAnimations().forEach(animation=>animation.cancel());
    marker.style.width = `${target.width}px`;
    marker.style.height = `${target.height}px`;
    marker.style.transform = transform;
    root.dataset.hoverVisible = 'true';
    hovered.current = control;
    if (animate && ready && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      marker.animate([{transform:`translate(${previous.left-bounds.left+root.scrollLeft}px, ${previous.top-bounds.top+root.scrollTop}px) scale(${previous.width/target.width}, ${previous.height/target.height})`}, {transform}], {duration:200, easing:'cubic-bezier(.16,1,.3,1)'});
    }
  }
  function hideHover() {
    if (rootRef.current) rootRef.current.dataset.hoverVisible = 'false';
    hovered.current = null;
  }
  useEffect(() => {
    const marker = markerRef.current;
    const hover = hoverRef.current;
    return () => {marker?.getAnimations().forEach(animation => animation.cancel()); hover?.getAnimations().forEach(animation => animation.cancel());};
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
        animation.oncancel = () => {if (!marker!.getAnimations().length) root!.dataset.motionMoving = 'false';};
      }
    }
    const observer = new ResizeObserver(() => {update(true); if (hovered.current) moveHover(hovered.current, false);});
    observer.observe(root);
    root.querySelectorAll('button, a').forEach(element => observer.observe(element));
    const reduce = () => {marker.getAnimations().forEach(animation => animation.cancel()); hoverRef.current?.getAnimations().forEach(animation=>animation.cancel()); root.dataset.motionMoving = 'false'; update();};
    preference.addEventListener("change", reduce);
    update(true);
    return () => {observer.disconnect(); preference.removeEventListener("change", reduce);};
  }, [value, rememberKey]);
  return <Tag ref={rootRef} className={`motion-navigation ${className}`} aria-label={label} role={role} onKeyDown={onKeyDown}
    onPointerMove={event=>{if(event.pointerType !== 'mouse' || !(event.target instanceof Element)) return; const control=event.target.closest<HTMLElement>('button, a'); if(control && control !== hovered.current) moveHover(control);}}
    onPointerLeave={()=>{const active=document.activeElement; if(!(active instanceof HTMLElement) || !rootRef.current?.contains(active) || !active.matches(':focus-visible')) hideHover();}}
    onFocusCapture={event=>{if(event.target instanceof HTMLElement && event.target.matches('button:focus-visible, a:focus-visible')) moveHover(event.target);}}
    onBlurCapture={event=>{if(!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) hideHover();}}>
    <span ref={hoverRef} className="motion-navigation-hover" aria-hidden="true" />{children}<span ref={markerRef} className="motion-navigation-marker" aria-hidden="true" /></Tag>;
}
