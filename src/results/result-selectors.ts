import type { ProcessedCusumRecord } from "../core";
import type { SeriesOption } from "./types";

const SERIES_SEPARATOR = "\u0000";

export function seriesKey(record: Pick<ProcessedCusumRecord, "area" | "risk_group">): string {
  return `${record.area}${SERIES_SEPARATOR}${record.risk_group ?? ""}`;
}

export function seriesLabel(record: Pick<ProcessedCusumRecord, "area" | "risk_group">): string {
  return record.risk_group === undefined ? record.area : `${record.area} — ${record.risk_group}`;
}

export function uniqueAreas(records: ProcessedCusumRecord[]): string[] {
  return [...new Set(records.map((record) => record.area))].sort((left, right) => left.localeCompare(right));
}

export function uniqueRiskGroups(records: ProcessedCusumRecord[]): string[] {
  return [...new Set(records.flatMap((record) => record.risk_group === undefined ? [] : [record.risk_group]))]
    .sort((left, right) => left.localeCompare(right));
}

export function independentSeries(records: ProcessedCusumRecord[]): SeriesOption[] {
  const byKey = new Map<string, SeriesOption>();
  for (const record of records) {
    const key = seriesKey(record);
    if (!byKey.has(key)) {
      byKey.set(key, {
        key,
        label: seriesLabel(record),
        area: record.area,
        ...(record.risk_group === undefined ? {} : { risk_group: record.risk_group }),
      });
    }
  }
  return [...byKey.values()].sort((left, right) =>
    left.area.localeCompare(right.area) ||
    (left.risk_group ?? "").localeCompare(right.risk_group ?? "")
  );
}

