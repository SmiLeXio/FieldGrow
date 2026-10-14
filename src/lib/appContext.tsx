/** 全局应用状态:设置 / 客户池 / 日志 / 配额 / Toast,统一在此持久化与分发。 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  loadLogs,
  loadPool,
  loadSettings,
  loadUsage,
  saveLogs,
  savePool,
  saveSettings,
  saveUsage,
} from "./store";
import type { ApiKeyEntry, LogEntry, PoiItem, PoolItem, PoolStatus, Settings } from "./types";

export type ToastKind = "info" | "success" | "error";
interface Toast {
  id: number;
  kind: ToastKind;
  msg: string;
}

interface AppCtx {
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  theme: "dark" | "light";

  /** 当前生效的 Web服务 Key(检索/详情/定位) */
  activeWebKey: string;
  /** 当前生效的 JS 地图 Key + 安全密钥 */
  activeJsKey: string;
  activeJsCode: string;
  /** Key 管理:增 / 删 / 切换 */
  addApiKey: (kind: "web" | "js", entry: Omit<ApiKeyEntry, "id">) => void;
  removeApiKey: (kind: "web" | "js", id: string) => void;
  setActiveApiKey: (kind: "web" | "js", id: string) => void;

  pool: PoolItem[];
  addToPool: (items: PoiItem[]) => number;
  updatePoolItem: (poiId: string, patch: Partial<Pick<PoolItem, "status" | "note">>) => void;
  removeFromPool: (poiId: string) => void;
  clearPool: () => void;
  inPool: (item: PoiItem) => boolean;

  logs: LogEntry[];
  pushLog: (entry: Omit<LogEntry, "id" | "time">) => void;
  clearLogs: () => void;

  /** 今日已用配额 */
  usage: number;
  /** 消耗 1 次配额,返回 false 表示已到顶(调用方应停止检索) */
  consumeQuota: () => boolean;
  resetUsage: () => void;

  toast: (msg: string, kind?: ToastKind) => void;
  toasts: Toast[];
  dismissToast: (id: number) => void;
}

const Ctx = createContext<AppCtx | null>(null);

export function useApp(): AppCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used within AppProvider");
  return v;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [pool, setPool] = useState<PoolItem[]>(() => loadPool());
  const [logs, setLogs] = useState<LogEntry[]>(() => loadLogs());
  const [usage, setUsage] = useState<number>(() => loadUsage());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  useEffect(() => saveSettings(settings), [settings]);
  useEffect(() => savePool(pool), [pool]);
  useEffect(() => saveLogs(logs), [logs]);
  useEffect(() => saveUsage(usage), [usage]);

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
  }, [settings.theme]);

  const toast = useCallback((msg: string, kind: ToastKind = "info") => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, kind, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((s) => ({ ...s, ...patch }));
  }, []);

  /* —— 多 Key 管理 —— */
  const addApiKey = useCallback((kind: "web" | "js", entry: Omit<ApiKeyEntry, "id">) => {
    setSettings((s) => {
      const id = `${kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
      const item: ApiKeyEntry = { ...entry, id };
      if (kind === "web") {
        const webKeys = [...s.webKeys, item];
        return { ...s, webKeys, activeWebKeyId: s.activeWebKeyId || id };
      }
      const jsKeys = [...s.jsKeys, item];
      return { ...s, jsKeys, activeJsKeyId: s.activeJsKeyId || id };
    });
  }, []);

  const removeApiKey = useCallback((kind: "web" | "js", id: string) => {
    setSettings((s) => {
      if (kind === "web") {
        const webKeys = s.webKeys.filter((k) => k.id !== id);
        return {
          ...s,
          webKeys,
          activeWebKeyId: s.activeWebKeyId === id ? webKeys[0]?.id || "" : s.activeWebKeyId,
        };
      }
      const jsKeys = s.jsKeys.filter((k) => k.id !== id);
      return {
        ...s,
        jsKeys,
        activeJsKeyId: s.activeJsKeyId === id ? jsKeys[0]?.id || "" : s.activeJsKeyId,
      };
    });
  }, []);

  const setActiveApiKey = useCallback((kind: "web" | "js", id: string) => {
    setSettings((s) =>
      kind === "web" ? { ...s, activeWebKeyId: id } : { ...s, activeJsKeyId: id },
    );
  }, []);

  const activeWebKey =
    settings.webKeys.find((k) => k.id === settings.activeWebKeyId)?.key || settings.webKeys[0]?.key || "";
  const activeJsEntry =
    settings.jsKeys.find((k) => k.id === settings.activeJsKeyId) || settings.jsKeys[0];
  const activeJsKey = activeJsEntry?.key || "";
  const activeJsCode = activeJsEntry?.securityJsCode || "";

  const inPool = useCallback(
    (it: PoiItem) => {
      const digits = (it.tel || "").replace(/\D/g, "");
      const na = `${it.name}|${it.address}`;
      return pool.some(
        (p) =>
          p.poiId === it.poiId ||
          (digits && (p.tel || "").replace(/\D/g, "") === digits) ||
          (it.name && `${p.name}|${p.address}` === na),
      );
    },
    [pool],
  );

  const addToPool = useCallback((items: PoiItem[]) => {
    let added = 0;
    setPool((prev) => {
      const next = [...prev];
      const seenTel = new Set(prev.map((p) => (p.tel || "").replace(/\D/g, "")).filter(Boolean));
      const seenNa = new Set(prev.map((p) => `${p.name}|${p.address}`));
      const seenId = new Set(prev.map((p) => p.poiId));
      for (const it of items) {
        const digits = (it.tel || "").replace(/\D/g, "");
        const na = `${it.name}|${it.address}`;
        // 自动排重:同 POI / 同电话 / 同店名+地址 任一命中即跳过
        if (!it.poiId || seenId.has(it.poiId)) continue;
        if (digits && seenTel.has(digits)) continue;
        if (it.name && seenNa.has(na)) continue;
        seenId.add(it.poiId);
        if (digits) seenTel.add(digits);
        seenNa.add(na);
        next.push({ ...it, status: "待跟进" as PoolStatus, note: "", addedAt: new Date().toISOString() });
        added++;
      }
      return next;
    });
    return added;
  }, []);

  const updatePoolItem = useCallback(
    (poiId: string, patch: Partial<Pick<PoolItem, "status" | "note">>) => {
      setPool((prev) => prev.map((p) => (p.poiId === poiId ? { ...p, ...patch } : p)));
    },
    [],
  );

  const removeFromPool = useCallback((poiId: string) => {
    setPool((prev) => prev.filter((p) => p.poiId !== poiId));
  }, []);

  const clearPool = useCallback(() => setPool([]), []);

  const pushLog = useCallback((entry: Omit<LogEntry, "id" | "time">) => {
    setLogs((prev) =>
      [
        ...prev,
        {
          ...entry,
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          time: new Date().toISOString(),
        },
      ].slice(-500),
    );
  }, []);

  const clearLogs = useCallback(() => setLogs([]), []);

  const consumeQuota = useCallback(() => {
    let ok = true;
    setUsage((u) => {
      if (u >= settings.dailyLimit) {
        ok = false;
        return u;
      }
      return u + 1;
    });
    return ok;
  }, [settings.dailyLimit]);

  const resetUsage = useCallback(() => setUsage(0), []);

  const value = useMemo<AppCtx>(
    () => ({
      settings,
      updateSettings,
      theme: settings.theme,
      activeWebKey,
      activeJsKey,
      activeJsCode,
      addApiKey,
      removeApiKey,
      setActiveApiKey,
      pool,
      addToPool,
      updatePoolItem,
      removeFromPool,
      clearPool,
      inPool,
      logs,
      pushLog,
      clearLogs,
      usage,
      consumeQuota,
      resetUsage,
      toast,
      toasts,
      dismissToast,
    }),
    [
      settings, updateSettings, activeWebKey, activeJsKey, activeJsCode,
      addApiKey, removeApiKey, setActiveApiKey,
      pool, addToPool, updatePoolItem, removeFromPool, clearPool,
      inPool, logs, pushLog, clearLogs, usage, consumeQuota, resetUsage, toast, toasts, dismissToast,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function ToastStack() {
  const { toasts, dismissToast } = useApp();
  return (
    <div className="toast-stack">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`} onClick={() => dismissToast(t.id)} role="status">
          <span className="toast-dot" />
          <span>{t.msg}</span>
        </div>
      ))}
    </div>
  );
}
