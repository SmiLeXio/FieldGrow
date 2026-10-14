/** 检索视图 —— 地图为主体:检索栏/商户列表/工具条/门店卡全部悬浮在地图之上。
 *
 * 检索为「多页累加」模型:每次抓取 1~5 页,支持加载更多;框选模式可网格深扫,
 * 把一片区域拆成小格逐格检索,突破单次检索的截断上限。
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { DetailModal } from "../components/DetailModal";
import { MapCanvas } from "../components/MapPanel";
import { Badge, Btn, Empty, Field, Icon, Input, Select, Switch } from "../components/ui";
import { useApp } from "../lib/appContext";
import {
  circleBounds,
  fetchDistricts,
  geocode,
  searchPoiPages,
  splitBoundsGrid,
  splitKeywords,
  withinRadius,
  type District,
  type SearchPagesResult,
} from "../lib/amap";
import { exportRows, poiColumns } from "../lib/export";
import { fmtCityArea, fmtRating, telTypeLabel } from "../lib/format";
import type { Bounds, PoiItem, SearchMode, SearchQuery } from "../lib/types";

const MODES: { key: SearchMode; label: string }[] = [
  { key: "text", label: "关键词" },
  { key: "polygon", label: "区域框选" },
  { key: "around", label: "周边" },
];

export function SearchView({ onGoSettings }: { onGoSettings?: () => void }) {
  const { settings, activeWebKey, pushLog, consumeQuota, toast, addToPool, inPool, usage } = useApp();

  /* —— 检索参数 —— */
  const [mode, setMode] = useState<SearchMode>("text");
  const [keywords, setKeywords] = useState("");
  const [region, setRegion] = useState("北京市");
  const [cityLimit, setCityLimit] = useState(true);
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [centerAddr, setCenterAddr] = useState("");
  const [center, setCenter] = useState("");
  const [radius, setRadius] = useState(1000);
  const [pageSize, setPageSize] = useState(20);
  const [fetchPages, setFetchPages] = useState(2);
  const [gridN, setGridN] = useState(1);
  const [onlyWithTel, setOnlyWithTel] = useState(true);
  const [districts, setDistricts] = useState<District[]>([]);
  const [districtAdcode, setDistrictAdcode] = useState("");

  /* —— 结果状态 —— */
  const [results, setResults] = useState<PoiItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loadedPages, setLoadedPages] = useState(0);
  const [exhausted, setExhausted] = useState(false);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [focusPoi, setFocusPoi] = useState<PoiItem | null>(null);
  const [detailPoi, setDetailPoi] = useState<PoiItem | null>(null);

  /* —— 地图与悬浮层 —— */
  const [showList, setShowList] = useState(true);
  const [drawing, setDrawing] = useState(false);
  const [drawReq, setDrawReq] = useState(0);
  const [clearReq, setClearReq] = useState(0);
  const [fitReq, setFitReq] = useState(0);
  const [viewReq, setViewReq] = useState({ loc: "", zoom: 11, n: 0 });
  const [searchH, setSearchH] = useState(96);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = searchRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSearchH(el.offsetHeight + 24));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* —— 区县列表:随城市输入自动加载;地图自动跳转到城市中心 —— */
  useEffect(() => {
    if (!activeWebKey || !region.trim()) {
      setDistricts([]);
      return;
    }
    let alive = true;
    const timer = window.setTimeout(() => {
      fetchDistricts(region.trim(), activeWebKey)
        .then((q) => {
          if (!alive) return;
          setDistricts(q.districts);
          // 原选中的区县不在新列表里(换了城市)则清空
          if (districtAdcode && !q.districts.some((d) => d.adcode === districtAdcode)) {
            setDistrictAdcode("");
          }
          // 地图自动跳转到城市中心
          if (q.center) setViewReq((v) => ({ loc: q.center, zoom: 11, n: v.n + 1 }));
        })
        .catch(() => alive && setDistricts([]));
    }, 500);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region, activeWebKey]);

  const kwCount = splitKeywords(keywords).length;
  const selectedItems = useMemo(() => results.filter((r) => selected.has(r.poiId)), [results, selected]);
  const withTelCount = useMemo(() => results.filter((r) => r.tel).length, [results]);
  const gridCost = gridN > 1 ? gridN * gridN * Math.max(kwCount, 1) : 0;

  /* —————— 检索(多页累加 / 网格深扫)— —————— */
  async function doSearch(action: "new" | "more") {
    if (!activeWebKey) {
      toast("请先在「设置」中填写高德 Web服务 Key", "error");
      onGoSettings?.();
      return;
    }
    if (usage >= settings.dailyLimit) {
      toast(`今日 API 配额已用完(${settings.dailyLimit} 次),请在「设置」中调整上限或明日再试`, "error");
      return;
    }

    const baseQuery: SearchQuery = {
      mode,
      keywords,
      region: districtAdcode || region,
      cityLimit,
      bounds,
      center,
      radius,
      page: 1,
      pageSize,
      onlyWithTel,
    };

    // 周边模式:未定位中心点则先地理编码
    if (mode === "around" && !center) {
      if (!centerAddr.trim()) {
        toast("请填写中心点地址/地标,或直接在地图上点选中心点", "error");
        return;
      }
    }
    if (mode === "polygon" && !bounds) {
      toast("请先在地图上框选范围(右侧工具条第一个按钮)", "error");
      return;
    }

    const isGrid =
      action === "new" &&
      gridN > 1 &&
      ((mode === "polygon" && !!bounds) || (mode === "around" && !!center));
    if (isGrid) {
      const cost = gridCost * fetchPages;
      const ok = window.confirm(
        `网格深扫:${gridN}×${gridN} = ${gridN * gridN} 个子区域 × ${kwCount} 个关键词\n` +
          `预计消耗约 ${cost} 次配额(今日剩余 ${Math.max(0, settings.dailyLimit - usage)}),是否继续?`,
      );
      if (!ok) return;
    }

    setLoading(true);
    try {
      // 周边模式:必要时定位中心点(深扫需以中心点画圆取外接矩形)
      if (mode === "around" && !baseQuery.center) {
        setLoadingLabel("正在定位中心点");
        const loc = await geocode(centerAddr.trim(), activeWebKey, region);
        setCenter(loc);
        baseQuery.center = loc;
      }

      const merged: PoiItem[] = [];
      const seen = new Set<string>();
      let calls = 0;
      let apiTotal = 0;

      const absorb = (r: SearchPagesResult) => {
        calls += r.calls;
        apiTotal = Math.max(apiTotal, r.total);
        for (const it of r.items) {
          if (seen.has(it.poiId)) continue;
          seen.add(it.poiId);
          merged.push(it);
        }
      };

      if (isGrid) {
        // 框选:按框选矩形切格;周边:按圆形检索区的外接矩形切格
        const scanBounds =
          mode === "around" ? circleBounds(baseQuery.center, radius) : (bounds as Bounds);
        const cells = splitBoundsGrid(scanBounds, gridN);
        for (let i = 0; i < cells.length; i++) {
          setLoadingLabel(`网格深扫 ${i + 1}/${cells.length} 区`);
          const r = await searchPoiPages({ ...baseQuery, mode: "polygon", bounds: cells[i] }, activeWebKey, {
            fromPage: 1,
            pageCount: fetchPages,
          });
          absorb(r);
        }
      } else {
        const fromPage = action === "new" ? 1 : loadedPages + 1;
        for (let p = 0; p < fetchPages; p++) {
          setLoadingLabel(`正在抓取第 ${fromPage + p} 页`);
          const r = await searchPoiPages(baseQuery, activeWebKey, {
            fromPage: fromPage + p,
            pageCount: 1,
          });
          absorb(r);
          if (r.items.length === 0) break;
        }
      }

      // 配额记账
      for (let i = 0; i < calls; i++) consumeQuota();

      // 结果过滤:周边深扫裁剪成真正圆形范围;区县筛选保证行政区划唯一
      let itemsOut = merged;
      if (mode === "around" && isGrid && baseQuery.center) {
        itemsOut = itemsOut.filter((it) => !it.location || withinRadius(baseQuery.center, it.location, radius));
      }
      const districtName = districts.find((d) => d.adcode === districtAdcode)?.name || "";
      if (districtAdcode) {
        itemsOut = itemsOut.filter((it) => it.adcode === districtAdcode);
      }

      // 区域归属以检索筛选的行政区为准,不用商家地址文本解析的结果:
      // 1) 选了区县 → 全部记为该区县(筛选即认定);2) 区县列表按 adcode 校准;3) 最后才回落地址解析
      const dmap = new Map(districts.map((d) => [d.adcode, d.name] as const));
      const searchCity = region.trim() && !/^\d+$/.test(region.trim()) ? region.trim() : "";
      itemsOut = itemsOut.map((it) => ({
        ...it,
        city: it.city || searchCity,
        district: districtName || dmap.get(it.adcode) || it.district,
      }));

      // 合并到结果
      const finalItems =
        action === "more"
          ? (() => {
              const map = new Map(results.map((r) => [r.poiId, r] as const));
              for (const it of itemsOut) map.set(it.poiId, it);
              return [...map.values()];
            })()
          : itemsOut;

      setResults(finalItems);
      setTotal(Math.max(apiTotal, finalItems.length));
      setSearched(true);
      setExhausted(merged.length === 0);
      if (action === "new") {
        setLoadedPages(isGrid ? 1 : fetchPages);
        setSelected(new Set());
        setFocusPoi(null);
      } else {
        setLoadedPages((n) => n + fetchPages);
      }
      setFitReq((n) => n + 1);

      pushLog({
        endpoint: mode === "text" ? "place/text" : mode === "polygon" ? "place/polygon" : "place/around",
        summary:
          (isGrid ? `网格深扫${gridN}×${gridN}` : `检索[${splitKeywords(keywords).join("+")}]`) +
          (districtName ? `[${districtName}]` : "") +
          ` 新增${itemsOut.length}条/累计${finalItems.length}条`,
        ok: true,
        error: "",
      });

      if (!itemsOut.length) {
        toast(
          merged.length && districtAdcode
            ? `接口返回 ${merged.length} 条,但区县筛选后没有匹配(可清除区县筛选再试)`
            : action === "more"
              ? "没有更多结果了(高德对单次检索总量有截断,可试试网格深扫或更细关键词)"
              : "没有匹配结果,可换关键词或扩大范围",
          "info",
        );
      } else {
        toast(`新增 ${itemsOut.length} 条,累计 ${finalItems.length} 条`, "success");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      pushLog({ endpoint: `place/${mode}`, summary: "检索失败", ok: false, error: msg });
      toast(msg, "error");
    } finally {
      setLoading(false);
      setLoadingLabel("");
    }
  }

  /* —————— 选择 / 收藏 / 导出 —————— */
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

  async function handleExport(onlySelected: boolean, fmt: "xlsx" | "csv" = "xlsx") {
    const rows = onlySelected ? selectedItems : results;
    if (!rows.length) {
      toast(onlySelected ? "请先勾选要导出的商户" : "当前没有可导出的结果", "error");
      return;
    }
    try {
      const ok = await exportRows(rows, poiColumns<PoiItem>(), fmt, "商户检索结果");
      if (ok) {
        toast(`已导出 ${rows.length} 条商户数据`, "success");
        pushLog({ endpoint: "export", summary: `导出商户 ${rows.length} 条(${fmt})`, ok: true, error: "" });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast(msg, "error");
      pushLog({ endpoint: "export", summary: "导出失败", ok: false, error: msg });
    }
  }

  function addSelectedToPool(items: PoiItem[]) {
    const added = addToPool(items);
    toast(added ? `已加入客户池 ${added} 家` : "所选商户均已在客户池中", added ? "success" : "info");
  }

  async function copyTel(tel: string) {
    try {
      await navigator.clipboard.writeText(tel);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = tel;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    toast(`已复制电话 ${tel}`, "success");
  }

  return (
    <div className="view" style={{ padding: 14, gap: 0 }}>
      <div className="map-stage">
        {/* —— 地图画布 —— */}
        <MapCanvas
          mode={mode}
          results={results}
          bounds={bounds}
          onBoundsChange={setBounds}
          center={center}
          radius={radius}
          onCenterChange={(loc) => {
            setCenter(loc);
            const [lng, lat] = loc.split(",");
            setCenterAddr(`地图选点(${Number(lng).toFixed(4)}, ${Number(lat).toFixed(4)})`);
          }}
          focusPoiId={focusPoi?.poiId ?? null}
          onPoiClick={(id) => setFocusPoi(results.find((r) => r.poiId === id) ?? null)}
          drawRequest={drawReq}
          clearRectRequest={clearReq}
          fitRequest={fitReq}
          viewRequest={viewReq}
          onDrawStateChange={setDrawing}
        />

        {/* —— 顶部检索栏 —— */}
        <div ref={searchRef} className="float-search glass">
          <div className="segmented">
            {MODES.map((m) => (
              <button key={m.key} className={mode === m.key ? "active" : ""} onClick={() => setMode(m.key)}>
                {m.key === "text" ? Icon.layers({ size: 13 }) : m.key === "polygon" ? Icon.map({ size: 13 }) : Icon.target({ size: 13 })}
                {m.label}
              </button>
            ))}
          </div>

          <div className="field field-grows" style={{ minWidth: 200 }}>
            <span className="field-label">关键词(≤3,逗号分隔)</span>
            <Input
              value={keywords}
              placeholder="如:咖啡店,奶茶,烘焙"
              onChange={(e) => setKeywords(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void doSearch("new")}
            />
          </div>

          <div className="field" style={{ minWidth: 128 }}>
            <span className="field-label">城市 / 区域</span>
            <Input
              value={region}
              placeholder="保定市 / 130600"
              onChange={(e) => setRegion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void doSearch("new")}
            />
          </div>

          <div className="field" style={{ minWidth: 118 }}>
            <span className="field-label">区 / 县{districtAdcode ? " ✓" : ""}</span>
            <Select
              value={districtAdcode}
              disabled={!districts.length}
              onChange={(e) => {
                setDistrictAdcode(e.target.value);
                const d = districts.find((x) => x.adcode === e.target.value);
                // 地图自动跳转到区县中心
                if (d?.center) setViewReq((v) => ({ loc: d.center, zoom: 12, n: v.n + 1 }));
              }}
            >
              <option value="">{districts.length ? "全部区县" : "输入城市后加载"}</option>
              {districts.map((d) => (
                <option key={d.adcode} value={d.adcode}>
                  {d.name}
                </option>
              ))}
            </Select>
          </div>

          {mode === "text" && (
            <div className="field" style={{ width: 96 }}>
              <span className="field-label">限定城市</span>
              <div className="switch-row" style={{ height: 32 }}>
                <Switch on={cityLimit} onChange={setCityLimit} label="citylimit" />
                <span style={{ fontSize: 11 }}>{cityLimit ? "已限定" : "不限"}</span>
              </div>
            </div>
          )}

          {mode === "polygon" && (
            <>
              <div className="mini-bounds">
                <Field label="西经度">
                  <Input
                    className="key-field"
                    value={bounds ? String(bounds.west) : ""}
                    placeholder="116.30"
                    onChange={(e) => setBounds((b) => ({ west: num(e.target.value, b?.west), south: b?.south ?? 0, east: b?.east ?? 0, north: b?.north ?? 0 }))}
                  />
                </Field>
                <Field label="南纬度">
                  <Input
                    className="key-field"
                    value={bounds ? String(bounds.south) : ""}
                    placeholder="39.90"
                    onChange={(e) => setBounds((b) => ({ west: b?.west ?? 0, south: num(e.target.value, b?.south), east: b?.east ?? 0, north: b?.north ?? 0 }))}
                  />
                </Field>
                <Field label="东经度">
                  <Input
                    className="key-field"
                    value={bounds ? String(bounds.east) : ""}
                    placeholder="116.40"
                    onChange={(e) => setBounds((b) => ({ west: b?.west ?? 0, south: b?.south ?? 0, east: num(e.target.value, b?.east), north: b?.north ?? 0 }))}
                  />
                </Field>
                <Field label="北纬度">
                  <Input
                    className="key-field"
                    value={bounds ? String(bounds.north) : ""}
                    placeholder="39.95"
                    onChange={(e) => setBounds((b) => ({ west: b?.west ?? 0, south: b?.south ?? 0, east: b?.east ?? 0, north: num(e.target.value, b?.north) }))}
                  />
                </Field>
              </div>
              <div className="field" style={{ width: 118 }}>
                <span className="field-label">网格深扫</span>
                <Select value={String(gridN)} onChange={(e) => setGridN(Number(e.target.value))}>
                  <option value={1}>关闭</option>
                  <option value={2}>2×2(4格)</option>
                  <option value={3}>3×3(9格)</option>
                </Select>
              </div>
            </>
          )}

          {mode === "around" && (
            <>
              <div className="field" style={{ minWidth: 170 }}>
                <span className="field-label">中心点(地址/地标或地图点选)</span>
                <Input
                  value={centerAddr}
                  placeholder="如:北京西站"
                  onChange={(e) => {
                    setCenterAddr(e.target.value);
                    setCenter("");
                  }}
                  onKeyDown={(e) => e.key === "Enter" && void doSearch("new")}
                />
              </div>
              <div className="field" style={{ width: 100 }}>
                <span className="field-label">半径</span>
                <Select value={String(radius)} onChange={(e) => setRadius(Number(e.target.value))}>
                  {[300, 500, 1000, 2000, 3000, 5000, 10000].map((r) => (
                    <option key={r} value={r}>
                      {r >= 1000 ? `${r / 1000} km` : `${r} m`}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="field" style={{ width: 118 }}>
                <span className="field-label">网格深扫</span>
                <Select value={String(gridN)} onChange={(e) => setGridN(Number(e.target.value))}>
                  <option value={1}>关闭</option>
                  <option value={2}>2×2(4格)</option>
                  <option value={3}>3×3(9格)</option>
                </Select>
              </div>
            </>
          )}

          <div className="field" style={{ width: 104 }} title="每次「开始检索」/「加载更多」连续抓取的页数。单次返回 ≈ 页数 × 每页条数;页数越多越全,消耗配额也越多(每页每个关键词计 1 次)">
            <span className="field-label">每次抓取</span>
            <Select value={String(fetchPages)} onChange={(e) => setFetchPages(Number(e.target.value))}>
              {[1, 2, 3, 5].map((n) => (
                <option key={n} value={n}>
                  {n} 页 ×{pageSize}
                </option>
              ))}
            </Select>
          </div>

          <div className="field" style={{ width: 88 }} title="每页条数,高德上限 50。每页越大,同样的结果量消耗的配额次数越少(每页只算 1 次调用)">
            <span className="field-label">每页</span>
            <Select value={String(pageSize)} onChange={(e) => setPageSize(Number(e.target.value))}>
              {[10, 20, 30, 50].map((n) => (
                <option key={n} value={n}>
                  {n} 条
                </option>
              ))}
            </Select>
          </div>

          <Btn variant="primary" onClick={() => void doSearch("new")} disabled={loading} style={{ height: 32 }}>
            {loading ? Icon.spinner({ size: 14, className: "spin" }) : Icon.search({ size: 14 })}
            {loading ? loadingLabel || "检索中…" : "开始检索"}
          </Btn>
        </div>

        {/* —— 左侧商户列表 —— */}
        {showList && (
          <div className="float-list glass" style={{ top: searchH }}>
            <div className="float-list-head">
              <span className="float-list-title">商户列表</span>
              <Badge tone="accent">{results.length} 家</Badge>
              <div className="spacer" />
              <div className="switch-row" style={{ gap: 6 }}>
                <Switch on={onlyWithTel} onChange={setOnlyWithTel} label="仅看有电话" />
                <span style={{ fontSize: 11 }}>有电话</span>
              </div>
            </div>
            <div className="float-list-body">
              {!searched ? (
                <Empty
                  icon={Icon.search({ size: 22 })}
                  title="开始检索商户"
                  desc="输入关键词与区域,点击「开始检索」。"
                />
              ) : results.length === 0 ? (
                <Empty icon={Icon.building({ size: 22 })} title="本页没有结果" desc="换关键词、扩大范围,或取消「有电话」筛选。" />
              ) : (
                results.map((r) => (
                  <div
                    key={r.poiId}
                    className={`poi-row ${focusPoi?.poiId === r.poiId ? "focused" : ""}`}
                    onClick={() => setFocusPoi(r)}
                  >
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={selected.has(r.poiId)}
                      onChange={() => toggleSelect(r.poiId)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="poi-row-main">
                      <div className="poi-row-name">
                        {r.name}
                        {r.rating > 0 && <span className="rating" style={{ marginLeft: 6, fontSize: 11 }}>{fmtRating(r.rating)}</span>}
                      </div>
                      <div className="poi-row-sub">
                        {r.tel ? <span className="poi-row-tel">{r.tel}</span> : <span style={{ color: "var(--text-3)" }}>无号码</span>}
                        {" · "}
                        {r.address || "地址未知"}
                      </div>
                    </div>
                    <button
                      className={`star-btn ${inPool(r) ? "on" : ""}`}
                      title={inPool(r) ? "已在客户池" : "加入客户池"}
                      onClick={(e) => {
                        e.stopPropagation();
                        addSelectedToPool([r]);
                      }}
                    >
                      {inPool(r) ? Icon.starFill({ size: 14 }) : Icon.star({ size: 14 })}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* —— 右侧工具条 —— */}
        <div className="map-tools" style={{ top: searchH }}>
          {mode === "polygon" && (
            <Btn
              className={`tool-btn glass ${drawing ? "active" : ""}`}
              title={drawing ? "画框中,点击取消" : "拖拽框选矩形范围"}
              onClick={() => {
                if (drawing) setClearReq((n) => n + 1);
                else setDrawReq((n) => n + 1);
              }}
            >
              {Icon.target({ size: 17 })}
            </Btn>
          )}
          {mode === "polygon" && bounds && (
            <Btn className="tool-btn glass" title="清除框选" onClick={() => setClearReq((n) => n + 1)}>
              {Icon.x({ size: 16 })}
            </Btn>
          )}
          <Btn className="tool-btn glass" title="缩放至全部结果" onClick={() => setFitReq((n) => n + 1)}>
            {Icon.layers({ size: 16 })}
          </Btn>
          <Btn className="tool-btn glass" title={showList ? "收起商户列表" : "展开商户列表"} onClick={() => setShowList((v) => !v)}>
            {showList ? Icon.chevronL({ size: 16 }) : Icon.chevronR({ size: 16 })}
          </Btn>
          {mode === "around" && center && (
            <Btn
              className="tool-btn glass"
              title="清除中心点"
              onClick={() => {
                setCenter("");
                setCenterAddr("");
              }}
            >
              {Icon.target({ size: 16 })}
            </Btn>
          )}
        </div>

        {/* —— 门店信息卡(点击地图点位)— — */}
        {focusPoi && (
          <div className="store-card glass">
            <div className="store-card-head">
              <div className="row" style={{ alignItems: "flex-start" }}>
                <h4 className="store-card-name">{focusPoi.name}</h4>
                <div className="spacer" />
                <Btn variant="ghost" size="sm" className="btn-icon" onClick={() => setFocusPoi(null)} title="关闭">
                  {Icon.x({ size: 13 })}
                </Btn>
              </div>
              <div className="row" style={{ marginTop: 4, gap: 6, flexWrap: "wrap" }}>
                <Badge tone="accent">{focusPoi.type ? focusPoi.type.split(";")[0] : "商户"}</Badge>
                {focusPoi.rating > 0 && (
                  <Badge tone="amber">
                    ★ {fmtRating(focusPoi.rating)}
                  </Badge>
                )}
                <Badge tone={focusPoi.telType === "mobile" ? "info" : "default"}>{telTypeLabel(focusPoi.telType)}</Badge>
              </div>
            </div>
            <div className="store-card-body">
              <div className="store-card-row">
                <span className="label">地址</span>
                <span style={{ flex: 1 }}>{focusPoi.address || "—"}</span>
              </div>
              <div className="store-card-row">
                <span className="label">电话</span>
                <span className="mono" style={{ flex: 1, fontSize: 12.5 }}>
                  {focusPoi.tel || "—"}
                </span>
                {focusPoi.tel && (
                  <Btn size="sm" variant="ghost" title="复制电话" onClick={() => void copyTel(focusPoi.tel)}>
                    {Icon.phone({ size: 13 })}
                  </Btn>
                )}
              </div>
              <div className="store-card-row">
                <span className="label">区域</span>
                <span style={{ flex: 1 }}>
                  {fmtCityArea(focusPoi.city, focusPoi.district, focusPoi.adcode)}
                </span>
              </div>
            </div>
            <div className="store-card-actions">
              <Btn size="sm" variant="primary" disabled={inPool(focusPoi)} onClick={() => addSelectedToPool([focusPoi])}>
                {inPool(focusPoi) ? Icon.check({ size: 13 }) : Icon.star({ size: 13 })}
                {inPool(focusPoi) ? "已收藏" : "加入客户池"}
              </Btn>
              <Btn size="sm" onClick={() => setDetailPoi(focusPoi)}>
                {Icon.info({ size: 13 })} 完整详情
              </Btn>
            </div>
          </div>
        )}

        {/* —— 底部操作条 —— */}
        <div className="float-bottom glass">
          <span className="float-stat">
            已加载 <b className="hl">{results.length}</b> / 约 <b>{total || results.length}</b> 条
          </span>
          <span className="float-stat">
            含电话 <b>{withTelCount}</b>
          </span>
          <span className="float-stat">
            已选 <b className="hl">{selected.size}</b>
          </span>
          <Badge tone="accent">{loading ? loadingLabel || "检索中" : `${loadedPages ? `已抓 ${loadedPages} 页` : "待检索"}`}</Badge>

          <div className="spacer" />

          <Btn size="sm" onClick={() => void doSearch("more")} disabled={loading || !searched || exhausted}>
            {Icon.download({ size: 13 })} 加载更多
          </Btn>
          <Btn size="sm" variant="ghost" onClick={toggleSelectAll} disabled={!results.length}>
            {selected.size === results.length && results.length ? "取消全选" : "全选"}
          </Btn>
          <Btn
            size="sm"
            onClick={() => addSelectedToPool(selectedItems)}
            disabled={!selectedItems.length}
          >
            {Icon.star({ size: 13 })} 收藏选中
          </Btn>
          <Btn size="sm" variant="ghost" onClick={() => void handleExport(true, "csv")} disabled={!selectedItems.length}>
            {Icon.download({ size: 13 })} CSV
          </Btn>
          <Btn size="sm" variant="primary" onClick={() => void handleExport(true)} disabled={!selectedItems.length}>
            {Icon.download({ size: 13 })} 导出选中
          </Btn>
          <Btn size="sm" onClick={() => void handleExport(false)} disabled={!results.length}>
            {Icon.chart({ size: 13 })} 导出全部
          </Btn>
        </div>

        {/* —— 未配置 Key 提示 —— */}
        {!activeWebKey && (
          <div
            className="row glass"
            style={{
              position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
              zIndex: 40, padding: "16px 22px", borderRadius: 16, flexDirection: "column", gap: 10, textAlign: "center",
            }}
          >
            {Icon.alert({ size: 22 })}
            <div style={{ fontWeight: 650 }}>尚未配置高德 Web服务 Key</div>
            <div className="field-hint" style={{ maxWidth: 300 }}>
              检索功能需要你的高德「Web服务」Key。Key 仅存本机,输入即生效。
            </div>
            <Btn variant="primary" onClick={onGoSettings}>
              {Icon.gear({ size: 14 })} 去设置
            </Btn>
          </div>
        )}
      </div>

      {detailPoi && (
        <DetailModal
          poi={detailPoi}
          webKey={activeWebKey}
          inPool={inPool(detailPoi)}
          onAddPool={(item) => addSelectedToPool([item])}
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
