/** 检索视图 —— 多模式 POI 检索:关键词 / 矩形框选 / 周边,结果管理与导出。 */
import { useMemo, useRef, useState } from "react";
import { DetailModal } from "../components/DetailModal";
import { MapPanel } from "../components/MapPanel";
import { Badge, Btn, Empty, Field, Icon, Input, Select, Switch } from "../components/ui";
import { useApp } from "../lib/appContext";
import { AmapError, geocode, MAX_KEYWORDS, searchPoi, splitKeywords } from "../lib/amap";
import { exportRows, poiColumns } from "../lib/export";
import { fmtRating, telTypeLabel } from "../lib/format";
import type { Bounds, PoiItem, SearchMode, SearchQuery } from "../lib/types";

const MODES: { key: SearchMode; label: string; desc: string }[] = [
  { key: "text", label: "关键词检索", desc: "城市 + 关键词,快速铺开目标区域" },
  { key: "polygon", label: "区域框选", desc: "地图拖拽框选矩形范围,精确圈定商圈" },
  { key: "around", label: "周边检索", desc: "中心点 + 半径,围绕地标/门店扫街" },
];

export function SearchView() {
  const { settings, pushLog, consumeQuota, toast, addToPool, inPool, usage } = useApp();

  const [mode, setMode] = useState<SearchMode>("text");
  const [keywords, setKeywords] = useState("咖啡店");
  const [region, setRegion] = useState("北京市");
  const [cityLimit, setCityLimit] = useState(true);
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [centerAddr, setCenterAddr] = useState("");
  const [center, setCenter] = useState("");
  const [radius, setRadius] = useState(1000);
  const [pageSize, setPageSize] = useState(20);
  const [onlyWithTel, setOnlyWithTel] = useState(true);

  const [results, setResults] = useState<PoiItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailPoi, setDetailPoi] = useState<PoiItem | null>(null);
  const [showMap, setShowMap] = useState(true);
  const [activePoiId, setActivePoiId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const queryRef = useRef<SearchQuery | null>(null);

  const kwCount = splitKeywords(keywords).length;
  const selectedItems = useMemo(() => results.filter((r) => selected.has(r.poiId)), [results, selected]);
  const withTelCount = useMemo(() => results.filter((r) => r.tel).length, [results]);

  function buildQuery(pageNo: number): SearchQuery {
    return {
      mode,
      keywords,
      region,
      cityLimit,
      bounds,
      center,
      radius,
      page: pageNo,
      pageSize,
      onlyWithTel,
    };
  }

  async function runSearch(pageNo: number) {
    if (!settings.webKey) {
      toast("请先在「设置」中填写高德 Web服务 Key", "error");
      return;
    }
    if (usage >= settings.dailyLimit) {
      toast(`今日 API 配额已用完(${settings.dailyLimit} 次),请在「设置」中调整上限或明日再试`, "error");
      return;
    }
    const q = buildQuery(pageNo);
    setLoading(true);
    try {
      // 周边模式:中心点未定位时,先对地址/地标做地理编码
      if (q.mode === "around" && !q.center) {
        if (!centerAddr.trim()) throw new AmapError("请填写中心点地址/地标,或直接在地图上点选中心点");
        const loc = await geocode(centerAddr.trim(), settings.webKey, region);
        setCenter(loc);
        q.center = loc;
      }

      const resp = await searchPoi(q, settings.webKey);
      queryRef.current = q;
      setResults(resp.items);
      setTotal(resp.total);
      setPage(pageNo);
      setSearched(true);
      setSelected(new Set());
      setActivePoiId(null);

      // 配额记账(每个关键词计 1 次调用)
      for (const _kw of resp.keywords) consumeQuota();

      pushLog({
        endpoint: q.mode === "text" ? "place/text" : q.mode === "polygon" ? "place/polygon" : "place/around",
        summary: `检索[${resp.keywords.join("+")}] 命中${resp.total}条/本页${resp.items.length}条`,
        ok: true,
        error: "",
      });

      if (!resp.items.length) {
        toast("本页没有匹配结果,可换关键词或扩大范围", "info");
      } else {
        toast(`检索完成:本页 ${resp.items.length} 条`, "success");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      pushLog({
        endpoint: `place/${q.mode === "text" ? "text" : q.mode}`,
        summary: `检索[${keywords}] 失败`,
        ok: false,
        error: msg,
      });
      toast(msg, "error");
    } finally {
      setLoading(false);
    }
  }

  function toggleSelect(poiId: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(poiId)) next.delete(poiId);
      else next.add(poiId);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((s) => (s.size === results.length && results.length > 0 ? new Set() : new Set(results.map((r) => r.poiId))));
  }

  async function handleExport(onlySelected: boolean) {
    const rows = onlySelected ? selectedItems : results;
    if (!rows.length) {
      toast(onlySelected ? "请先勾选要导出的商户" : "当前没有可导出的结果", "error");
      return;
    }
    setExporting(true);
    try {
      const ok = await exportRows(rows, poiColumns<PoiItem>(), "xlsx", "商户检索结果");
      if (ok) {
        toast(`已导出 ${rows.length} 条商户数据`, "success");
        pushLog({ endpoint: "export", summary: `导出商户 ${rows.length} 条(xlsx)`, ok: true, error: "" });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast(msg, "error");
      pushLog({ endpoint: "export", summary: "导出失败", ok: false, error: msg });
    } finally {
      setExporting(false);
    }
  }

  async function handleExportCsv() {
    const rows = selectedItems.length ? selectedItems : results;
    if (!rows.length) {
      toast("当前没有可导出的结果", "error");
      return;
    }
    try {
      const ok = await exportRows(rows, poiColumns<PoiItem>(), "csv", "商户检索结果");
      if (ok) toast(`已导出 ${rows.length} 条(CSV)`, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "error");
    }
  }

  function addSelectedToPool() {
    const rows = selectedItems.length ? selectedItems : [];
    if (!rows.length) {
      toast("请先勾选要收藏的商户", "error");
      return;
    }
    const added = addToPool(rows);
    toast(added ? `已加入客户池 ${added} 家` : "所选商户均已在客户池中", added ? "success" : "info");
  }

  function nextPage() {
    const p = page + 1;
    void runSearch(p);
  }

  function prevPage() {
    if (page <= 1) return;
    void runSearch(page - 1);
  }

  return (
    <div className="view">
      <div className="page-head">
        <div>
          <h1 className="page-title">商户检索</h1>
          <p className="page-desc">
            多关键词 × 多种区域方式,一键触达目标商户 · 单页最多 50 条 · 仅人工发起检索(合规设计)
          </p>
        </div>
        <div className="head-actions">
          <Btn variant="ghost" onClick={() => setShowMap((v) => !v)}>
            {Icon.map({ size: 15 })}
            {showMap ? "隐藏地图" : "显示地图"}
          </Btn>
          <Btn variant="primary" onClick={() => void runSearch(1)} disabled={loading}>
            {loading ? Icon.spinner({ size: 15, className: "spin" }) : Icon.search({ size: 15 })}
            {loading ? "检索中…" : "开始检索"}
          </Btn>
        </div>
      </div>

      {/* —— 检索工具栏 —— */}
      <div className="card card-pad search-bar">
        <div className="segmented" role="tablist">
          {MODES.map((m) => (
            <button
              key={m.key}
              role="tab"
              aria-selected={mode === m.key}
              className={mode === m.key ? "active" : ""}
              onClick={() => setMode(m.key)}
              title={m.desc}
            >
              {m.key === "text" ? Icon.layers({ size: 14 }) : m.key === "polygon" ? Icon.map({ size: 14 }) : Icon.target({ size: 14 })}
              {m.label}
            </button>
          ))}
        </div>

        <div className="search-row">
          <Field label="关键词(最多 3 个,逗号分隔)" hint={kwCount > 1 ? `将并集合并 ${kwCount} 组结果` : undefined}>
            <Input
              value={keywords}
              placeholder="如:咖啡店,奶茶,烘焙"
              onChange={(e) => setKeywords(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void runSearch(1)}
            />
          </Field>

          {mode === "text" && (
            <>
              <Field label="城市 / 区域(adcode 亦可)">
                <Input
                  value={region}
                  placeholder="如:保定市 / 130600"
                  onChange={(e) => setRegion(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void runSearch(1)}
                />
              </Field>
              <div className="field" style={{ flex: "0 0 auto", minWidth: 120 }}>
                <span className="field-label">限定城市</span>
                <div className="switch-row" style={{ height: 34 }}>
                  <Switch on={cityLimit} onChange={setCityLimit} label="citylimit" />
                  <span>{cityLimit ? "已限定" : "不限"}</span>
                </div>
              </div>
            </>
          )}

          {mode === "polygon" && (
            <>
              <div className="bounds-grid">
                <Field label="西经度">
                  <Input
                    className="input key-field"
                    value={bounds ? String(bounds.west) : ""}
                    placeholder="116.30"
                    onChange={(e) => setBounds((b) => ({ west: num(e.target.value, b?.west), south: b?.south ?? 0, east: b?.east ?? 0, north: b?.north ?? 0 }))}
                  />
                </Field>
                <Field label="南纬度">
                  <Input
                    value={bounds ? String(bounds.south) : ""}
                    placeholder="39.90"
                    onChange={(e) => setBounds((b) => ({ west: b?.west ?? 0, south: num(e.target.value, b?.south), east: b?.east ?? 0, north: b?.north ?? 0 }))}
                  />
                </Field>
                <Field label="东经度">
                  <Input
                    value={bounds ? String(bounds.east) : ""}
                    placeholder="116.40"
                    onChange={(e) => setBounds((b) => ({ west: b?.west ?? 0, south: b?.south ?? 0, east: num(e.target.value, b?.east), north: b?.north ?? 0 }))}
                  />
                </Field>
                <Field label="北纬度">
                  <Input
                    value={bounds ? String(bounds.north) : ""}
                    placeholder="39.95"
                    onChange={(e) => setBounds((b) => ({ west: b?.west ?? 0, south: b?.south ?? 0, east: b?.east ?? 0, north: num(e.target.value, b?.north) }))}
                  />
                </Field>
              </div>
              <Btn onClick={() => setShowMap(true)} style={{ alignSelf: "flex-end" }}>
                {Icon.map({ size: 14 })} 地图框选
              </Btn>
            </>
          )}

          {mode === "around" && (
            <>
              <Field label="中心点(地址/地标)" hint={center ? `已定位:${center}` : "回车定位,或在地图上点选"}>
                <Input
                  value={centerAddr}
                  placeholder="如:北京西站 / 人民广场"
                  onChange={(e) => {
                    setCenterAddr(e.target.value);
                    setCenter("");
                  }}
                  onKeyDown={(e) => e.key === "Enter" && void runSearch(1)}
                />
              </Field>
              <Field label="半径(米)" hint="100 ~ 50000">
                <Select value={String(radius)} onChange={(e) => setRadius(Number(e.target.value))}>
                  {[300, 500, 1000, 2000, 3000, 5000, 10000].map((r) => (
                    <option key={r} value={r}>
                      {r >= 1000 ? `${r / 1000} 公里` : `${r} 米`}
                    </option>
                  ))}
                </Select>
              </Field>
            </>
          )}

          <Field label="每页条数">
            <Select value={String(pageSize)} onChange={(e) => setPageSize(Number(e.target.value))}>
              {[10, 20, 30, 50].map((n) => (
                <option key={n} value={n}>
                  {n} 条
                </option>
              ))}
            </Select>
          </Field>

          <div className="field" style={{ flex: "0 0 auto", minWidth: 118 }}>
            <span className="field-label">仅看有电话</span>
            <div className="switch-row" style={{ height: 34 }}>
              <Switch on={onlyWithTel} onChange={setOnlyWithTel} label="仅保留有电话的商户" />
              <span>{onlyWithTel ? "开启" : "关闭"}</span>
            </div>
          </div>
        </div>

        {mode !== "text" && (
          <div className="field-hint">
            {mode === "polygon"
              ? "提示:可在右侧地图上点击「框选范围」后拖拽鼠标圈定矩形商圈,也可手动填写四至经纬度。"
              : "提示:中心点支持地址定位与地图点选;地图未启用时请手动输入经纬度(经度,纬度)。"}
            {keywords && (
              <span>
                {" "}
                · 关键词 <b>{splitKeywords(keywords).slice(0, MAX_KEYWORDS).join(" / ")}</b>
              </span>
            )}
          </div>
        )}
      </div>

      {/* —— 统计 —— */}
      {searched && (
        <div className="stats">
          <div className="stat">
            <div className="stat-value">
              {total}
              <small>条</small>
            </div>
            <div className="stat-label">检索命中</div>
          </div>
          <div className="stat">
            <div className="stat-value">
              {results.length}
              <small>本页</small>
            </div>
            <div className="stat-label">当前展示</div>
          </div>
          <div className="stat">
            <div className="stat-value">
              {withTelCount}
              <small>条</small>
            </div>
            <div className="stat-label">含联系电话</div>
          </div>
          <div className="stat">
            <div className="stat-value">
              {selected.size}
              <small>已勾选</small>
            </div>
            <div className="stat-label">待处理商户</div>
          </div>
        </div>
      )}

      {/* —— 工作区 —— */}
      <div className="workspace">
        <div className="table-wrap">
          {!searched ? (
            <Empty
              icon={Icon.search({ size: 26 })}
              title="开始你的第一次商户检索"
              desc="输入关键词与区域,快速拉取门店名称、地址与联系电话。检索需人工发起,单页最多 50 条。"
              action={
                <Btn variant="primary" onClick={() => void runSearch(1)} disabled={loading}>
                  {Icon.search({ size: 14 })} 立即检索
                </Btn>
              }
            />
          ) : results.length === 0 ? (
            <Empty
              icon={Icon.building({ size: 26 })}
              title="本页没有结果"
              desc="试试更换关键词、扩大检索半径,或取消「仅看有电话」筛选。"
            />
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th style={{ width: 38 }}>
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={results.length > 0 && selected.size === results.length}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th>商户</th>
                  <th>地址</th>
                  <th>电话</th>
                  <th>类型</th>
                  <th style={{ width: 70 }}>评分</th>
                  <th style={{ width: 110 }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr
                    key={r.poiId}
                    className={`${selected.has(r.poiId) ? "selected" : ""} ${activePoiId === r.poiId ? "active-row" : ""}`}
                    onMouseEnter={() => setActivePoiId(r.poiId)}
                  >
                    <td>
                      <input
                        type="checkbox"
                        className="checkbox"
                        checked={selected.has(r.poiId)}
                        onChange={() => toggleSelect(r.poiId)}
                      />
                    </td>
                    <td>
                      <div className="cell-title">{r.name}</div>
                      <div className="cell-sub">{r.city || "—"}{r.type ? ` · ${r.type.split(";").slice(0, 2).join("/")}` : ""}</div>
                    </td>
                    <td>
                      <div className="cell-sub" style={{ maxWidth: 260, color: "var(--text-1)" }}>{r.address || "—"}</div>
                    </td>
                    <td>
                      {r.tel ? (
                        <div>
                          <div className="cell-mono">{r.tel}</div>
                          <Badge tone={r.telType === "mobile" ? "accent" : "info"}>{telTypeLabel(r.telType)}</Badge>
                        </div>
                      ) : (
                        <span className="muted">无号码</span>
                      )}
                    </td>
                    <td>
                      <Badge tone="default">{r.type ? r.type.split(";")[0] : "商户"}</Badge>
                    </td>
                    <td>
                      <span className="rating">{fmtRating(r.rating)}</span>
                    </td>
                    <td>
                      <div className="row" style={{ gap: 4 }}>
                        <Btn size="sm" variant="ghost" onClick={() => setDetailPoi(r)} title="查看详情">
                          {Icon.info({ size: 14 })}
                        </Btn>
                        <Btn
                          size="sm"
                          variant="ghost"
                          className={`star-btn ${inPool(r.poiId) ? "on" : ""}`}
                          onClick={() => {
                            const added = addToPool([r]);
                            toast(added ? `已收藏「${r.name}」` : "该商户已在客户池中", added ? "success" : "info");
                          }}
                          title={inPool(r.poiId) ? "已在客户池" : "加入客户池"}
                        >
                          {inPool(r.poiId) ? Icon.starFill({ size: 15 }) : Icon.star({ size: 15 })}
                        </Btn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <MapPanel
          collapsed={!showMap}
          onToggle={() => setShowMap(false)}
          mode={mode}
          results={results}
          bounds={bounds}
          onBoundsChange={setBounds}
          center={center}
          onCenterChange={(loc) => {
            setCenter(loc);
            const [lng, lat] = loc.split(",");
            setCenterAddr(`地图选点(${Number(lng).toFixed(4)}, ${Number(lat).toFixed(4)})`);
          }}
          activePoiId={activePoiId}
          onPoiClick={(id) => setActivePoiId(id)}
        />
      </div>

      {/* —— 底部操作条 —— */}
      <div className="action-bar">
        <span className="sel-count">
          已选 <b>{selected.size}</b> / {results.length} 条
        </span>
        <Btn size="sm" variant="ghost" onClick={toggleSelectAll} disabled={!results.length}>
          {selected.size === results.length && results.length ? "取消全选" : "全选本页"}
        </Btn>
        <div className="spacer" />
        <Btn size="sm" onClick={addSelectedToPool} disabled={!selectedItems.length}>
          {Icon.star({ size: 14 })} 收藏到客户池
        </Btn>
        <Btn size="sm" variant="ghost" onClick={() => void handleExportCsv()} disabled={!results.length}>
          {Icon.download({ size: 14 })} 导出 CSV
        </Btn>
        <Btn size="sm" variant="primary" onClick={() => void handleExport(true)} disabled={!selectedItems.length || exporting}>
          {Icon.download({ size: 14 })} 导出选中 Excel
        </Btn>
        <Btn size="sm" onClick={() => void handleExport(false)} disabled={!results.length || exporting}>
          {Icon.chart({ size: 14 })} 导出全部
        </Btn>
        <Btn size="sm" variant="ghost" onClick={prevPage} disabled={loading || page <= 1}>
          {Icon.chevronL({ size: 14 })} 上一页
        </Btn>
        <span className="sel-count">第 {page} 页</span>
        <Btn size="sm" variant="ghost" onClick={nextPage} disabled={loading || results.length < pageSize}>
          下一页 {Icon.chevronR({ size: 14 })}
        </Btn>
      </div>

      {detailPoi && (
        <DetailModal
          poi={detailPoi}
          webKey={settings.webKey}
          inPool={inPool(detailPoi.poiId)}
          onAddPool={(item) => {
            const added = addToPool([item]);
            toast(added ? `已收藏「${item.name}」` : "该商户已在客户池中", added ? "success" : "info");
          }}
          onClose={() => setDetailPoi(null)}
          onLog={(summary, ok, error) => pushLog({ endpoint: "place/detail", summary, ok, error: error || "" })}
        />
      )}
    </div>
  );
}

function num(v: string, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
