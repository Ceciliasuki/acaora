"use client";

import {
  cloneElement,
  forwardRef,
  isValidElement,
  type InputHTMLAttributes,
  type ReactElement,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  useId,
  useState,
} from "react";
import { Eye, EyeOff } from "lucide-react";
import { passwordPolicy } from "../../lib/auth/password-policy";
import { IconButton } from "./button";
import { cx } from "./utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cx("ui-input", className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cx("ui-textarea", className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, ...props }, ref) {
  return <select ref={ref} className={cx("ui-select", className)} {...props} />;
});

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  showPolicy?: boolean;
};

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(function PasswordField({
  className,
  showPolicy = false,
  minLength = passwordPolicy.minLength,
  maxLength = passwordPolicy.maxLength,
  ...props
}, ref) {
  const [visible, setVisible] = useState(false);
  return <div className="ui-password-wrap">
    <Input ref={ref} className={className} type={visible ? "text" : "password"} minLength={minLength} maxLength={maxLength} {...props} />
    <IconButton className="ui-password-toggle" variant="ghost" label={visible ? "隐藏密码" : "显示密码"} onClick={() => setVisible((value) => !value)}>
      {visible ? <EyeOff size={18} /> : <Eye size={18} />}
    </IconButton>
    {showPolicy && <small className="ui-password-policy">{passwordPolicy.message}</small>}
  </div>;
});

type FormFieldProps = {
  label: string;
  children: ReactElement<Record<string, unknown>>;
  id?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
};

export function FormField({ label, children, id, hint, error, required, className }: FormFieldProps) {
  const generatedId = useId();
  const controlId = id || generatedId;
  const descriptionId = `${controlId}-description`;
  const control = isValidElement(children)
    ? cloneElement(children, {
      id: controlId,
      "aria-invalid": error ? true : undefined,
      "aria-describedby": hint || error ? descriptionId : undefined,
      required,
    })
    : children;
  return <div className={cx("ui-form-field", className)}>
    <label htmlFor={controlId}>{label}{required && <span aria-hidden="true"> *</span>}</label>
    {control}
    {(hint || error) && <p id={descriptionId} className={error ? "ui-field-error" : "ui-field-hint"}>{error || hint}</p>}
  </div>;
}
