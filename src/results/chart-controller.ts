import {
  CategoryScale,
  Chart,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import type { ChartConfiguration, Plugin, TooltipItem } from "chart.js";
import type {} from "chartjs-plugin-zoom";
import type {
  ChartInitialBaselineBand,
  CusumChartData,
  CusumChartDataset,
} from "./types";

Chart.register(
  CategoryScale,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
);

export interface ChartInstance {
  destroy(): void;
  resize?(): void;
  resetZoom?(): void;
}

export type ChartFactory = (canvas: HTMLCanvasElement, configuration: ChartConfiguration<"line">) => ChartInstance;

export interface ChartRenderer {
  render(canvas: HTMLCanvasElement, data: CusumChartData): void;
  clear(): void;
  resize?(): void;
  resetZoom?(): void;
}

const defaultFactory: ChartFactory = (canvas, configuration) => new Chart(canvas, configuration);

export class CusumChartController implements ChartRenderer {
  private chart: ChartInstance | null = null;

  constructor(private readonly factory: ChartFactory = defaultFactory) {}

  render(canvas: HTMLCanvasElement, data: CusumChartData): void {
    this.clear();
    this.chart = this.factory(canvas, {
      type: "line",
      data: data as ChartConfiguration<"line">["data"],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        normalized: true,
        animation: false,
        interaction: { mode: "nearest", intersect: false },
        scales: {
          x: {
            type: "category",
            title: { display: true, text: "Date", color: "#41206b" },
            ticks: { color: "#645b70" },
            grid: { color: "#eee8f6" },
          },
          y: {
            min: 0,
            title: { display: true, text: "CUSUM", color: "#41206b" },
            ticks: { color: "#645b70" },
            grid: { color: "#eee8f6" },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => items[0]?.label ?? "",
              label: (item: TooltipItem<"line">) => tooltipLines(item),
            },
          },
          zoom: {
            limits: {
              x: { min: "original", max: "original", minRange: 1 },
            },
            pan: {
              enabled: true,
              mode: "x",
              modifierKey: "shift",
              threshold: 5,
            },
            zoom: {
              mode: "x",
              wheel: { enabled: true, modifierKey: "ctrl", speed: 0.08 },
              pinch: { enabled: true },
              drag: {
                enabled: true,
                threshold: 8,
                borderColor: "#55308a",
                borderWidth: 1,
                backgroundColor: "rgba(85, 48, 138, 0.12)",
              },
            },
          },
        },
      },
      plugins: [initialBaselinePeriodPlugin(data.initial_baseline_bands)],
    });
  }

  clear(): void {
    this.chart?.destroy();
    this.chart = null;
  }

  resize(): void {
    this.chart?.resize?.();
  }

  resetZoom(): void {
    this.chart?.resetZoom?.();
  }
}

function initialBaselinePeriodPlugin(
  bands: ChartInitialBaselineBand[],
): Plugin<"line"> {
  return {
    id: "initial-baseline-period",
    beforeDatasetsDraw(chart) {
      if (bands.length === 0) return;
      const xScale = chart.scales.x;
      if (xScale === undefined) return;
      const { left, right, top, bottom } = chart.chartArea;
      const labelCount = chart.data.labels?.length ?? 0;
      if (labelCount === 0) return;
      const pixelAt = (index: number): number => xScale.getPixelForValue(index);
      const boundaryBefore = (index: number): number =>
        index === 0 ? left : (pixelAt(index - 1) + pixelAt(index)) / 2;
      const boundaryAfter = (index: number): number =>
        index >= labelCount - 1 ? right : (pixelAt(index) + pixelAt(index + 1)) / 2;

      chart.ctx.save();
      chart.ctx.fillStyle = "rgba(94, 87, 101, 0.12)";
      chart.ctx.strokeStyle = "rgba(94, 87, 101, 0.42)";
      chart.ctx.lineWidth = 1;
      chart.ctx.font = "600 11px system-ui, sans-serif";
      chart.ctx.textBaseline = "top";
      chart.ctx.beginPath();
      chart.ctx.rect(left, top, right - left, bottom - top);
      chart.ctx.clip();
      for (const band of bands) {
        const start = boundaryBefore(band.start_index);
        const end = boundaryAfter(band.end_index);
        if (end < left || start > right) continue;
        chart.ctx.fillRect(start, top, end - start, bottom - top);
        chart.ctx.strokeRect(start, top, end - start, bottom - top);
        chart.ctx.fillStyle = "#554d5d";
        chart.ctx.fillText("Initial baseline period", Math.max(start, left) + 6, top + 6);
        chart.ctx.fillStyle = "rgba(94, 87, 101, 0.12)";
      }
      chart.ctx.restore();
    },
  };
}

function tooltipLines(item: TooltipItem<"line">): string | string[] {
  const dataset = item.dataset as unknown as CusumChartDataset;
  if (dataset.threshold_line === true) return `Alert threshold: ${String(item.raw)}`;
  const record = dataset.records?.[item.dataIndex];
  if (record === null || record === undefined) return dataset.label;
  return [
    `Series: ${record.series}`,
    `Date: ${record.date}`,
    `Count: ${record.count}`,
    `CUSUM: ${record.cusum}`,
    `Alert: ${record.is_alert ? "Yes" : "No"}`,
  ];
}
