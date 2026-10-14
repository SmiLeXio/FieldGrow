/** POI 详情弹窗 —— 调用 place/detail 获取完整商户信息(多电话/营业时间/别名等)。 */
import { useEffect, useState } from "react";
import { fetchDetail } from "../lib/amap";
import { fmtCityArea, fmtLocation, fmtRating, telTypeLabel } from "../lib/format";
import type { PoiDetail, PoiItem } from "../lib/types";
import { Badge, Btn, Icon, Modal } from "./ui";

export function DetailModal({
  poi,
  webKey,
  inPool,
  onAddPool,
  onClose,
  onLog,
}: {
  poi: PoiItem;
  webKey: string;
  inPool: boolean;
  onAddPool: (item: PoiItem) => void;
  onClose: () => void;
  onLog: (summary: string, ok: boolean, error?: string) => void;
}) {
  const [detail, setDetail] = useState<PoiDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    fetchDetail(poi.poiId, webKey)
      .then((d) => {
        if (alive) setDetail(d);
        onLog(`详情[${poi.name}]`, true);
      })
      .catch((e) => {
        if (!alive) return;
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        onLog(`详情[${poi.name}]`, false, msg);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poi.poiId]);

  const d = detail ?? poi;

  return (
    <Modal
      title={poi.name}
      onClose={onClose}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>
            关闭
          </Btn>
          <Btn
            variant="primary"
            disabled={inPool}
            onClick={() => {
              onAddPool(detail ?? poi);
              onClose();
            }}
          >
            {inPool ? Icon.check({ size: 14 }) : Icon.plus({ size: 14 })}
            {inPool ? "已在客户池" : "加入客户池"}
          </Btn>
        </>
      }
    >
      {loading && (
        <div className="row" style={{ padding: "18px 0", justifyContent: "center", color: "var(--text-2)" }}>
          {Icon.spinner({ size: 16, className: "spin" })} 正在获取商户详情…
        </div>
      )}
      {error && !loading && (
        <div className="row" style={{ padding: "12px 14px", borderRadius: 12, background: "var(--danger-soft)", color: "var(--danger)", alignItems: "flex-start" }}>
          {Icon.alert({ size: 15 })}
          <span>{error}(以下展示检索结果中的基础信息)</span>
        </div>
      )}
      {!loading && (
        <dl className="detail-grid" style={{ marginTop: error ? 14 : 0 }}>
          <dt>店名</dt>
          <dd style={{ fontWeight: 650 }}>{d.name}</dd>
          <dt>地址</dt>
          <dd>{d.address || "—"}</dd>
          <dt>电话</dt>
          <dd>
            {detail && detail.telAll.length ? (
              <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
                {detail.telAll.map((t) => (
                  <span key={t} className="row" style={{ gap: 5 }}>
                    {Icon.phone({ size: 13 })}
                    <span className="mono">{t}</span>
                  </span>
                ))}
              </div>
            ) : d.tel ? (
              <span className="row" style={{ gap: 5 }}>
                {Icon.phone({ size: 13 })}
                <span className="mono">{d.tel}</span>
              </span>
            ) : (
              "—"
            )}
          </dd>
          <dt>号码类型</dt>
          <dd>
            <Badge tone={d.telType === "mobile" ? "accent" : d.telType === "landline" ? "info" : "default"}>
              {telTypeLabel(d.telType)}
            </Badge>
          </dd>
          <dt>评分</dt>
          <dd>
            <span className="rating">{fmtRating(d.rating)}</span>
          </dd>
          {detail?.openingHours && (
            <>
              <dt>营业时间</dt>
              <dd>{detail.openingHours}</dd>
            </>
          )}
          {detail?.cost && (
            <>
              <dt>人均消费</dt>
              <dd>{detail.cost}</dd>
            </>
          )}
          {detail?.tag && (
            <>
              <dt>标签</dt>
              <dd>{detail.tag}</dd>
            </>
          )}
          {detail?.alias && (
            <>
              <dt>别名</dt>
              <dd>{detail.alias}</dd>
            </>
          )}
          <dt>POI 类型</dt>
          <dd>{d.type || "—"}</dd>
          <dt>区域</dt>
          <dd>{fmtCityArea(d.city, d.district, d.adcode)}</dd>
          <dt>经纬度</dt>
          <dd className="mono">{fmtLocation(d.location)}</dd>
          <dt>POI ID</dt>
          <dd className="mono">{d.poiId}</dd>
          <dt>来源</dt>
          <dd>{d.source === "amap" ? "高德地图" : d.source}</dd>
        </dl>
      )}
    </Modal>
  );
}
