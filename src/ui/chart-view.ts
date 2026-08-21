import type { ProcessedCusumRecord } from "../core";
import { buildCusumChartData, formatResultNumber } from "../results";
import type { ChartRenderer } from "../results";

export const MAX_PRACTICAL_CHART_SERIES = 20;

export interface ChartViewElements {
  canvas: HTMLCanvasElement;
  summary: HTMLElement;
  empty: HTMLElement;
}

export function renderChartView(
  elements: ChartViewElements,
  records: ProcessedCusumRecord[],
  threshold: number,
  chart: ChartRenderer,
): void {
  const chartData = buildCusumChartData(records, threshold);
  const seriesCount = chartData.datasets.filter((dataset) => dataset.threshold_line !== true).length;
  const alertCount = records.filter((record) => record.is_alert).length;
  const dates = records.map((record) => record.date).sort((left, right) => left.localeCompare(right));
  const highest = records.length === 0 ? 0 : Math.max(...records.map((record) => record.cusum));
  elements.summary.textContent = records.length === 0
    ? "No chart series or records match the current display filters. Select a series or reset the filters."
    : seriesCount > MAX_PRACTICAL_CHART_SERIES
      ? `${seriesCount.toLocaleString()} series are selected. Select ${MAX_PRACTICAL_CHART_SERIES} or fewer chart series to render the chart; no records are sampled or discarded.`
    : `${seriesCount.toLocaleString()} displayed series from ${dates[0]} to ${dates.at(-1)}; ` +
      `${alertCount.toLocaleString()} displayed alerts; highest displayed CUSUM ${formatResultNumber(highest)}.`;
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
