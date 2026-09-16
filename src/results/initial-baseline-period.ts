import type { ProcessedCusumRecord } from "../core";
import { seriesKey } from "./result-selectors";

const RECORD_SEPARATOR = "\u0001";

export function initialBaselineRecordKey(
  record: Pick<ProcessedCusumRecord, "area" | "risk_group" | "date">,
): string {
  return `${seriesKey(record)}${RECORD_SEPARATOR}${record.date}`;
}

export function initialBaselinePeriodRecordKeys(
  records: ProcessedCusumRecord[],
  baselineWindow: number,
): Set<string> {
  const datesBySeries = new Map<string, Set<string>>();
  for (const record of records) {
    const dates = datesBySeries.get(seriesKey(record)) ?? new Set<string>();
    dates.add(record.date);
    datesBySeries.set(seriesKey(record), dates);
  }

  const keys = new Set<string>();
  for (const [key, dates] of datesBySeries) {
    [...dates]
      .sort((left, right) => left.localeCompare(right))
      .slice(0, baselineWindow)
      .forEach((date) => keys.add(`${key}${RECORD_SEPARATOR}${date}`));
  }
  return keys;
}

export function isInitialBaselinePeriodRecord(
  record: Pick<ProcessedCusumRecord, "area" | "risk_group" | "date">,
  baselineKeys: ReadonlySet<string>,
): boolean {
  return baselineKeys.has(initialBaselineRecordKey(record));
}
