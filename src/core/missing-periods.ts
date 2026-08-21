import { nextPeriod } from "./dates";
import { compareRecords } from "./grouping";
import type {
  AnalysisInterval,
  CompletedPeriodRecord,
  AggregatedRecord,
} from "./types";

export function fillMissingPeriods(
  records: AggregatedRecord[],
  interval: AnalysisInterval,
): CompletedPeriodRecord[] {
  const groups = new Map<string, AggregatedRecord[]>();
  for (const record of records) {
    const group = groups.get(record.series_key) ?? [];
    group.push(record);
    groups.set(record.series_key, group);
  }
  const completed: CompletedPeriodRecord[] = [];
  for (const group of groups.values()) {
    group.sort(compareRecords);
    const first = group[0];
    const last = group[group.length - 1];
    if (first === undefined || last === undefined) continue;
    const byDate = new Map(group.map((record) => [record.date, record]));
    let date = first.date;
    while (date <= last.date) {
      const record = byDate.get(date);
      completed.push(record ?? {
        area: first.area,
        ...(first.risk_group === undefined ? {} : { risk_group: first.risk_group }),
        date,
        count: 0,
        series_key: first.series_key,
      });
      date = nextPeriod(date, interval);
    }
  }
  return completed.sort(compareRecords);
}
