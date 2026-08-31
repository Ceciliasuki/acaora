"use client";

import { X } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";
import { Button, IconButton } from "./button";

export function Dialog({ open, title, description, children, confirmLabel, destructive = false, onConfirm, onClose }: {
  open: boolean;
  title: string;
  description?: string;
  children?: ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm?: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return <dialog ref={ref} className="ui-dialog" onCancel={(event) => { event.preventDefault(); onClose(); }} onClose={onClose}>
    <header><div><h2>{title}</h2>{description && <p>{description}</p>}</div><IconButton variant="ghost" label="关闭对话框" onClick={onClose}><X size={20} /></IconButton></header>
    {children && <div className="ui-dialog-body">{children}</div>}
    {(confirmLabel || onConfirm) && <footer><Button variant="secondary" onClick={onClose}>取消</Button><Button variant={destructive ? "danger" : "primary"} onClick={onConfirm}>{confirmLabel || "确认"}</Button></footer>}
  </dialog>;
}
