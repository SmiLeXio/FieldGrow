/** 侧边导航 —— 品牌区 / 视图切换 / 今日配额小卡片 / 主题切换。 */
import type { ReactNode } from "react";
import { useApp } from "../lib/appContext";
import { Icon, Btn } from "./ui";

export type ViewKey = "search" | "pool" | "logs" | "settings";

const NAV: { key: ViewKey; label: string; icon: (p?: { size?: number }) => ReactNode }[] = [
  { key: "search", label: "商户检索", icon: (p) => Icon.search(p) },
  { key: "pool", label: "客户池", icon: (p) => Icon.pool(p) },
  { key: "logs", label: "调用日志", icon: (p) => Icon.log(p) },
  { key: "settings", label: "设置", icon: (p) => Icon.gear(p) },
];

export function Sidebar({ view, onChange }: { view: ViewKey; onChange: (v: ViewKey) => void }) {
  const { pool, usage, settings, activeWebKey, theme, updateSettings, logs } = useApp();
  const pct = Math.min(100, Math.round((usage / Math.max(settings.dailyLimit, 1)) * 100));

  const badges: Partial<Record<ViewKey, number>> = {
    pool: pool.length,
    logs: logs.length,
  };

  return (
    <aside className="sidebar">
      <div className="brand">
        <img src="logo.png" alt="FieldGrow" className="brand-logo" />
        <div>
          <div className="brand-name">FieldGrow</div>
          <div className="brand-sub">Field · Grow</div>
        </div>
      </div>

      <nav className="nav">
        {NAV.map((item) => (
          <button
            key={item.key}
            className={`nav-item ${view === item.key ? "active" : ""}`}
            onClick={() => onChange(item.key)}
          >
            {item.icon({ size: 17 })}
            {item.label}
            {badges[item.key] ? <span className="nav-badge">{badges[item.key]}</span> : null}
          </button>
        ))}
      </nav>

      <div className="sidebar-foot">
        <div className="quota-label">
          <span>今日 API 配额</span>
          <b>
            {usage} / {settings.dailyLimit}
          </b>
        </div>
        <div className="quota-track">
          <div className={`quota-fill ${pct >= 90 ? "warn" : ""}`} style={{ width: `${pct}%` }} />
        </div>
        <div className="row" style={{ marginTop: 12, justifyContent: "space-between" }}>
          <span style={{ fontSize: 10.5, color: "var(--text-3)", letterSpacing: 0.4 }}>
            {activeWebKey ? "KEY 已配置" : "KEY 未配置"}
          </span>
          <Btn
            size="sm"
            variant="ghost"
            className="btn-icon"
            title={theme === "dark" ? "切换浅色模式" : "切换深色模式"}
            onClick={() => updateSettings({ theme: theme === "dark" ? "light" : "dark" })}
          >
            {theme === "dark" ? Icon.sun({ size: 14 }) : Icon.moon({ size: 14 })}
          </Btn>
        </div>
      </div>
    </aside>
  );
}
