import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "./utils";

type Tone = "info" | "success" | "warning" | "error";
const icons = { info: Info, success: CheckCircle2, warning: TriangleAlert, error: AlertCircle };

export function StatusMessage({ children, tone = "info", className }: { children: ReactNode; tone?: Tone; className?: string }) {
  const Icon = icons[tone];
  return <div className={cx("ui-status", `ui-status--${tone}`, className)} role={tone === "error" ? "alert" : "status"} aria-live="polite"><Icon size={18} aria-hidden="true" /><div>{children}</div></div>;
}

export function Toast(props: { children: ReactNode; tone?: Tone; className?: string }) {
  return <StatusMessage {...props} className={cx("ui-toast", props.className)} />;
}

export function EmptyState({ title, description, action, className }: { title: string; description: string; action?: ReactNode; className?: string }) {
  return <div className={cx("ui-state", className)}><Info size={28} aria-hidden="true" /><h2>{title}</h2><p>{description}</p>{action}</div>;
}

export function ErrorState({ title = "暂时无法加载", description, action, className }: { title?: string; description: string; action?: ReactNode; className?: string }) {
  return <div className={cx("ui-state", "ui-state--error", className)} role="alert"><AlertCircle size={28} aria-hidden="true" /><h2>{title}</h2><p>{description}</p>{action}</div>;
}
