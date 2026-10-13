/** 调用日志 —— 每一次地图 API 调用都留痕(合规要求:可查询、可追溯)。 */
import { useState } from "react";
import { Badge, Btn, Empty, Field, Icon, Select } from "../components/ui";
import { useApp } from "../lib/appContext";
import { fmtTime } from "../lib/format";

export function LogsView() {
  const { logs, clearLogs, usage, settings, resetUsage, toast } = useApp();
  const [filter, setFilter] = useState<"all" | "ok" | "fail">("all");

  const filtered = logs
    .filter((l) => (filter === "all" ? true : filter === "ok" ? l.ok : !l.ok))
    .slice()
    .reverse();

  const okCount = logs.filter((l) => l.ok).length;

  return (
    <div className="view">
      <div className="page-head">
        <div>
          <h1 className="page-title">调用日志</h1>
          <p className="page-desc">地图 API 调用全量留痕:时间、端点、结果与报错,合规可追溯</p>
        </div>
        <div className="head-actions">
          <Btn
            variant="ghost"
            disabled={!logs.length}
            onClick={() => {
              clearLogs();
              toast("日志已清空", "success");
            }}
          >
            {Icon.trash({ size: 15 })} 清空日志
          </Btn>
        </div>
      </div>

      <div className="stats">
        <div className="stat">
          <div className="stat-value">{logs.length}<small>次</small></div>
          <div className="stat-label">累计调用(本地留存上限 500 条)</div>
        </div>
        <div className="stat">
          <div className="stat-value">{okCount}<small>次</small></div>
          <div className="stat-label">调用成功</div>
        </div>
        <div className="stat">
          <div className="stat-value">{logs.length - okCount}<small>次</small></div>
          <div className="stat-label">调用失败</div>
        </div>
        <div className="stat">
          <div className="stat-value">
            {usage}
            <small>/ {settings.dailyLimit}</small>
          </div>
          <div className="stat-label">
            今日配额 ·{" "}
            <a
              href="#reset"
              style={{ color: "var(--accent-2)" }}
              onClick={(e) => {
                e.preventDefault();
                resetUsage();
                toast("今日配额计数已重置", "success");
              }}
            >
              重置
            </a>
          </div>
        </div>
      </div>

      <div className="card card-pad">
        <div className="search-row" style={{ alignItems: "flex-end" }}>
          <Field label="筛选">
            <Select value={filter} onChange={(e) => setFilter(e.target.value as "all" | "ok" | "fail")}>
              <option value="all">全部记录</option>
              <option value="ok">仅成功</option>
              <option value="fail">仅失败</option>
            </Select>
          </Field>
          <Badge tone="accent">{filtered.length} 条记录</Badge>
        </div>
      </div>

      <div className="table-wrap">
        {filtered.length === 0 ? (
          <Empty
            icon={Icon.log({ size: 26 })}
            title="暂无调用日志"
            desc="每次检索、详情查询与导出都会自动记录在这里。"
          />
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th style={{ width: 150 }}>时间</th>
                <th style={{ width: 120 }}>端点</th>
                <th>结果摘要</th>
                <th style={{ width: 80 }}>状态</th>
                <th>错误信息</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.id}>
                  <td className="cell-mono">{fmtTime(l.time)}</td>
                  <td>
                    <Badge tone={l.endpoint.startsWith("place") ? "info" : l.endpoint === "export" ? "violet" : "default"}>
                      {l.endpoint}
                    </Badge>
                  </td>
                  <td style={{ color: "var(--text-0)" }}>{l.summary}</td>
                  <td>
                    {l.ok ? <span className="log-ok">成功</span> : <span className="log-fail">失败</span>}
                  </td>
                  <td className="cell-sub" style={{ maxWidth: 320, color: "var(--danger)" }}>
                    {l.error || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
