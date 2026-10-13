/** 客户池 —— 已收藏商户的跟进管理:状态流转、备注、导出。 */
import { useMemo, useState } from "react";
import { Badge, Btn, Empty, Field, Icon, Input, Select } from "../components/ui";
import { useApp } from "../lib/appContext";
import { exportRows, poolColumns } from "../lib/export";
import { fmtTime, telTypeLabel } from "../lib/format";
import { POOL_STATUSES, type PoolStatus } from "../lib/types";

export function PoolView() {
  const { pool, updatePoolItem, removeFromPool, clearPool, toast } = useApp();
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<PoolStatus | "">("");

  const filtered = useMemo(() => {
    return pool.filter((p) => {
      if (statusFilter && p.status !== statusFilter) return false;
      if (keyword) {
        const kw = keyword.toLowerCase();
        return (
          p.name.toLowerCase().includes(kw) ||
          p.address.toLowerCase().includes(kw) ||
          p.tel.includes(kw) ||
          p.note.toLowerCase().includes(kw)
        );
      }
      return true;
    });
  }, [pool, keyword, statusFilter]);

  const statusCount = useMemo(() => {
    const m = new Map<PoolStatus, number>();
    for (const p of pool) m.set(p.status, (m.get(p.status) || 0) + 1);
    return m;
  }, [pool]);

  async function handleExport() {
    const rows = filtered.length ? filtered : pool;
    if (!rows.length) {
      toast("客户池为空", "error");
      return;
    }
    try {
      const ok = await exportRows(rows, poolColumns(), "xlsx", "客户池");
      if (ok) {
        toast(`已导出 ${rows.length} 家商户`, "success");
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "error");
    }
  }

  return (
    <div className="view">
      <div className="page-head">
        <div>
          <h1 className="page-title">客户池</h1>
          <p className="page-desc">收藏的商户在这里跟进沉淀:标记状态、写备注,随时导出拜访清单</p>
        </div>
        <div className="head-actions">
          <Btn variant="ghost" onClick={() => void handleExport()}>
            {Icon.download({ size: 15 })} 导出客户池
          </Btn>
          <Btn
            variant="danger"
            disabled={!pool.length}
            onClick={() => {
              if (confirm(`确认清空客户池全部 ${pool.length} 条记录?此操作不可恢复。`)) {
                clearPool();
                toast("客户池已清空", "success");
              }
            }}
          >
            {Icon.trash({ size: 15 })} 清空
          </Btn>
        </div>
      </div>

      {pool.length > 0 && (
        <div className="stats">
          <div className="stat">
            <div className="stat-value">{pool.length}<small>家</small></div>
            <div className="stat-label">客户池总量</div>
          </div>
          {POOL_STATUSES.map((s) => (
            <div className="stat" key={s}>
              <div className="stat-value">{statusCount.get(s) || 0}<small>家</small></div>
              <div className="stat-label">{s}</div>
            </div>
          ))}
        </div>
      )}

      {pool.length > 0 && (
        <div className="card card-pad">
          <div className="search-row" style={{ alignItems: "flex-end" }}>
            <Field label="搜索(店名 / 地址 / 电话 / 备注)">
              <Input value={keyword} placeholder="输入关键词筛选…" onChange={(e) => setKeyword(e.target.value)} />
            </Field>
            <Field label="跟进状态">
              <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as PoolStatus | "")}>
                <option value="">全部状态</option>
                {POOL_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </Field>
            <Badge tone="accent">{filtered.length} 条匹配</Badge>
          </div>
        </div>
      )}

      <div className="table-wrap">
        {pool.length === 0 ? (
          <Empty
            icon={Icon.pool({ size: 26 })}
            title="客户池还是空的"
            desc="在「商户检索」中点击星标收藏商户,或勾选后批量收藏到客户池。"
          />
        ) : filtered.length === 0 ? (
          <Empty icon={Icon.search({ size: 26 })} title="没有匹配的商户" desc="换一个关键词或状态筛选试试。" />
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>商户</th>
                <th>电话</th>
                <th style={{ width: 120 }}>跟进状态</th>
                <th style={{ width: 220 }}>备注</th>
                <th style={{ width: 130 }}>收藏时间</th>
                <th style={{ width: 70 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.poiId}>
                  <td>
                    <div className="cell-title">{p.name}</div>
                    <div className="cell-sub" style={{ maxWidth: 320, color: "var(--text-1)" }}>{p.address || "—"}</div>
                  </td>
                  <td>
                    {p.tel ? (
                      <div>
                        <div className="cell-mono">{p.tel}</div>
                        <Badge tone={p.telType === "mobile" ? "accent" : "info"}>{telTypeLabel(p.telType)}</Badge>
                      </div>
                    ) : (
                      <span className="muted">无号码</span>
                    )}
                  </td>
                  <td>
                    <Select
                      value={p.status}
                      onChange={(e) => updatePoolItem(p.poiId, { status: e.target.value as PoolStatus })}
                      style={{ padding: "5px 26px 5px 9px", fontSize: 12 }}
                    >
                      {POOL_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td>
                    <Input
                      value={p.note}
                      placeholder="写点备注…"
                      style={{ padding: "5px 9px", fontSize: 12 }}
                      onChange={(e) => updatePoolItem(p.poiId, { note: e.target.value })}
                    />
                  </td>
                  <td className="cell-sub">{fmtTime(p.addedAt)}</td>
                  <td>
                    <Btn
                      size="sm"
                      variant="ghost"
                      className="btn-icon"
                      title="移出客户池"
                      onClick={() => {
                        removeFromPool(p.poiId);
                        toast(`已移出「${p.name}」`, "info");
                      }}
                    >
                      {Icon.trash({ size: 14 })}
                    </Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pool.length > 0 && (
        <div className="action-bar">
          <span className="sel-count">
            共 <b>{pool.length}</b> 家商户 · 含电话 {pool.filter((p) => p.tel).length} 家 · 有意向及以上{" "}
            {pool.filter((p) => p.status === "有意向" || p.status === "已合作").length} 家
          </span>
          <div className="spacer" />
          <Badge tone="amber">平均评分 {avgRating(pool.map((p) => p.rating))}</Badge>
          <Btn size="sm" variant="primary" onClick={() => void handleExport()}>
            {Icon.download({ size: 14 })} 导出拜访清单
          </Btn>
        </div>
      )}
    </div>
  );
}

function avgRating(ratings: number[]): string {
  const valid = ratings.filter((r) => r > 0);
  if (!valid.length) return "—";
  return (valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(1);
}
