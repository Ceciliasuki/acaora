"use client";

import { cx } from "./utils";

export type TabItem = { value: string; label: string; disabled?: boolean };

export function Tabs({ items, value, onValueChange, label, className }: {
  items: TabItem[];
  value: string;
  onValueChange: (value: string) => void;
  label: string;
  className?: string;
}) {
  return <div className={cx("ui-tabs", className)} role="tablist" aria-label={label}>
    {items.map((item) => <button
      key={item.value}
      type="button"
      role="tab"
      aria-selected={item.value === value}
      className={item.value === value ? "active" : ""}
      disabled={item.disabled}
      onClick={() => onValueChange(item.value)}
    >{item.label}</button>)}
  </div>;
}
