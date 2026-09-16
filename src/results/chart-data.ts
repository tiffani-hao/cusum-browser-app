import type { ProcessedCusumRecord } from "../core";
import {
  initialBaselinePeriodRecordKeys,
  isInitialBaselinePeriodRecord,
} from "./initial-baseline-period";
import { independentSeries, seriesKey } from "./result-selectors";
import type {
  ChartInitialBaselineBand,
  CusumChartData,
  CusumChartDataset,
} from "./types";

const SERIES_COLORS = [
  "#55308a",
  "#176b73",
  "#9b3a53",
  "#315f9f",
  "#8a5a00",
  "#287a3d",
  "#8c3d9e",
  "#7d4e24",
];

export function buildCusumChartData(
  records: ProcessedCusumRecord[],
  threshold: number,
  baselineWindow = 0,
  baselineReferenceRecords: ProcessedCusumRecord[] = records,
): CusumChartData {
  const labels = [...new Set(records.map((record) => record.date))].sort((left, right) => left.localeCompare(right));
  const baselineKeys = initialBaselinePeriodRecordKeys(baselineReferenceRecords, baselineWindow);
  const recordsBySeries = new Map<string, Map<string, ProcessedCusumRecord>>();
  for (const record of records) {
    const key = seriesKey(record);
    const dates = recordsBySeries.get(key) ?? new Map<string, ProcessedCusumRecord>();
    dates.set(record.date, record);
    recordsBySeries.set(key, dates);
  }

  const datasets: CusumChartDataset[] = independentSeries(records).map((series, index) => {
    const color = SERIES_COLORS[index % SERIES_COLORS.length]!;
    const dates = recordsBySeries.get(series.key) ?? new Map<string, ProcessedCusumRecord>();
    const aligned = labels.map((date) => dates.get(date) ?? null);
    return {
      label: series.label,
      data: aligned.map((record) => record?.cusum ?? null),
      borderColor: color,
      backgroundColor: color,
      borderWidth: 2,
      pointBackgroundColor: aligned.map((record) => record?.is_alert === true ? "#b42318" : color),
      pointBorderColor: aligned.map((record) => record?.is_alert === true ? "#ffffff" : color),
      pointRadius: aligned.map((record) => record?.is_alert === true ? 5 : 2),
      pointHoverRadius: aligned.map((record) => record?.is_alert === true ? 7 : 4),
      tension: 0,
      spanGaps: false,
      records: aligned.map((record) => record === null ? null : {
        series: series.label,
        date: record.date,
        count: record.count,
        cusum: record.cusum,
        is_alert: record.is_alert,
      }),
    };
  });

  if (labels.length > 0) {
    datasets.push({
      label: "Alert threshold",
      data: labels.map(() => threshold),
      borderColor: "#231a30",
      backgroundColor: "#231a30",
      borderWidth: 2,
      borderDash: [8, 6],
      pointBackgroundColor: "#231a30",
      pointBorderColor: "#231a30",
      pointRadius: 0,
      pointHoverRadius: 0,
      tension: 0,
      spanGaps: true,
      threshold_line: true,
    });
  }

  return {
    labels,
    datasets,
    initial_baseline_bands: initialBaselineBands(records, labels, baselineKeys),
  };
}

function initialBaselineBands(
  records: ProcessedCusumRecord[],
  labels: string[],
  baselineKeys: ReadonlySet<string>,
): ChartInitialBaselineBand[] {
  const labelIndexes = new Map(labels.map((label, index) => [label, index]));
  const indexes = [...new Set(records.flatMap((record) => {
    if (!isInitialBaselinePeriodRecord(record, baselineKeys)) return [];
    const index = labelIndexes.get(record.date);
    return index === undefined ? [] : [index];
  }))].sort((left, right) => left - right);
  const bands: ChartInitialBaselineBand[] = [];
  for (const index of indexes) {
    const previous = bands.at(-1);
    if (previous !== undefined && index === previous.end_index + 1) {
      previous.end_index = index;
    } else {
      bands.push({ start_index: index, end_index: index });
    }
  }
  return bands;
}
