/** 设置 —— 高德 Key 配置(界面自助输入)/ 检索配额 / 外观 / 数据管理。
 *
 * 所有字段均为受控组件,输入即写入全局状态并自动持久化到本机,
 * 切换页面 / 重启软件都不会丢失(修复:草稿态丢失导致的"key 被清空")。
 */
import { useEffect, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Badge, Btn, Field, Icon, Input, Switch } from "../components/ui";
import { useApp } from "../lib/appContext";
import { testKey, MIN_INTERVAL_MS } from "../lib/amap";

export function SettingsView() {
  const { settings, updateSettings, toast, usage, resetUsage, clearPool, clearLogs, pool, logs, pushLog } = useApp();

  // 每日限额用本地文本态编辑,失焦/变更即提交,避免数字被逐键打断
  const [dailyLimitText, setDailyLimitText] = useState(String(settings.dailyLimit));
  useEffect(() => setDailyLimitText(String(settings.dailyLimit)), [settings.dailyLimit]);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  async function runTest() {
    const key = settings.webKey.trim();
    if (!key) {
      setTestResult({ ok: false, msg: "请先填写 Web服务 Key" });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const msg = await testKey(key);
      setTestResult({ ok: true, msg });
      pushLog({ endpoint: "place/text", summary: `Key 连通测试:${msg}`, ok: true, error: "" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setTestResult({ ok: false, msg });
      pushLog({ endpoint: "place/text", summary: "Key 连通测试失败", ok: false, error: msg });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="view">
      <div className="page-head">
        <div>
          <h1 className="page-title">设置</h1>
          <p className="page-desc">地图 Key 由你掌控:输入即自动保存到本机,不上传任何服务器</p>
        </div>
        <div className="head-actions">
          <Badge tone="accent">{Icon.check({ size: 13 })} 自动保存</Badge>
        </div>
      </div>

      <div className="settings-grid">
        {/* —— 高德 Key —— */}
        <div className="card">
          <h2 className="setting-title">
            {Icon.target({ size: 17 })} 高德 · Web服务 Key
            <Badge tone="accent">必需</Badge>
          </h2>
          <p className="setting-desc">
            用于 POI 检索、详情与地址定位。请在高德开放平台 → 控制台 → 应用管理 创建「Web服务」类型的 Key。
          </p>
          <div className="setting-stack">
            <Field label="Key" hint="改动即时生效并保存到本机">
              <Input
                className="input key-field"
                type="password"
                value={settings.webKey}
                placeholder="如: a1b2c3d4e5f6…"
                onChange={(e) => updateSettings({ webKey: e.target.value })}
              />
            </Field>
            <div className="row">
              <Btn onClick={() => void runTest()} disabled={testing || !settings.webKey.trim()}>
                {testing ? Icon.spinner({ size: 14, className: "spin" }) : Icon.refresh({ size: 14 })}
                测试连接
              </Btn>
              <Btn variant="ghost" onClick={() => void openUrl("https://console.amap.com/dev/key/app")}>
                {Icon.external({ size: 13 })} 去高德控制台
              </Btn>
            </div>
            {testResult && (
              <div
                className="row"
                style={{
                  padding: "9px 12px",
                  borderRadius: 10,
                  background: testResult.ok ? "var(--accent-soft)" : "var(--danger-soft)",
                  color: testResult.ok ? "var(--accent-2)" : "var(--danger)",
                  fontSize: 12.5,
                  alignItems: "flex-start",
                }}
              >
                {testResult.ok ? Icon.check({ size: 14 }) : Icon.alert({ size: 14 })}
                <span>{testResult.msg}</span>
              </div>
            )}
          </div>
        </div>

        {/* —— JS 地图 —— */}
        <div className="card">
          <h2 className="setting-title">
            {Icon.map({ size: 17 })} 高德 · 地图可视化(JS API)
            <Badge>可选</Badge>
          </h2>
          <p className="setting-desc">
            「Web端(JS API)」类型 Key,用于地图打点 / 框选 / 点选中心点。留空则仅使用列表检索,功能不受影响。
            新版 Key 需同时填安全密钥(securityJsCode)。
          </p>
          <div className="setting-stack">
            <Field label="JS Key">
              <Input
                className="input key-field"
                type="password"
                value={settings.jsKey}
                placeholder="Web端(JS API)类型的 Key"
                onChange={(e) => updateSettings({ jsKey: e.target.value })}
              />
            </Field>
            <Field label="安全密钥 securityJsCode(可选)" hint="高德控制台 → Key 详情中查看">
              <Input
                className="input key-field"
                type="password"
                value={settings.securityJsCode}
                placeholder="留空亦可(旧版 Key)"
                onChange={(e) => updateSettings({ securityJsCode: e.target.value })}
              />
            </Field>
            <div className="field-hint">
              提示:JS Key 若绑定了域名白名单,桌面端环境可能无法加载地图;建议新建一个不绑定域名的 Key 供桌面端使用。
            </div>
          </div>
        </div>

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
            <Badge tone="accent">v0.2.2</Badge>
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
