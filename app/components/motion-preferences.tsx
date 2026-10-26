'use client';

import {useEffect, useSyncExternalStore} from 'react';

const key = 'acaora:interface-motion';
const event = 'acaora:interface-motion-change';
let fallback = false;
function read() {try {return localStorage.getItem(key) === 'off';} catch {return fallback;}}
function subscribe(notify: () => void) {
  window.addEventListener('storage', notify);
  window.addEventListener(event, notify);
  return () => {window.removeEventListener('storage', notify); window.removeEventListener(event, notify);};
}
function server() {return false;}
export function MotionControl() {
  const paused = useSyncExternalStore(subscribe, read, server);
  return <label className="motion-preference"><input type="checkbox" checked={!paused} onChange={e => {
    fallback = !e.target.checked;
    try {localStorage.setItem(key, e.target.checked ? 'on' : 'off');} catch {/* Keep a session preference when storage is blocked. */}
    window.dispatchEvent(new Event(event));
  }}/><span>界面动效<small>悬停与短暂转场；同时遵循系统的减少动态效果设置。</small></span></label>;
}
export default function MotionPreferences() {
  const paused = useSyncExternalStore(subscribe, read, server);
  useEffect(() => {
    document.documentElement.dataset.interfaceMotion = paused ? 'off' : 'on';
    if (paused) document.getAnimations().forEach(animation => animation.cancel());
  }, [paused]);
  return null;
}
