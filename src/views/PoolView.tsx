/** 客户池 —— 已收藏商户的跟进管理:状态流转、备注、全字段筛选、导出。 */
import { useMemo, useState } from "react";
import { Badge, Btn, Empty, Field, Icon, Input, Select } from "../components/ui";
import { useApp } from "../lib/appContext";
import { exportRows, poolColumns } from "../lib/export";
import { fmtCityArea, fmtLocation, fmtRating, fmtTime, telTypeLabel } from "../lib/format";
import { POOL_STATUSES, type PoolStatus } from "../lib/types";

type TelFilter = "" | "any" | "none" | "mobile" | "landline";
type RatingFilter = "" | "rated" | "unrated" | "ge4" | "ge3";

export function PoolView() {
  const { pool, updatePoolItem, removeFromPool, clearPool, toast } = useApp();
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<PoolStatus | "">("");
  const [cityFilter, setCityFilter] = useState("");
  const [districtFilter, setDistrictFilter] = useState("");
  const [telFilter, setTelFilter] = useState<TelFilter>("");
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>("");
  const [sourceFilter, setSourceFilter] = useState("");

  const cityOptions = useMemo(() => uniq(pool.map((p) => p.city)), [pool]);
  const districtOptions = useMemo(() => {
    const base = cityFilter ? pool.filter((p) => p.city === cityFilter) : pool;
    return uniq(base.map((p) => p.district));
  }, [pool, cityFilter]);
  const sourceOptions = useMemo(() => uniq(pool.map((p) => p.source)), [pool]);

  const filtered = useMemo(() => {
    return pool.filter((p) => {
      if (statusFilter && p.status !== statusFilter) return false;
      if (cityFilter && p.city !== cityFilter) return false;
      if (districtFilter && p.district !== districtFilter) return false;
      if (sourceFilter && p.source !== sourceFilter) return false;
      if (telFilter === "any" && !p.tel) return false;
      if (telFilter === "none" && p.tel) return false;
      if (telFilter === "mobile" && p.telType !== "mobile") return false;
      if (telFilter === "landline" && p.telType !== "landline") return false;
      if (ratingFilter === "rated" && !(p.rating > 0)) return false;
      if (ratingFilter === "unrated" && p.rating > 0) return false;
      if (ratingFilter === "ge4" && !(p.rating >= 4)) return false;
      if (ratingFilter === "ge3" && !(p.rating >= 3)) return false;
      if (keyword) {
        const kw = keyword.toLowerCase();
        return [p.name, p.address, p.tel, p.note, p.poiId, p.type, p.city, p.district, p.adcode, sourceLabel(p.source)]
          .join(" ")
          .toLowerCase()
          .includes(kw);
      }
      return true;
    });
  }, [pool, keyword, statusFilter, cityFilter, districtFilter, telFilter, ratingFilter, sourceFilter]);

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
            <Field label="搜索(店名 / 地址 / 电话 / 备注 / ID / 类型 / 区域)">
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
            <Field label="城市">
              <Select value={cityFilter} onChange={(e) => { setCityFilter(e.target.value); setDistrictFilter(""); }}>
                <option value="">全部城市</option>
                {cityOptions.map((c) => (
                  <option key={c} value={c}>{c || "未知城市"}</option>
                ))}
              </Select>
            </Field>
            <Field label="区县">
              <Select value={districtFilter} onChange={(e) => setDistrictFilter(e.target.value)}>
                <option value="">全部区县</option>
                {districtOptions.map((d) => (
                  <option key={d} value={d}>{d || "未知区县"}</option>
                ))}
              </Select>
            </Field>
            <Field label="电话">
              <Select value={telFilter} onChange={(e) => setTelFilter(e.target.value as TelFilter)}>
                <option value="">全部</option>
                <option value="any">有电话</option>
                <option value="none">无电话</option>
                <option value="mobile">手机</option>
                <option value="landline">座机</option>
              </Select>
            </Field>
            <Field label="评分">
              <Select value={ratingFilter} onChange={(e) => setRatingFilter(e.target.value as RatingFilter)}>
                <option value="">全部</option>
                <option value="rated">有评分</option>
                <option value="unrated">无评分</option>
                <option value="ge4">≥ 4.0</option>
                <option value="ge3">≥ 3.0</option>
              </Select>
            </Field>
            <Field label="来源">
              <Select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
                <option value="">全部来源</option>
                {sourceOptions.map((s) => (
                  <option key={s} value={s}>{sourceLabel(s)}</option>
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
          <Empty icon={Icon.search({ size: 26 })} title="没有匹配的商户" desc="换一个关键词或筛选条件试试。" />
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>商户</th>
                <th style={{ width: 170 }}>区域</th>
                <th style={{ width: 130 }}>电话</th>
                <th style={{ width: 62 }}>评分</th>
                <th style={{ width: 110 }}>跟进状态</th>
                <th style={{ width: 200 }}>备注</th>
                <th style={{ width: 122 }}>收藏时间</th>
                <th style={{ width: 64 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.poiId}>
                  <td>
                    <div className="cell-title">{p.name}</div>
                    <div className="cell-sub" style={{ maxWidth: 320, color: "var(--text-1)" }}>{p.address || "—"}</div>
                    <div className="cell-sub" style={{ maxWidth: 320 }} title={p.type}>
                      {p.poiId} · {p.type ? p.type.split(";")[0] : "—"} · {sourceLabel(p.source)}
                    </div>
                  </td>
                  <td>
                    <div className="cell-sub" style={{ color: "var(--text-1)" }}>
                      {fmtCityArea(p.city, p.district, p.adcode)}
                    </div>
                    <div className="cell-mono cell-sub" style={{ maxWidth: 160 }} title={p.location}>
                      {fmtLocation(p.location)}
                    </div>
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
                  <td>{p.rating > 0 ? <span className="rating">{fmtRating(p.rating)}</span> : <span className="muted">—</span>}</td>
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

function uniq(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh"));
}

function sourceLabel(s: string): string {
  return s === "amap" ? "高德地图" : s || "未知";
}

function avgRating(ratings: number[]): string {
  const valid = ratings.filter((r) => r > 0);
  if (!valid.length) return "—";
  return (valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(1);
}
