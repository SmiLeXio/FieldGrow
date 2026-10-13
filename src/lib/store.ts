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

export function loadPool(): PoolItem[] {
  return loadList<PoolItem>(K.pool);
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
