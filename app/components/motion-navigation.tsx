"use client";

import {useEffect, useRef, type ReactNode} from "react";

/** The existing buttons own state and focus; this rail only explains selection. */
export default function MotionNavigation({value, label, className, children}: {
  value: string; label: string; className: string; children: ReactNode;
}) {
  const rootRef = useRef<HTMLElement>(null);
  const markerRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const root = rootRef.current;
    const marker = markerRef.current;
    if (!root || !marker) return;
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    function update(animate = false) {
      const selected = root!.querySelector<HTMLElement>('[aria-pressed="true"], [aria-selected="true"]');
      if (!selected || !selected.getClientRects().length) return;
      const transform = `translateX(${selected.offsetLeft}px) scaleX(${selected.offsetWidth})`;
      // ResizeObserver's initial delivery must not cancel a newly started move.
      if (marker!.style.transform === transform) return;
      const previous = getComputedStyle(marker!).transform;
      const ready = root!.dataset.motionReady === "true";
      marker!.getAnimations().forEach(animation => animation.cancel());
      marker!.style.transform = transform;
      root!.dataset.motionReady = "true";
      if (animate && ready && !preference.matches) marker!.animate([{transform: previous}, {transform}], {duration: 180, easing: "cubic-bezier(.16,1,.3,1)"});
    }
    const observer = new ResizeObserver(() => update());
    observer.observe(root);
    const reduce = () => {marker.getAnimations().forEach(animation => animation.cancel()); update();};
    preference.addEventListener("change", reduce);
    update(true);
    return () => {observer.disconnect(); preference.removeEventListener("change", reduce); marker.getAnimations().forEach(animation => animation.cancel());};
  }, [value]);
  return <nav ref={rootRef} className={`motion-navigation ${className}`} aria-label={label}>{children}<span ref={markerRef} className="motion-navigation-marker" aria-hidden="true" /></nav>;
}
