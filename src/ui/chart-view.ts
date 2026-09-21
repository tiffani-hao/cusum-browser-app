import { countDisplayedAlertEpisodes } from "../core";
import type { AnalysisInterval, ProcessedCusumRecord } from "../core";
import {
  buildCusumChartData,
  formatResultNumber,
  initialBaselinePeriodRecordKeys,
  isInitialBaselinePeriodRecord,
} from "../results";
import type { ChartRenderer } from "../results";

export const MAX_PRACTICAL_CHART_SERIES = 20;

export interface ChartViewElements {
  canvas: HTMLCanvasElement;
  summary: HTMLElement;
  empty: HTMLElement;
  guidance: HTMLElement;
}

export function renderChartView(
  elements: ChartViewElements,
  records: ProcessedCusumRecord[],
  threshold: number,
  chart: ChartRenderer,
  baselineWindow: number,
  analysisInterval: AnalysisInterval,
  baselineReferenceRecords: ProcessedCusumRecord[] = records,
): void {
  const chartData = buildCusumChartData(records, threshold, baselineWindow, baselineReferenceRecords);
  const baselineKeys = initialBaselinePeriodRecordKeys(baselineReferenceRecords, baselineWindow);
  const seriesCount = chartData.datasets.filter((dataset) => dataset.threshold_line !== true).length;
  const alertCount = countDisplayedAlertEpisodes(records, baselineReferenceRecords);
  const baselineCount = records.filter((record) =>
    isInitialBaselinePeriodRecord(record, baselineKeys)
  ).length;
  const dates = records.map((record) => record.date).sort((left, right) => left.localeCompare(right));
  const highest = records.length === 0 ? 0 : Math.max(...records.map((record) => record.cusum));
  const intervalLabel = `${analysisInterval} interval${baselineWindow === 1 ? "" : "s"}`;
  elements.guidance.textContent =
    `The shaded initial baseline period covers the first ${baselineWindow.toLocaleString()} ${intervalLabel} in each independent series, based on the completed analysis settings. ` +
    "During this period, the rolling baseline accumulates up to the selected window. All data, CUSUM values, and alert points remain visible; interpret results from this setup period cautiously.";
  elements.summary.textContent = records.length === 0
    ? "No chart series or records match the current display filters. Select a series or reset the filters."
    : seriesCount > MAX_PRACTICAL_CHART_SERIES
      ? `${seriesCount.toLocaleString()} series are selected. Select ${MAX_PRACTICAL_CHART_SERIES} or fewer chart series to render the chart; no records are sampled or discarded.`
    : `${seriesCount.toLocaleString()} displayed series from ${dates[0]} to ${dates.at(-1)}; ` +
      `${baselineCount.toLocaleString()} displayed records fall within the shaded initial baseline period; ` +
      `all chart values remain visible; ${alertCount.toLocaleString()} displayed alert episodes; ` +
      `highest displayed CUSUM ${formatResultNumber(highest)}.`;
  const chartUnavailable = records.length === 0 || seriesCount > MAX_PRACTICAL_CHART_SERIES;
  elements.empty.hidden = !chartUnavailable;
  elements.empty.textContent = records.length === 0
    ? "No chart is shown because no visible series contain records."
    : `No chart is shown because more than ${MAX_PRACTICAL_CHART_SERIES} series are selected.`;
  elements.canvas.hidden = chartUnavailable;
  if (chartUnavailable) {
    chart.clear();
    return;
  }
  chart.render(elements.canvas, chartData);
}
