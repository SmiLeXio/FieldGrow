/** 导出:Excel(.xlsx)/ CSV,经系统保存对话框落盘(Rust 侧写文件)。 */
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { fmtLocation, fmtTime, timestampName, telTypeLabel } from "./format";
import type { PoolItem, PoiItem } from "./types";

export type ExportFormat = "xlsx" | "csv";

export interface ExportColumn<T> {
  header: string;
  value: (row: T) => string | number;
}

/** 商户导出列(与 VoxAI 商户检索 Excel 列保持一致语义,并扩展地推字段) */
export function poiColumns<T extends PoiItem>(): ExportColumn<T>[] {
  return [
    { header: "店名", value: (r) => r.name },
    { header: "地址", value: (r) => r.address },
    { header: "电话", value: (r) => r.tel },
    { header: "电话类型", value: (r) => telTypeLabel(r.telType) },
    { header: "评分", value: (r) => (r.rating > 0 ? r.rating.toFixed(1) : "") },
    { header: "城市", value: (r) => r.city },
    { header: "区县", value: (r) => r.district },
    { header: "行政区划", value: (r) => r.adcode },
    { header: "经纬度", value: (r) => fmtLocation(r.location) },
    { header: "POI类型", value: (r) => r.type },
    { header: "POI ID", value: (r) => r.poiId },
    { header: "来源", value: (r) => r.source },
  ];
}

export function poolColumns(): ExportColumn<PoolItem>[] {
  return [
    ...poiColumns<PoolItem>(),
    { header: "跟进状态", value: (r) => r.status },
    { header: "备注", value: (r) => r.note },
    { header: "收藏时间", value: (r) => fmtTime(r.addedAt) },
  ];
}

function toAoa<T>(rows: T[], cols: ExportColumn<T>[]): (string | number)[][] {
  return [cols.map((c) => c.header), ...rows.map((r) => cols.map((c) => c.value(r)))];
}

/** 弹出保存对话框并写文件。返回 true 表示已导出,取消返回 false。 */
export async function exportRows<T>(
  rows: T[],
  cols: ExportColumn<T>[],
  format: ExportFormat,
  prefix: string,
): Promise<boolean> {
  if (!rows.length) throw new Error("没有可导出的数据");
  const defaultName = timestampName(prefix, format);
  const path = await save({
    title: "导出商户数据",
    defaultPath: defaultName,
    filters:
      format === "xlsx"
        ? [{ name: "Excel 工作簿", extensions: ["xlsx"] }]
        : [{ name: "CSV 文件", extensions: ["csv"] }],
  });
  if (!path) return false;

  const aoa = toAoa(rows, cols);
  let bytes: Uint8Array;

  if (format === "xlsx") {
    // 动态加载 SheetJS,保持主包轻量
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = cols.map((c) => ({ wch: Math.max(10, c.header.length * 2 + 4) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "商户数据");
    const out = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    bytes = new Uint8Array(out);
  } else {
    // CSV + UTF-8 BOM,保证 Excel 打开中文不乱码
    const esc = (v: string | number) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = "﻿" + aoa.map((row) => row.map(esc).join(",")).join("\r\n");
    bytes = new TextEncoder().encode(csv);
  }

  await invoke("export_write", { path, data: Array.from(bytes) });
  return true;
}
