import type { ReactNode } from "react";
import { cx } from "./utils";

export function PageHeader({ eyebrow, title, description, actions, className }: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return <header className={cx("ui-page-header", className)}><div>{eyebrow && <p>{eyebrow}</p>}<h1>{title}</h1>{description && <span>{description}</span>}</div>{actions && <div className="ui-page-actions">{actions}</div>}</header>;
}
