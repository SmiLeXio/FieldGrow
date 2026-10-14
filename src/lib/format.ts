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

/**
 * 从完整地址中解析区/县名:优先「…区/县/旗」段,其次是与城市不同的县级市段。
 * 例: "河北省保定市莲池区七一东路1号" → "莲池区";"保定市涿州市范阳路" → "涿州市"。
 */
export function parseDistrict(address: string, city = ""): string {
  // 高德地址常见方位前缀 "近郊/郊区/城区…",先清掉再解析
  const addr = (address || "").trim().replace(/^(近郊|远郊|郊县|郊区|城区|县城|周边)+/g, "");
  if (!addr) return "";
  const segs = addr.match(/[^省市]{1,12}(?:自治县|特区|林区|区|县|旗|市)/g) || [];
  const cityNorm = city.replace(/(市|地区|自治州|盟)$/, "");
  let fallback = "";
  for (const seg of segs) {
    if (/(?:自治县|特区|林区|区|县|旗)$/.test(seg)) return seg;
    // 「县级市」段:仅在已知城市名时启用,且需与城市不同(避免把 "保定市" 当区县)
    if (!fallback && cityNorm && !seg.replace(/市$/, "").includes(cityNorm)) fallback = seg;
  }
  return fallback;
}

/** 城市 + 区县(行政区划编码) 统一展示,缺哪段就省哪段。 */
export function fmtCityArea(city: string, district: string, adcode: string): string {
  const parts = [city, district].filter(Boolean).join(" ");
  return adcode ? `${parts || "—"} (${adcode})` : parts || "—";
}

export function timestampName(prefix: string, ext: string): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${prefix}_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.${ext}`;
}
