import { standardizeDate } from "./dates";
import { compareRecords, defineSeries } from "./grouping";
import type {
  AggregatedRecord,
  AnalysisOptions,
  StandardizedRecord,
  ValidatedInputRecord,
} from "./types";

export function standardizeRecords(records: ValidatedInputRecord[], options: AnalysisOptions): StandardizedRecord[] {
  return records.map((record) => {
    const series = defineSeries(record, options.group_by_risk_group);
    return {
      area: series.area,
      ...(series.risk_group === undefined ? {} : { risk_group: series.risk_group }),
      date: standardizeDate(record.date, options.analysis_interval),
      count: record.count,
      series_key: series.key,
    };
  });
}

export function aggregateDuplicates(records: StandardizedRecord[]): AggregatedRecord[] {
  const aggregated = new Map<string, AggregatedRecord>();
  for (const record of records) {
    const key = `${record.series_key}\u0001${record.date}`;
    const existing = aggregated.get(key);
    if (existing === undefined) aggregated.set(key, { ...record });
    else existing.count += record.count;
  }
  return [...aggregated.values()].sort(compareRecords);
}
