import { type ButtonHTMLAttributes, type ReactNode } from "react";
import { cx } from "./utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return <button
    className={cx("ui-button", `ui-button--${variant}`, `ui-button--${size}`, className)}
    disabled={disabled || loading}
    type={type}
    {...props}
  >{loading && <span className="ui-spinner" aria-hidden="true" />}{children}</button>;
}

type IconButtonProps = Omit<ButtonProps, "children"> & {
  label: string;
  children: ReactNode;
};

export function IconButton({ label, title = label, className, children, ...props }: IconButtonProps) {
  return <Button className={cx("ui-icon-button", className)} aria-label={label} title={title} {...props}>{children}</Button>;
}
