/** 设置 —— 多 Key 管理(添加/切换/测试/删除)/ 检索配额 / 外观 / 数据管理。
 *
 * 所有字段均为受控组件,输入即写入全局状态并自动持久化到本机。
 */
import { useEffect, useState, type ReactNode } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Badge, Btn, Field, Icon, Input, Switch } from "../components/ui";
import { useApp } from "../lib/appContext";
import { testKey, MIN_INTERVAL_MS } from "../lib/amap";
import type { ApiKeyEntry } from "../lib/types";

function maskKey(key: string): string {
  const k = (key || "").trim();
  if (!k) return "—";
  if (k.length <= 10) return `${k.slice(0, 2)}…`;
  return `${k.slice(0, 6)}…${k.slice(-4)}`;
}

interface TestResult {
  ok: boolean;
  msg: string;
}

function KeyManager({
  kind,
  title,
  desc,
  withJsCode,
}: {
  kind: "web" | "js";
  title: ReactNode;
  desc: string;
  withJsCode?: boolean;
}) {
  const { settings, addApiKey, removeApiKey, setActiveApiKey, pushLog } = useApp();
  const entries: ApiKeyEntry[] = kind === "web" ? settings.webKeys : settings.jsKeys;
  const activeId = kind === "web" ? settings.activeWebKeyId : settings.activeJsKeyId;
  const effectiveActive = entries.find((e) => e.id === activeId)?.id || entries[0]?.id || "";

  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [jsCode, setJsCode] = useState("");
  const [tests, setTests] = useState<Record<string, TestResult>>({});
  const [testingId, setTestingId] = useState("");

  async function runTest(entry: ApiKeyEntry) {
    if (kind !== "web") {
      // JS Key 无法用 REST 验证,给出使用提示
      setTests((t) => ({
        ...t,
        [entry.id]: { ok: true, msg: "JS Key 将在打开地图时验证;若地图无法加载请检查 Key 类型与域名白名单" },
      }));
      return;
    }
    setTestingId(entry.id);
    setTests((t) => ({ ...t, [entry.id]: { ok: true, msg: "测试中…" } }));
    try {
      const msg = await testKey(entry.key);
      setTests((t) => ({ ...t, [entry.id]: { ok: true, msg } }));
      pushLog({ endpoint: "place/text", summary: `Key「${entry.name}」测试:${msg}`, ok: true, error: "" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setTests((t) => ({ ...t, [entry.id]: { ok: false, msg } }));
      pushLog({ endpoint: "place/text", summary: `Key「${entry.name}」测试失败`, ok: false, error: msg });
    } finally {
      setTestingId("");
    }
  }

  function handleAdd() {
    const k = key.trim();
    if (!k) return;
    addApiKey(kind, {
      name: name.trim() || `Key ${entries.length + 1}`,
      key: k,
      securityJsCode: withJsCode ? jsCode.trim() : "",
    });
    setName("");
    setKey("");
    setJsCode("");
  }

  return (
    <div className="card">
      <h2 className="setting-title">
        {title}
        {kind === "web" ? <Badge tone="accent">必需</Badge> : <Badge>可选</Badge>}
      </h2>
      <p className="setting-desc">{desc}</p>

      <div className="setting-stack">
        {entries.length === 0 && (
          <div className="field-hint" style={{ padding: "6px 0" }}>
            暂无 Key,请在下方添加。
          </div>
        )}
        {entries.map((entry) => {
          const isActive = entry.id === effectiveActive;
          const test = tests[entry.id];
          return (
            <div
              key={entry.id}
              style={{
                border: `1px solid ${isActive ? "var(--accent)" : "var(--line)"}`,
                background: isActive ? "var(--accent-soft)" : "var(--bg-2)",
                borderRadius: 12,
                padding: "10px 12px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div className="row" style={{ gap: 10 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="row" style={{ gap: 8 }}>
                    <span style={{ fontWeight: 650, fontSize: 13 }}>{entry.name}</span>
                    {isActive && <Badge tone="accent">使用中</Badge>}
                  </div>
                  <div className="mono" style={{ fontSize: 11, color: "var(--text-2)", marginTop: 2 }}>
                    {maskKey(entry.key)}
                    {withJsCode && entry.securityJsCode ? " · 含安全密钥" : ""}
                  </div>
                </div>
                <Btn
                  size="sm"
                  variant="ghost"
                  title="测试连通"
                  disabled={testingId === entry.id}
                  onClick={() => void runTest(entry)}
                >
                  {testingId === entry.id ? Icon.spinner({ size: 13, className: "spin" }) : Icon.refresh({ size: 13 })}
                  测试
                </Btn>
                {!isActive && (
                  <Btn
                    size="sm"
                    onClick={() => {
                      setActiveApiKey(kind, entry.id);
                    }}
                  >
                    {Icon.check({ size: 13 })} 启用
                  </Btn>
                )}
                <Btn
                  size="sm"
                  variant="ghost"
                  title="删除此 Key"
                  onClick={() => {
                    if (confirm(`确认删除「${entry.name}」?`)) removeApiKey(kind, entry.id);
                  }}
                >
                  {Icon.trash({ size: 13 })}
                </Btn>
              </div>
              {test && (
                <div
                  className="row"
                  style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    background: test.ok ? "var(--accent-soft)" : "var(--danger-soft)",
                    color: test.ok ? "var(--accent-2)" : "var(--danger)",
                    fontSize: 11.5,
                    alignItems: "flex-start",
                  }}
                >
                  {test.ok ? Icon.check({ size: 12 }) : Icon.alert({ size: 12 })}
                  <span>{test.msg}</span>
                </div>
              )}
            </div>
          );
        })}

        {/* 添加新 Key */}
        <div className="divider" />
        <div className="row" style={{ flexWrap: "wrap", alignItems: "flex-end" }}>
          <Field label="备注名">
            <Input
              value={name}
              placeholder={`如:公司账号 / 备用 ${entries.length + 1}`}
              onChange={(e) => setName(e.target.value)}
              style={{ width: 150 }}
            />
          </Field>
          <Field label={withJsCode ? "JS Key" : "Key"}>
            <Input
              className="key-field"
              type="password"
              value={key}
              placeholder={withJsCode ? "Web端(JS API)类型的 Key" : "Web服务类型的 Key"}
              onChange={(e) => setKey(e.target.value)}
              style={{ minWidth: 200 }}
            />
          </Field>
          {withJsCode && (
            <Field label="安全密钥(可选)">
              <Input
                className="key-field"
                type="password"
                value={jsCode}
                placeholder="securityJsCode"
                onChange={(e) => setJsCode(e.target.value)}
                style={{ width: 170 }}
              />
            </Field>
          )}
          <Btn variant="primary" onClick={handleAdd} disabled={!key.trim()}>
            {Icon.plus({ size: 14 })} 添加
          </Btn>
        </div>

        <div className="row" style={{ paddingTop: 2 }}>
          <Btn variant="ghost" size="sm" onClick={() => void openUrl("https://console.amap.com/dev/key/app")}>
            {Icon.external({ size: 13 })} 去高德控制台
          </Btn>
          {kind === "web" && (
            <span className="field-hint">
              配额用完可在列表里一键「启用」其他 Key 继续检索,支持多个 Key 轮换。
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function SettingsView() {
  const { settings, updateSettings, toast, usage, resetUsage, clearPool, clearLogs, pool, logs } = useApp();

  // 每日限额用本地文本态编辑,变更即提交,避免数字被逐键打断
  const [dailyLimitText, setDailyLimitText] = useState(String(settings.dailyLimit));
  useEffect(() => setDailyLimitText(String(settings.dailyLimit)), [settings.dailyLimit]);

  return (
    <div className="view">
      <div className="page-head">
        <div>
          <h1 className="page-title">设置</h1>
          <p className="page-desc">地图 Key 由你掌控:支持多 Key 添加与切换,仅保存在本机,不上传任何服务器</p>
        </div>
        <div className="head-actions">
          <Badge tone="accent">{Icon.check({ size: 13 })} 自动保存</Badge>
        </div>
      </div>

      <div className="settings-grid">
        <KeyManager
          kind="web"
          title={
            <>
              {Icon.target({ size: 17 })} 高德 · Web服务 Key
            </>
          }
          desc="用于 POI 检索、详情与地址定位。在高德开放平台创建「Web服务」类型的 Key,可添加多个并随时切换。"
        />

        <KeyManager
          kind="js"
          withJsCode
          title={
            <>
              {Icon.map({ size: 17 })} 高德 · 地图可视化(JS API)
            </>
          }
          desc="「Web端(JS API)」类型 Key,用于地图打点 / 框选 / 点选中心点。留空则仅使用列表检索,功能不受影响;新版 Key 建议同时填安全密钥。"
        />

        {/* —— 检索与配额 —— */}
        <div className="card">
          <h2 className="setting-title">
            {Icon.chart({ size: 17 })} 检索与配额
          </h2>
          <p className="setting-desc">合规设计:单页 ≤ 50 条、多关键词 ≤ 3、到顶自动停止,杜绝全量拉取。</p>
          <div className="setting-stack">
            <Field label="每日调用上限" hint="到达上限后自动停止检索,次日自动重置">
              <Input
                type="number"
                min={100}
                max={100000}
                value={dailyLimitText}
                onChange={(e) => {
                  setDailyLimitText(e.target.value);
                  const n = Number(e.target.value);
                  if (Number.isFinite(n) && n > 0) updateSettings({ dailyLimit: Math.min(Math.floor(n), 100000) });
                }}
              />
            </Field>
            <div className="kv-row">
              <span>今日已用配额</span>
              <b>
                {usage} / {settings.dailyLimit}
              </b>
            </div>
            <div className="kv-row">
              <span>调用节流间隔</span>
              <b>{MIN_INTERVAL_MS} ms(约 3 QPS)</b>
            </div>
            <div className="kv-row">
              <span>单页条数上限</span>
              <b>50 条</b>
            </div>
            <Btn variant="ghost" onClick={() => { resetUsage(); toast("今日配额已重置", "success"); }}>
              {Icon.refresh({ size: 14 })} 重置今日配额计数
            </Btn>
          </div>
        </div>

        {/* —— 外观 —— */}
        <div className="card">
          <h2 className="setting-title">{Icon.sun({ size: 17 })} 外观</h2>
          <p className="setting-desc">深色为地推外勤优化,浅色适合明亮环境办公。</p>
          <div className="setting-stack">
            <div className="kv-row">
              <span>浅色模式</span>
              <Switch
                on={settings.theme === "light"}
                onChange={(v) => updateSettings({ theme: v ? "light" : "dark" })}
                label="切换浅色/深色"
              />
            </div>
            <div className="kv-row">
              <span>当前主题</span>
              <b>{settings.theme === "light" ? "浅色" : "深色"}</b>
            </div>
          </div>
        </div>

        {/* —— 数据管理 —— */}
        <div className="card full">
          <h2 className="setting-title">{Icon.layers({ size: 17 })} 数据管理</h2>
          <p className="setting-desc">
            所有数据仅存本机(客户池 / 调用日志 / 设置)。商户原始检索结果为临时数据,不做云端沉淀。
          </p>
          <div className="row" style={{ flexWrap: "wrap" }}>
            <div className="kv-row" style={{ border: 0, padding: 0, gap: 8 }}>
              <span>
                客户池 <b>{pool.length}</b> 条 · 日志 <b>{logs.length}</b> 条
              </span>
            </div>
            <div className="spacer" />
            <Btn
              variant="danger"
              onClick={() => {
                if (confirm(`确认清空客户池全部 ${pool.length} 条记录?`)) {
                  clearPool();
                  toast("客户池已清空", "success");
                }
              }}
              disabled={!pool.length}
            >
              {Icon.trash({ size: 14 })} 清空客户池
            </Btn>
            <Btn
              variant="danger"
              onClick={() => {
                clearLogs();
                toast("调用日志已清空", "success");
              }}
              disabled={!logs.length}
            >
              {Icon.trash({ size: 14 })} 清空调用日志
            </Btn>
          </div>
        </div>

        {/* —— 关于 —— */}
        <div className="card full">
          <h2 className="setting-title">{Icon.info({ size: 17 })} 关于 FieldGrow</h2>
          <p className="setting-desc" style={{ marginBottom: 8 }}>
            FieldGrow · 地推拓客利器 —— 地图商户检索 / 信息管理 / 一键导出。
            <br />
            遵守高德开放平台协议:仅人工发起检索、结果人工筛选、支持一键清空,禁止构建全量商户数据库。
          </p>
          <div className="row">
            <Badge tone="accent">v0.2.5</Badge>
            <Badge tone="info">Windows / macOS / Linux</Badge>
            <Badge tone="violet">Tauri 2 · 轻量内核</Badge>
            <div className="spacer" />
            <Btn variant="ghost" size="sm" onClick={() => void openUrl("https://github.com/SmiLeXio/FieldGrow")}>
              {Icon.external({ size: 13 })} GitHub
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}
