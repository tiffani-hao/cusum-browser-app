import type { ProcessedCusumRecord } from "../core";

const BASE_HEADERS = [
  "area",
  "date",
  "count",
  "smoothed_count",
  "baseline_mean",
  "baseline_std",
  "normalized_count",
  "cusum",
  "threshold",
  "is_alert",
] as const;

export function sanitizeSpreadsheetString(value: string): string {
  return /^\s*[=+\-@]/.test(value) ? `'${value}` : value;
}

export function escapeCsvCell(value: string | number | boolean): string {
  const normalized = typeof value === "string" ? sanitizeSpreadsheetString(value) : String(value);
  return /[",\r\n]/.test(normalized) ? `"${normalized.replaceAll('"', '""')}"` : normalized;
}

export function serializeProcessedCsv(records: ProcessedCusumRecord[]): string {
  const includeRiskGroup = records.some((record) => record.risk_group !== undefined);
  const headers = includeRiskGroup
    ? ["area", "risk_group", ...BASE_HEADERS.slice(1)]
    : [...BASE_HEADERS];
  const lines = [headers.join(",")];
  for (const record of records) {
    const values: (string | number | boolean)[] = [
      record.area,
      ...(includeRiskGroup ? [record.risk_group ?? ""] : []),
      record.date,
      record.count,
      record.smoothed_count,
      record.baseline_mean,
      record.baseline_std,
      record.normalized_count,
      record.cusum,
      record.threshold,
      record.is_alert,
    ];
    lines.push(values.map(escapeCsvCell).join(","));
  }
  return `${lines.join("\r\n")}\r\n`;
}

