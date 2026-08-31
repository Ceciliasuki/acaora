import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "./utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <article className={cx("ui-card", className)} {...props} />;
}

export function Badge({ children, tone = "neutral", className }: {
  children: ReactNode;
  tone?: "neutral" | "info" | "success" | "warning" | "danger";
  className?: string;
}) {
  return <span className={cx("ui-badge", `ui-badge--${tone}`, className)}>{children}</span>;
}
