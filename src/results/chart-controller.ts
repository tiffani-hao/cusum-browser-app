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
import type { ChartConfiguration, TooltipItem } from "chart.js";
import type { CusumChartData, CusumChartDataset } from "./types";

Chart.register(CategoryScale, LinearScale, LineController, LineElement, PointElement, Tooltip, Legend);

export interface ChartInstance {
  destroy(): void;
}

export type ChartFactory = (canvas: HTMLCanvasElement, configuration: ChartConfiguration<"line">) => ChartInstance;

export interface ChartRenderer {
  render(canvas: HTMLCanvasElement, data: CusumChartData): void;
  clear(): void;
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
        },
      },
    });
  }

  clear(): void {
    this.chart?.destroy();
    this.chart = null;
  }
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
