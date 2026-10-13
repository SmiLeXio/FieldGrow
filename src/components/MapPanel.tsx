/** 地图面板 —— 高德 JS API 可视化:结果打点 / 拖拽框选 / 点选中心点。
 *
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
  const drawingRef = useRef(false);
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
        strokeColor: "#34d399",
        strokeWeight: 2,
        fillColor: "#34d399",
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
          offset: new AMap.Pixel(0, 0),
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
      if (drawingRef.current) return;
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

  /* —— 拖拽框选 —— */
  const startDraw = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const AMap = window.AMap;

    // 移除已有框
    if (rectRef.current) {
      map.remove(rectRef.current);
      rectRef.current = null;
    }

    let start: any = null;
    let preview: any = null;

    const onMouseDown = (e: any) => {
      start = e.lnglat;
      drawingRef.current = true;
    };
    const onMouseMove = (e: any) => {
      if (!start) return;
      const b = new AMap.Bounds(
        [Math.min(start.getLng(), e.lnglat.getLng()), Math.min(start.getLat(), e.lnglat.getLat())],
        [Math.max(start.getLng(), e.lnglat.getLng()), Math.max(start.getLat(), e.lnglat.getLat())],
      );
      if (preview) map.remove(preview);
      preview = new AMap.Rectangle({
        bounds: b,
        strokeColor: "#34d399",
        strokeWeight: 2,
        strokeStyle: "dashed",
        fillColor: "#34d399",
        fillOpacity: 0.1,
      });
      map.add(preview);
    };
    const onMouseUp = (e: any) => {
      if (!start) return;
      const west = Math.min(start.getLng(), e.lnglat.getLng());
      const east = Math.max(start.getLng(), e.lnglat.getLng());
      const south = Math.min(start.getLat(), e.lnglat.getLat());
      const north = Math.max(start.getLat(), e.lnglat.getLat());
      if (preview) {
        map.remove(preview);
        preview = null;
      }
      start = null;
      drawingRef.current = false;
      cleanup();
      if (east - west < 1e-5 || north - south < 1e-5) {
        setDrawing(false);
        return;
      }
      onBoundsChange({
        west: Number(west.toFixed(6)),
        south: Number(south.toFixed(6)),
        east: Number(east.toFixed(6)),
        north: Number(north.toFixed(6)),
      });
      setDrawing(false);
    };

    const cleanup = () => {
      map.off("mousedown", onMouseDown);
      map.off("mousemove", onMouseMove);
      map.off("mouseup", onMouseUp);
    };

    map.on("mousedown", onMouseDown);
    map.on("mousemove", onMouseMove);
    map.on("mouseup", onMouseUp);
    setDrawing(true);
    void AMap; // 引用保持,便于后续扩展 MouseTool
  }, [onBoundsChange]);

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
          <Btn size="sm" variant={drawing ? "primary" : "default"} onClick={startDraw}>
            {Icon.target({ size: 13 })}
            {drawing ? "拖拽框选中…" : "框选范围"}
          </Btn>
        )}
        {ready && bounds && (
          <Btn size="sm" variant="ghost" onClick={() => onBoundsChange(null)}>
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
