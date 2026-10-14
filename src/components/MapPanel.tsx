/** 地图面板 —— 高德 JS API 可视化:结果打点 / 拖拽框选 / 点选中心点。
 *
 * 框选基于官方 AMap.MouseTool(画框时自动接管鼠标拖拽,与地图平移互不冲突);
 * JS Key 未配置或加载失败时优雅降级:展示引导占位,检索/导出功能不受影响。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "../lib/appContext";
import type { Bounds, PoiItem, SearchMode } from "../lib/types";
import { Badge, Btn, Icon } from "./ui";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    AMap?: any;
    _AMapSecurityConfig?: { securityJsCode?: string };
  }
}

let amapLoader: Promise<any> | null = null;
let loadedKey = "";

function loadAMapScript(jsKey: string, securityJsCode: string): Promise<any> {
  if (window.AMap && loadedKey === jsKey) return Promise.resolve(window.AMap);
  if (amapLoader && loadedKey === jsKey) return amapLoader;
  loadedKey = jsKey;

  amapLoader = new Promise((resolve, reject) => {
    if (securityJsCode) {
      window._AMapSecurityConfig = { securityJsCode };
    } else {
      delete window._AMapSecurityConfig;
    }
    const prev = document.getElementById("amap-script");
    if (prev) prev.remove();

    const script = document.createElement("script");
    script.id = "amap-script";
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(jsKey)}&plugin=AMap.MouseTool,AMap.Scale,AMap.ToolBar`;
    script.async = true;

    const timer = window.setTimeout(() => reject(new Error("地图脚本加载超时")), 12000);
    script.onload = () => {
      window.clearTimeout(timer);
      if (window.AMap) resolve(window.AMap);
      else reject(new Error("地图脚本加载后未就绪"));
    };
    script.onerror = () => {
      window.clearTimeout(timer);
      reject(new Error("地图脚本加载失败(请检查 JS Key 与网络)"));
    };
    document.head.appendChild(script);
  });
  return amapLoader;
}

const RECT_STYLE = {
  strokeColor: "#34d399",
  strokeWeight: 2,
  strokeStyle: "dashed",
  fillColor: "#34d399",
  fillOpacity: 0.1,
};

interface MapPanelProps {
  collapsed: boolean;
  onToggle: () => void;
  mode: SearchMode;
  results: PoiItem[];
  bounds: Bounds | null;
  onBoundsChange: (b: Bounds | null) => void;
  center: string;
  onCenterChange: (loc: string) => void;
  activePoiId: string | null;
  onPoiClick: (poiId: string) => void;
}

export function MapPanel({
  collapsed,
  onToggle,
  mode,
  results,
  bounds,
  onBoundsChange,
  center,
  onCenterChange,
  activePoiId,
  onPoiClick,
}: MapPanelProps) {
  const { settings, theme } = useApp();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const rectRef = useRef<any>(null);
  const centerMarkerRef = useRef<any>(null);
  const toolRef = useRef<any>(null);
  const onPoiClickRef = useRef(onPoiClick);
  onPoiClickRef.current = onPoiClick;
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [loadingMap, setLoadingMap] = useState(false);
  const [drawing, setDrawing] = useState(false);

  const hasJsKey = Boolean(settings.jsKey);

  /* —— 初始化地图 —— */
  useEffect(() => {
    if (collapsed || !hasJsKey) return;
    let disposed = false;

    (async () => {
      setLoadingMap(true);
      setError("");
      try {
        const AMap = await loadAMapScript(settings.jsKey, settings.securityJsCode);
        if (disposed || !containerRef.current) return;
        if (mapRef.current) {
          setReady(true);
          setLoadingMap(false);
          return;
        }
        const map = new AMap.Map(containerRef.current, {
          zoom: 13,
          center: center ? center.split(",").map(Number) : [116.397428, 39.90923],
          viewMode: "2D",
          mapStyle: theme === "dark" ? "amap://styles/dark" : "amap://styles/normal",
        });
        map.addControl(new AMap.Scale());
        mapRef.current = map;
        setReady(true);
      } catch (e) {
        if (!disposed) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!disposed) setLoadingMap(false);
      }
    })();

    return () => {
      disposed = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collapsed, hasJsKey, settings.jsKey]);

  /* —— 容器尺寸变化(视图切换/面板收放)后刷新地图 —— */
  useEffect(() => {
    const el = containerRef.current;
    const map = mapRef.current;
    if (!el || !map || !ready) return;
    const ro = new ResizeObserver(() => {
      try {
        if (typeof map.resize === "function") map.resize();
        else map.setCenter(map.getCenter());
      } catch {
        /* 忽略 */
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ready]);

  /* —— 主题切换 —— */
  useEffect(() => {
    const map = mapRef.current;
    if (map && ready) {
      map.setMapStyle(theme === "dark" ? "amap://styles/dark" : "amap://styles/normal");
    }
  }, [theme, ready]);

  /* —— 结果打点 —— */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const AMap = window.AMap;

    if (markersRef.current.length) {
      map.remove(markersRef.current);
      markersRef.current = [];
    }

    const markers = results
      .filter((p) => p.location)
      .map((p) => {
        const [lng, lat] = p.location.split(",").map(Number);
        if (Number.isNaN(lng) || Number.isNaN(lat)) return null;
        const hot = p.poiId === activePoiId;
        const marker = new AMap.Marker({
          position: [lng, lat],
          title: p.name,
          anchor: "bottom-center",
          offset: new AMap.Pixel(-10, -4),
          content: `<div class="map-pin ${hot ? "hot" : ""}" title="${escapeHtml(p.name)}"></div>`,
        });
        marker.on("click", () => onPoiClickRef.current(p.poiId));
        return marker;
      })
      .filter(Boolean);

    markersRef.current = markers;
    if (markers.length) {
      map.add(markers);
      map.setFitView(markers, false, [40, 40, 40, 40], 15);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, ready, activePoiId]);

  /* —— 框选范围回显 —— */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const AMap = window.AMap;

    if (rectRef.current) {
      map.remove(rectRef.current);
      rectRef.current = null;
    }
    if (bounds) {
      const rect = new AMap.Rectangle({
        bounds: new AMap.Bounds([bounds.west, bounds.south], [bounds.east, bounds.north]),
        ...RECT_STYLE,
        strokeStyle: "solid",
        fillOpacity: 0.08,
      });
      rectRef.current = rect;
      map.add(rect);
    }
  }, [bounds, ready]);

  /* —— 周边中心点回显 —— */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const AMap = window.AMap;

    if (centerMarkerRef.current) {
      map.remove(centerMarkerRef.current);
      centerMarkerRef.current = null;
    }
    if (center) {
      const [lng, lat] = center.split(",").map(Number);
      if (!Number.isNaN(lng) && !Number.isNaN(lat)) {
        const m = new AMap.Marker({
          position: [lng, lat],
          anchor: "center",
          content: `<div class="map-pin hot" style="opacity:.95"></div>`,
        });
        centerMarkerRef.current = m;
        map.add(m);
      }
    }
  }, [center, ready]);

  /* —— 点选中心点(周边模式)— — */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const onClick = (e: any) => {
      if (toolRef.current) return;
      if (mode === "around") {
        const lng = Number(e.lnglat.getLng()).toFixed(6);
        const lat = Number(e.lnglat.getLat()).toFixed(6);
        onCenterChange(`${lng},${lat}`);
      }
    };
    map.on("click", onClick);
    return () => {
      map.off("click", onClick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, mode]);

  /* —— 结束/取消画框(还原 MouseTool 与地图拖拽)— — */
  const stopDraw = useCallback(() => {
    const tool = toolRef.current;
    if (tool) {
      try {
        tool.close(false);
      } catch {
        /* 忽略 */
      }
      toolRef.current = null;
    }
    setDrawing(false);
  }, []);

  useEffect(() => () => stopDraw(), [stopDraw]);

  /* —— 拖拽框选(MouseTool,画框时自动接管拖拽,不会与地图平移冲突)— — */
  const startDraw = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const AMap = window.AMap;

    // 已在画框则先停止;重新画框即放弃旧范围,避免取消后残留"看不见的框"
    stopDraw();
    if (rectRef.current) {
      map.remove(rectRef.current);
      rectRef.current = null;
    }
    if (bounds) onBoundsChange(null);

    try {
      const tool = new AMap.MouseTool(map);
      toolRef.current = tool;
      setDrawing(true);
      tool.rectangle({ ...RECT_STYLE });

      tool.on("draw", (e: any) => {
        let b: any = null;
        try {
          b = e.obj.getBounds();
          map.remove(e.obj);
        } catch {
          /* 忽略 */
        }
        toolRef.current = null;
        try {
          tool.close(false);
        } catch {
          /* 忽略 */
        }
        setDrawing(false);
        if (!b) return;
        const sw = b.getSouthWest();
        const ne = b.getNorthEast();
        const west = Number(sw.getLng().toFixed(6));
        const south = Number(sw.getLat().toFixed(6));
        const east = Number(ne.getLng().toFixed(6));
        const north = Number(ne.getLat().toFixed(6));
        if (east - west < 1e-5 || north - south < 1e-5) return;
        onBoundsChange({ west, south, east, north });
      });
    } catch (err) {
      setDrawing(false);
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [onBoundsChange, stopDraw, bounds]);

  /* —— 重试 —— */
  const retry = () => {
    loadedKey = "";
    amapLoader = null;
    mapRef.current = null;
    setReady(false);
    setError("");
    setLoadingMap(true);
    loadAMapScript(settings.jsKey, settings.securityJsCode)
      .then((AMap) => {
        if (!containerRef.current) return;
        mapRef.current = new AMap.Map(containerRef.current, {
          zoom: 13,
          center: center ? center.split(",").map(Number) : [116.397428, 39.90923],
          viewMode: "2D",
          mapStyle: theme === "dark" ? "amap://styles/dark" : "amap://styles/normal",
        });
        setReady(true);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoadingMap(false));
  };

  return (
    <aside className={`map-panel ${collapsed ? "collapsed" : ""}`}>
      <div className="map-head">
        <span className="map-title">地图视图</span>
        {ready && mode === "polygon" && (
          <Btn size="sm" variant={drawing ? "primary" : "default"} onClick={drawing ? stopDraw : startDraw}>
            {Icon.target({ size: 13 })}
            {drawing ? "画框中…点击取消" : "框选范围"}
          </Btn>
        )}
        {ready && bounds && (
          <Btn
            size="sm"
            variant="ghost"
            onClick={() => {
              stopDraw();
              onBoundsChange(null);
            }}
          >
            清除框选
          </Btn>
        )}
        <div className="spacer" />
        <Btn size="sm" variant="ghost" className="btn-icon" onClick={onToggle} title="收起地图">
          {Icon.chevronR({ size: 15 })}
        </Btn>
      </div>

      <div className="map-canvas" ref={containerRef}>
        {!hasJsKey && (
          <div className="map-empty">
            <div className="map-empty-title">地图视图未启用</div>
            <div>
              在「设置 → 地图可视化」填入高德
              <br />
              「Web端(JS API)」Key 后即可显示地图,
              <br />
              支持结果打点、拖拽框选、点选中心点。
            </div>
            <Badge tone="info">检索与导出功能不受影响</Badge>
          </div>
        )}
        {hasJsKey && loadingMap && (
          <div className="map-empty">
            <div className="map-empty-title">{Icon.spinner({ size: 18, className: "spin" })} 地图加载中…</div>
          </div>
        )}
        {hasJsKey && error && (
          <div className="map-empty">
            <div className="map-empty-title">地图加载失败</div>
            <div>{error}</div>
            <div className="field-hint">
              请确认 JS Key 类型为「Web端(JS API)」,且未绑定与当前环境不符的域名白名单。
            </div>
            <Btn size="sm" onClick={retry}>
              {Icon.refresh({ size: 13 })} 重试
            </Btn>
          </div>
        )}
        {ready && (
          <div className="map-badge-row">
            <Badge tone="accent">已标注 {results.filter((r) => r.location).length} 个点位</Badge>
            {mode === "polygon" && bounds && <Badge tone="amber">已框选范围</Badge>}
            {mode === "around" && center && <Badge tone="amber">中心点已设置</Badge>}
          </div>
        )}
      </div>
    </aside>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] || c,
  );
}
