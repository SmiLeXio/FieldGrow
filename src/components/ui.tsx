/** 通用 UI 基元:图标 / 按钮 / 表单 / 徽标 / 模态 / 空状态 —— 全部内联 SVG,零图标库依赖。 */
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

/* ————— 图标(24 线性) ————— */

type IconProps = { size?: number; className?: string };

function svg(size: number, children: ReactNode, className?: string) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  );
}

export const Icon = {
  search: ({ size = 17, className }: IconProps = {}) =>
    svg(size, <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.2-3.2" />
    </>, className),
  map: ({ size = 17, className }: IconProps = {}) =>
    svg(size, <>
      <path d="M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4Z" />
      <path d="M9 4v13M15 6.5v13" />
    </>, className),
  pool: ({ size = 17, className }: IconProps = {}) =>
    svg(size, <>
      <path d="M12 21s-7-4.4-7-10a4.2 4.2 0 0 1 7-3.1A4.2 4.2 0 0 1 19 11c0 5.6-7 10-7 10Z" />
    </>, className),
  log: ({ size = 17, className }: IconProps = {}) =>
    svg(size, <>
      <path d="M8 6h12M8 12h12M8 18h12" />
      <circle cx="4" cy="6" r="1" fill="currentColor" stroke="none" />
      <circle cx="4" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="4" cy="18" r="1" fill="currentColor" stroke="none" />
    </>, className),
  gear: ({ size = 17, className }: IconProps = {}) =>
    svg(size, <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.01a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.01a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1Z" />
    </>, className),
  star: ({ size = 16, className }: IconProps = {}) =>
    svg(size, <path d="m12 3.6 2.5 5.2 5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4 5.7-.8L12 3.6Z" />, className),
  starFill: ({ size = 16, className }: IconProps = {}) =>
    svg(size, <path fill="currentColor" stroke="none" d="m12 3.6 2.5 5.2 5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4 5.7-.8L12 3.6Z" />, className),
  download: ({ size = 16, className }: IconProps = {}) =>
    svg(size, <>
      <path d="M12 3v11" />
      <path d="m7.5 10.5 4.5 4 4.5-4" />
      <path d="M4 20h16" />
    </>, className),
  trash: ({ size = 16, className }: IconProps = {}) =>
    svg(size, <>
      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <path d="M6.5 7 7.4 19a1 1 0 0 0 1 .9h7.2a1 1 0 0 0 1-.9L17.5 7" />
    </>, className),
  x: ({ size = 16, className }: IconProps = {}) =>
    svg(size, <path d="m6 6 12 12M18 6 6 18" />, className),
  refresh: ({ size = 16, className }: IconProps = {}) =>
    svg(size, <>
      <path d="M20 12a8 8 0 1 1-2.3-5.6" />
      <path d="M20 4v5h-5" />
    </>, className),
  chevronL: ({ size = 16, className }: IconProps = {}) =>
    svg(size, <path d="m14.5 5-7 7 7 7" />, className),
  chevronR: ({ size = 16, className }: IconProps = {}) =>
    svg(size, <path d="m9.5 5 7 7-7 7" />, className),
  sun: ({ size = 16, className }: IconProps = {}) =>
    svg(size, <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5 5l1.4 1.4M17.6 17.6 19 19M19 5l-1.4 1.4M6.4 17.6 5 19" />
    </>, className),
  moon: ({ size = 16, className }: IconProps = {}) =>
    svg(size, <path d="M20 14.5A8.2 8.2 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z" />, className),
  check: ({ size = 16, className }: IconProps = {}) =>
    svg(size, <path d="m5 12.5 4.5 4.5L19 7.5" />, className),
  alert: ({ size = 16, className }: IconProps = {}) =>
    svg(size, <>
      <path d="M12 3.5 21.5 20H2.5L12 3.5Z" />
      <path d="M12 10v4.5M12 17.2v.3" />
    </>, className),
  info: ({ size = 16, className }: IconProps = {}) =>
    svg(size, <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8v.3" />
    </>, className),
  plus: ({ size = 16, className }: IconProps = {}) =>
    svg(size, <path d="M12 5v14M5 12h14" />, className),
  target: ({ size = 16, className }: IconProps = {}) =>
    svg(size, <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3.5" />
      <circle cx="12" cy="12" r="0.8" fill="currentColor" stroke="none" />
    </>, className),
  layers: ({ size = 16, className }: IconProps = {}) =>
    svg(size, <>
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3 13 9 5 9-5" />
    </>, className),
  building: ({ size = 16, className }: IconProps = {}) =>
    svg(size, <>
      <path d="M4 21V6l8-3 8 3v15" />
      <path d="M9 21v-4h6v4M8 9h.01M12 9h.01M16 9h.01M8 12.5h.01M12 12.5h.01M16 12.5h.01" />
    </>, className),
  spinner: ({ size = 16, className }: IconProps = {}) =>
    svg(size, <>
      <path d="M12 3a9 9 0 1 0 9 9" opacity="0.9" />
    </>, className),
  external: ({ size = 14, className }: IconProps = {}) =>
    svg(size, <>
      <path d="M14 5h5v5" />
      <path d="M19 5 10 14" />
      <path d="M19 14v5H5V5h5" />
    </>, className),
  phone: ({ size = 14, className }: IconProps = {}) =>
    svg(size, <path d="M5 4h4l1.5 4.5L8 10a12 12 0 0 0 6 6l1.5-2.5L20 15v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1Z" />, className),
  chart: ({ size = 16, className }: IconProps = {}) =>
    svg(size, <>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </>, className),
};

/* ————— 按钮 ————— */

export function Btn({
  variant = "default",
  size = "md",
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "primary" | "danger" | "ghost";
  size?: "md" | "sm";
}) {
  const cls = [
    "btn",
    variant !== "default" ? `btn-${variant}` : "",
    size === "sm" ? "btn-sm" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return <button type="button" className={cls} {...rest} />;
}

/* ————— 表单 ————— */

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="input" {...props} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className="select" {...props} />;
}

export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      className={`switch ${on ? "on" : ""}`}
      onClick={() => onChange(!on)}
      title={label}
    />
  );
}

export function Badge({
  tone = "default",
  children,
}: {
  tone?: "default" | "accent" | "amber" | "danger" | "info" | "violet";
  children: ReactNode;
}) {
  return <span className={`badge ${tone !== "default" ? `badge-${tone}` : ""}`}>{children}</span>;
}

/* ————— 模态框 ————— */

export function Modal({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="modal-mask" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label={title}>
        <div className="modal-head">
          <h3 className="modal-title">{title}</h3>
          <div className="spacer" />
          <Btn variant="ghost" size="sm" className="btn-icon" onClick={onClose} aria-label="关闭">
            {Icon.x()}
          </Btn>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

/* ————— 空状态 ————— */

export function Empty({
  icon,
  title,
  desc,
  action,
}: {
  icon?: ReactNode;
  title: string;
  desc?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      {icon && <div className="empty-icon">{icon}</div>}
      <div className="empty-title">{title}</div>
      {desc && <div className="empty-desc">{desc}</div>}
      {action}
    </div>
  );
}
