import type { TelType } from "./types";

/** 区分座机/手机:含 - 或总位数≤12 且不以 1 开头视为座机;11 位 1 开头为手机。 */
export function classifyTel(tel: string): TelType {
  const t = (tel || "").trim();
  if (!t) return "unknown";
  const digits = t.replace(/\D/g, "");
  if (t.includes("-") || (digits.length <= 12 && !digits.startsWith("1"))) return "landline";
  if (digits.length === 11 && digits.startsWith("1")) return "mobile";
  return "unknown";
}

export function telTypeLabel(t: TelType): string {
  return t === "landline" ? "座机" : t === "mobile" ? "手机" : "未知";
}

export function fmtRating(r: number): string {
  return r > 0 ? r.toFixed(1) : "—";
}

export function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function fmtLocation(loc: string): string {
  const [lng, lat] = (loc || "").split(",");
  if (!lng || !lat) return "—";
  return `${Number(lng).toFixed(5)}, ${Number(lat).toFixed(5)}`;
}

export function timestampName(prefix: string, ext: string): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${prefix}_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.${ext}`;
}
