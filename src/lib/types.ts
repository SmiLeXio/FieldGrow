/** 领域模型 —— 对齐 VoxAI 一期 POI 检索数据结构,面向地推拓客场景。 */

export type TelType = "landline" | "mobile" | "unknown";

export interface PoiItem {
  poiId: string;
  name: string;
  address: string;
  tel: string;
  telType: TelType;
  rating: number;
  city: string;
  adcode: string;
  /** "经度,纬度" */
  location: string;
  /** POI 类型,如 "餐饮服务;中餐厅;川菜(川菜)" */
  type: string;
  source: string;
}

export interface PoiDetail extends PoiItem {
  /** 全部联系电话(详情接口返回,分号分隔) */
  telAll: string[];
  typecode: string;
  openingHours: string;
  cost: string;
  alias: string;
  tag: string;
  businessArea: string;
}

export interface SearchResponse {
  total: number;
  page: number;
  pageSize: number;
  keywords: string[];
  items: PoiItem[];
}

export type SearchMode = "text" | "polygon" | "around";

export interface Bounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface SearchQuery {
  mode: SearchMode;
  keywords: string;
  /** 文本检索: 城市名或 adcode */
  region: string;
  cityLimit: boolean;
  /** 框选检索: 矩形范围 */
  bounds: Bounds | null;
  /** 周边检索: 中心点 "lng,lat" */
  center: string;
  /** 周边检索: 半径(米) */
  radius: number;
  page: number;
  pageSize: number;
  /** 仅保留有电话的商户 */
  onlyWithTel: boolean;
}

export type PoolStatus = "待跟进" | "已联系" | "有意向" | "已合作" | "无效";

export const POOL_STATUSES: PoolStatus[] = ["待跟进", "已联系", "有意向", "已合作", "无效"];

export interface PoolItem extends PoiItem {
  status: PoolStatus;
  note: string;
  /** ISO 时间 */
  addedAt: string;
}

export interface LogEntry {
  id: string;
  time: string;
  endpoint: string;
  summary: string;
  ok: boolean;
  error: string;
}

export interface Settings {
  /** 高德「Web服务」Key —— 检索/详情/地理编码 */
  webKey: string;
  /** 高德「Web端(JS API)」Key —— 地图可视化(可选) */
  jsKey: string;
  /** JS API 安全密钥(可选,新版 Key 在高德控制台查看) */
  securityJsCode: string;
  /** 每日调用上限(合规:到顶自动停止检索) */
  dailyLimit: number;
  theme: "dark" | "light";
}

export const DEFAULT_SETTINGS: Settings = {
  webKey: "",
  jsKey: "",
  securityJsCode: "",
  dailyLimit: 4500,
  theme: "dark",
};
