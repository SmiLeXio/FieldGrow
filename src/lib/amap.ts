/** 高德 Web 服务 REST 客户端。
 *
 * 请求经由 Rust 侧 `amap_request` 代理发出(规避浏览器 CORS,并做端点白名单管控)。
 * 支持多页累加检索与网格切分深扫 —— 高德单次检索返回量有截断上限,
 * 想把一片区域摸全,靠「更小的格子 × 更多的页数 × 更细的关键词」。
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

/** 宽容字符串化:高德个别字段(tel/address)偶尔返回数字/数组 */
function s(v: unknown): string {
  if (v == null) return "";
  if (Array.isArray(v)) return v.map(s).filter(Boolean).join(";");
  return String(v).trim();
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
    const info = s(data.info);
    const infocode = s(data.infocode);
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

function toPoi(raw: Record<string, unknown>, source = "amap"): PoiItem {
  const telFull = s(raw.tel).replace(/;$/, "");
  const tel = telFull ? telFull.split(";")[0].trim() : "";
  let rating = 0;
  const biz = raw.biz_ext as Record<string, unknown> | undefined;
  const r = biz?.rating;
  if (r != null && r !== "") {
    const n = Number(r);
    if (!Number.isNaN(n)) rating = n;
  }
  return {
    poiId: s(raw.id),
    name: s(raw.name),
    address: s(raw.address),
    tel,
    telType: classifyTel(tel),
    rating,
    city: s(raw.cityname),
    adcode: s(raw.adcode),
    location: s(raw.location),
    type: s(raw.type),
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
  const p = (lng: number, lat: number) => `${lng.toFixed(6)},${lat.toFixed(6)}`;
  return `${p(b.west, b.south)}|${p(b.east, b.south)}|${p(b.east, b.north)}|${p(b.west, b.north)}`;
}

/** 矩形网格切分 —— 区域深扫用:n×n 个子矩形 */
export function splitBoundsGrid(b: Bounds, n: number): Bounds[] {
  const cells: Bounds[] = [];
  const w = (b.east - b.west) / n;
  const h = (b.north - b.south) / n;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      cells.push({
        west: Number((b.west + j * w).toFixed(6)),
        south: Number((b.south + i * h).toFixed(6)),
        east: Number((b.west + (j + 1) * w).toFixed(6)),
        north: Number((b.south + (i + 1) * h).toFixed(6)),
      });
    }
  }
  return cells;
}

/** 单关键词单页检索 */
async function searchOnePage(
  query: SearchQuery,
  webKey: string,
  kw: string,
  page: number,
): Promise<{ items: PoiItem[]; total: number }> {
  await throttle();
  const pageSize = Math.min(Math.max(query.pageSize, 1), MAX_PAGE_SIZE);
  let endpoint = "place/text";
  const params: Record<string, string> = {
    key: webKey,
    keywords: kw,
    output: "json",
    extensions: "all",
    offset: String(pageSize),
    page: String(page),
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
  const total = Number(data.count || 0);
  const items: PoiItem[] = [];
  for (const raw of (data.pois as Record<string, unknown>[]) || []) {
    const poi = toPoi(raw);
    if (poi.poiId) items.push(poi);
  }
  return { items, total };
}

export interface SearchPagesResult extends SearchResponse {
  /** 本次实际发起的 API 调用次数(关键词 × 页数) */
  calls: number;
  /** 本次抓取的页数 */
  pagesFetched: number;
  /** 是否已无更多结果 */
  exhausted: boolean;
}

/**
 * 分页累加检索:抓取 fromPage 起连续 pageCount 页,按 poiId 去重合并。
 * replace=false 时由调用方自行与既有结果合并(SearchView 处理)。
 */
export async function searchPoiPages(
  query: SearchQuery,
  webKey: string,
  opts: { fromPage: number; pageCount: number },
): Promise<SearchPagesResult> {
  const kws = splitKeywords(query.keywords);
  if (!kws.length) throw new AmapError("请输入检索关键词(多个关键词用逗号分隔,最多 3 个)");
  if (!webKey) throw new AmapError("请先在「设置」中填写高德 Web服务 Key");

  const merged: PoiItem[] = [];
  const seen = new Set<string>();
  let total = 0;
  let calls = 0;
  let pagesFetched = 0;
  let anyItems = false;

  for (let p = 0; p < opts.pageCount; p++) {
    const page = opts.fromPage + p;
    let pageEmpty = true;
    for (const kw of kws) {
      const r = await searchOnePage(query, webKey, kw, page);
      calls++;
      total = Math.max(total, r.total);
      for (const poi of r.items) {
        if (seen.has(poi.poiId)) continue;
        seen.add(poi.poiId);
        merged.push(poi);
        pageEmpty = false;
        anyItems = true;
      }
    }
    pagesFetched++;
    // 该页全部关键词都空 → 后续页也不会有,提前结束
    if (pageEmpty) break;
  }

  let items = merged;
  if (query.onlyWithTel) items = items.filter((p) => p.tel);
  return {
    total,
    page: opts.fromPage,
    pageSize: query.pageSize,
    keywords: kws,
    items,
    calls,
    pagesFetched,
    exhausted: pagesFetched < opts.pageCount || !anyItems,
  };
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
  const raw = ((data.pois as Record<string, unknown>[]) || [])[0];
  if (!raw) throw new AmapError("未查询到该 POI 的详情");
  const base = toPoi(raw);
  const telAll = s(raw.tel)
    .split(";")
    .map((t) => t.trim())
    .filter(Boolean);
  const biz = raw.biz_ext as Record<string, unknown> | undefined;
  const businessArea = raw.business_area;
  return {
    ...base,
    tel: base.tel || (telAll[0] || ""),
    telType: classifyTel(base.tel || (telAll[0] || "")),
    telAll,
    typecode: s(raw.typecode),
    openingHours: s(biz?.opening_hours),
    cost: s(biz?.cost),
    alias: s(biz?.alias),
    tag: s(biz?.tag),
    businessArea: Array.isArray(businessArea) ? businessArea.map(s).join("/") : s(businessArea),
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
  const loc = s(geocodes[0]?.location);
  if (!loc) throw new AmapError(`未能定位地址「${address}」,请尝试更完整的地址或地标名`);
  return loc;
}

/** 行政区划:城市 → 区县列表(区县筛选用) */
export interface District {
  name: string;
  adcode: string;
}

export async function fetchDistricts(city: string, webKey: string): Promise<District[]> {
  if (!webKey) return [];
  await throttle();
  const data = await callAmap("config/district", {
    key: webKey,
    keywords: city,
    subdistrict: "1",
    extensions: "base",
    output: "json",
  });
  const top = ((data.districts as Record<string, unknown>[]) || [])[0];
  const children = (top?.districts as Record<string, unknown>[]) || [];
  return children
    .map((d) => ({ name: s(d.name), adcode: s(d.adcode) }))
    .filter((d) => d.adcode && d.name);
}

/** 圆形检索范围 → 外接矩形(网格深扫用) */
export function circleBounds(center: string, radiusM: number): Bounds {
  const [lng, lat] = center.split(",").map(Number);
  const dLat = radiusM / 111320;
  const dLng = radiusM / (111320 * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));
  return {
    west: Number((lng - dLng).toFixed(6)),
    south: Number((lat - dLat).toFixed(6)),
    east: Number((lng + dLng).toFixed(6)),
    north: Number((lat + dLat).toFixed(6)),
  };
}

/** 判断 POI 是否在中心点半径内(周边网格深扫后裁剪成真正的圆形区域) */
export function withinRadius(center: string, location: string, radiusM: number): boolean {
  const [lng1, lat1] = center.split(",").map(Number);
  const [lng2, lat2] = location.split(",").map(Number);
  if ([lng1, lat1, lng2, lat2].some((v) => Number.isNaN(v))) return true;
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a)) <= radiusM * 1.05;
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
