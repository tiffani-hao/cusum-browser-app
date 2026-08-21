import type { ProcessedCusumRecord } from "../core";
import { independentSeries, seriesKey } from "./result-selectors";
import type { CusumChartData, CusumChartDataset } from "./types";

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
): CusumChartData {
  const labels = [...new Set(records.map((record) => record.date))].sort((left, right) => left.localeCompare(right));
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

  return { labels, datasets };
}
