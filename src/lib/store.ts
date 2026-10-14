/** 本地持久化 —— 设置 / 客户池 / 调用日志 / 配额计数,全部存于本机 localStorage。 */
import type { LogEntry, PoolItem, Settings } from "./types";
import { DEFAULT_SETTINGS } from "./types";

const K = {
  settings: "fieldgrow.settings.v1",
  pool: "fieldgrow.pool.v1",
  logs: "fieldgrow.logs.v1",
  usage: "fieldgrow.usage.v1",
};

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...JSON.parse(raw) } as T;
  } catch {
    return fallback;
  }
}

function loadList<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 空间不足等情况静默忽略,不影响主流程 */
  }
}

export function loadSettings(): Settings {
  return load<Settings>(K.settings, DEFAULT_SETTINGS);
}

export function saveSettings(s: Settings) {
  save(K.settings, s);
}

/** 客户池排重:同 POI ID / 同电话号码 / 同店名+地址,任一命中视为同一家,保留最早的一条。 */
export function dedupePool(items: PoolItem[]): PoolItem[] {
  const seen = new Set<string>();
  return items.filter((p) => {
    const keys = [`id:${p.poiId}`];
    const digits = (p.tel || "").replace(/\D/g, "");
    if (digits) keys.push(`tel:${digits}`);
    if (p.name) keys.push(`na:${p.name}|${p.address}`);
    if (keys.some((k) => seen.has(k))) return false;
    for (const k of keys) seen.add(k);
    return true;
  });
}

export function loadPool(): PoolItem[] {
  return dedupePool(loadList<PoolItem>(K.pool));
}

export function savePool(pool: PoolItem[]) {
  save(K.pool, pool);
}

export function loadLogs(): LogEntry[] {
  return loadList<LogEntry>(K.logs);
}

export function saveLogs(logs: LogEntry[]) {
  save(K.logs, logs.slice(-500));
}

interface Usage {
  date: string; // YYYY-MM-DD
  count: number;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function loadUsage(): number {
  const u = load<Usage>(K.usage, { date: today(), count: 0 });
  return u.date === today() ? u.count : 0;
}

export function saveUsage(count: number) {
  save(K.usage, { date: today(), count } satisfies Usage);
}
