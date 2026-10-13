/** 高德 Web 服务 REST 客户端。
 *
 * 请求经由 Rust 侧 `amap_request` 代理发出(规避浏览器 CORS,并做端点白名单管控)。
 * 合规:单页 ≤50 条、多关键词 ≤3、调用节流由 UI 层执行,禁止全量拉取。
 */
import { invoke } from "@tauri-apps/api/core";
import { classifyTel } from "./format";
import type { Bounds, PoiDetail, PoiItem, SearchQuery, SearchResponse } from "./types";

export const MAX_KEYWORDS = 3;
export const MAX_PAGE_SIZE = 50;
/** 相邻两次 API 调用的最小间隔(毫秒) —— 控制在约 3 QPS 以内 */
export const MIN_INTERVAL_MS = 350;

let lastCallAt = 0;

/** 全局节流:保证调用间隔 ≥ MIN_INTERVAL_MS */
export async function throttle(): Promise<void> {
  const wait = lastCallAt + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCallAt = Date.now();
}

export class AmapError extends Error {}

interface RawPoi {
  id?: string;
  name?: string;
  address?: string;
  location?: string;
  tel?: string;
  type?: string;
  typecode?: string;
  cityname?: string;
  adcode?: string;
  biz_ext?: { rating?: unknown; cost?: string; opening_hours?: string; alias?: string; tag?: string };
  business_area?: string;
}

async function callAmap(endpoint: string, params: Record<string, string>): Promise<Record<string, unknown>> {
  const entries = Object.entries(params).filter(([, v]) => v !== "" && v != null);
  const text = await invoke<string>("amap_request", { req: { endpoint, params: entries } });
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new AmapError("地图接口返回了无法解析的数据");
  }
  if (String(data.status) !== "1") {
    const info = String(data.info || "");
    const infocode = String(data.infocode || "");
    throw new AmapError(mapAmapError(info, infocode));
  }
  return data;
}

function mapAmapError(info: string, infocode: string): string {
  const table: Record<string, string> = {
    INVALID_USER_KEY: "API Key 无效,请检查「设置」中的 Key",
    DAILY_QUERY_OVER_LIMIT: "已超出日调用配额,请明日再试或更换 Key",
    DAILY_QUERY_OVER_LIMIT_USER: "已超出该 Key 的日调用配额",
    USERKEY_PLAT_NOMATCH: "Key 类型不匹配:检索需使用「Web服务」类型的 Key",
    INVALID_USER_IP: "Key 绑定了 IP 白名单,当前 IP 不在白名单内",
    INVALID_USER_DOMAIN: "Key 绑定了域名白名单,当前来源不在白名单内",
    INVALID_PARAMS: "请求参数不合法",
    TIMEOUT: "地图接口超时,请稍后重试",
  };
  const base = table[infocode] || (info ? `地图接口返回失败: ${info}` : "地图接口调用失败");
  return infocode && table[infocode] ? `${base}(${infocode})` : base;
}

function toPoi(raw: RawPoi, source = "amap"): PoiItem {
  const telRaw = (raw.tel || "").trim().replace(/;$/, "");
  const tel = telRaw ? telRaw.split(";")[0].trim() : "";
  let rating = 0;
  const r = raw.biz_ext?.rating;
  if (r != null && r !== "") {
    const n = Number(r);
    if (!Number.isNaN(n)) rating = n;
  }
  return {
    poiId: raw.id || "",
    name: raw.name || "",
    address: raw.address || "",
    tel,
    telType: classifyTel(tel),
    rating,
    city: raw.cityname || "",
    adcode: raw.adcode || "",
    location: (raw.location || "").trim(),
    type: raw.type || "",
    source,
  };
}

/** 拆分多关键词(逗号/顿号/竖线),去重,最多 MAX_KEYWORDS 个 */
export function splitKeywords(input: string): string[] {
  const out: string[] = [];
  for (const part of input.split(/[,，、|]/)) {
    const kw = part.trim();
    if (kw && !out.includes(kw)) out.push(kw);
  }
  return out.slice(0, MAX_KEYWORDS);
}

function boundsToPolygon(b: Bounds): string {
  // 高德 polygon: lng1,lat1|lng2,lat2|... (矩形: 左下/右上即可)
  const p = (lng: number, lat: number) => `${lng.toFixed(6)},${lat.toFixed(6)}`;
  return `${p(b.west, b.south)}|${p(b.east, b.south)}|${p(b.east, b.north)}|${p(b.west, b.north)}`;
}

/** 执行一次检索(多关键词自动拆分逐个调用,按 poiId 并集合并)。 */
export async function searchPoi(query: SearchQuery, webKey: string): Promise<SearchResponse> {
  const kws = splitKeywords(query.keywords);
  if (!kws.length) throw new AmapError("请输入检索关键词(多个关键词用逗号分隔,最多 3 个)");
  if (!webKey) throw new AmapError("请先在「设置」中填写高德 Web服务 Key");

  const pageSize = Math.min(Math.max(query.pageSize, 1), MAX_PAGE_SIZE);
  const merged: PoiItem[] = [];
  const seen = new Set<string>();
  let total = 0;

  for (const kw of kws) {
    await throttle();
    let endpoint = "place/text";
    const params: Record<string, string> = {
      key: webKey,
      keywords: kw,
      output: "json",
      extensions: "all",
      offset: String(pageSize),
      page: String(query.page),
    };
    if (query.mode === "polygon") {
      if (!query.bounds) throw new AmapError("请在地图上框选范围,或手动填写矩形范围");
      endpoint = "place/polygon";
      params.polygon = boundsToPolygon(query.bounds);
    } else if (query.mode === "around") {
      if (!query.center) throw new AmapError("请设置周边检索的中心点");
      endpoint = "place/around";
      params.location = query.center;
      params.radius = String(Math.min(Math.max(query.radius, 100), 50000));
    } else {
      if (query.region) {
        params.region = query.region;
        params.citylimit = query.cityLimit ? "true" : "false";
      }
    }

    const data = await callAmap(endpoint, params);
    total += Number(data.count || 0);
    const pois = (data.pois as RawPoi[]) || [];
    for (const raw of pois) {
      const poi = toPoi(raw);
      if (!poi.poiId || seen.has(poi.poiId)) continue;
      seen.add(poi.poiId);
      merged.push(poi);
    }
  }

  let items = merged;
  if (query.onlyWithTel) items = items.filter((p) => p.tel);
  return { total, page: query.page, pageSize, keywords: kws, items };
}

/** POI 详情:完整电话 / 营业时间 / 均价 / 别名等。 */
export async function fetchDetail(poiId: string, webKey: string): Promise<PoiDetail> {
  if (!webKey) throw new AmapError("请先在「设置」中填写高德 Web服务 Key");
  await throttle();
  const data = await callAmap("place/detail", {
    key: webKey,
    id: poiId,
    output: "json",
    extensions: "all",
  });
  const raw = ((data.pois as RawPoi[]) || [])[0];
  if (!raw) throw new AmapError("未查询到该 POI 的详情");
  const base = toPoi(raw);
  const telAll = (raw.tel || "")
    .split(";")
    .map((t) => t.trim())
    .filter(Boolean);
  return {
    ...base,
    tel: base.tel || (telAll[0] || ""),
    telType: classifyTel(base.tel || (telAll[0] || "")),
    telAll,
    typecode: raw.typecode || "",
    openingHours: raw.biz_ext?.opening_hours || "",
    cost: raw.biz_ext?.cost || "",
    alias: raw.biz_ext?.alias || "",
    tag: raw.biz_ext?.tag || "",
    businessArea: Array.isArray(raw.business_area) ? (raw.business_area as string[]).join("/") : String(raw.business_area || ""),
  };
}

/** 地理编码:地址/地标 → "lng,lat"(周边检索中心点定位用)。 */
export async function geocode(address: string, webKey: string, city = ""): Promise<string> {
  if (!webKey) throw new AmapError("请先在「设置」中填写高德 Web服务 Key");
  await throttle();
  const params: Record<string, string> = {
    key: webKey,
    address,
    output: "json",
  };
  if (city) params.city = city;
  const data = await callAmap("geocode/geo", params);
  const geocodes = (data.geocodes as { location?: string }[]) || [];
  const loc = geocodes[0]?.location || "";
  if (!loc) throw new AmapError(`未能定位地址「${address}」,请尝试更完整的地址或地标名`);
  return loc.trim();
}

/** 连通性测试:用一个轻量查询验证 Key 可用。 */
export async function testKey(webKey: string): Promise<string> {
  await throttle();
  const data = await callAmap("place/text", {
    key: webKey,
    keywords: "咖啡",
    region: "北京市",
    citylimit: "true",
    offset: "1",
    page: "1",
    output: "json",
    extensions: "base",
  });
  return `连接正常,示例查询命中 ${Number(data.count || 0)} 条`;
}
