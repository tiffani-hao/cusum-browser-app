import type { ProcessedCusumRecord } from "../core";
import type { PaginatedRecords } from "./types";

export const PROCESSED_PAGE_SIZES = [25, 50, 100] as const;

export function sortAlertRecords(records: ProcessedCusumRecord[]): ProcessedCusumRecord[] {
  return records.filter((record) => record.is_alert).sort((left, right) =>
    right.date.localeCompare(left.date) ||
    left.area.localeCompare(right.area) ||
    (left.risk_group ?? "").localeCompare(right.risk_group ?? "")
  );
}

export function paginateRecords(
  records: ProcessedCusumRecord[],
  requestedPage: number,
  pageSize: number,
): PaginatedRecords {
  const safePageSize = Math.max(1, Math.trunc(pageSize));
  const totalPages = Math.max(1, Math.ceil(records.length / safePageSize));
  const page = Math.min(totalPages, Math.max(1, Math.trunc(requestedPage)));
  const startIndex = (page - 1) * safePageSize;
  const pageRecords = records.slice(startIndex, startIndex + safePageSize);
  return {
    records: pageRecords,
    page,
    page_size: safePageSize,
    total_records: records.length,
    total_pages: totalPages,
    range_start: records.length === 0 ? 0 : startIndex + 1,
    range_end: records.length === 0 ? 0 : startIndex + pageRecords.length,
  };
}

export function formatResultNumber(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  const magnitude = Math.abs(value);
  if (magnitude !== 0 && (magnitude >= 1_000_000_000 || magnitude < 0.000001)) {
    return value.toExponential(4);
  }
  return value.toLocaleString("en-US", {
    useGrouping: false,
    maximumFractionDigits: 6,
  });
}
