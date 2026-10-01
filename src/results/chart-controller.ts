import {
  CategoryScale,
  Chart,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import type { ChartConfiguration, Plugin, TooltipItem, TooltipModel } from "chart.js";
import type {} from "chartjs-plugin-zoom";
import type {
  ChartInitialBaselineBand,
  CusumChartData,
  CusumChartDataset,
} from "./types";
import { formatCusumForDisplay } from "./table-data";

Chart.register(
  CategoryScale,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
  Filler,
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
  private tooltip: HTMLElement | null = null;

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
        interaction: { mode: "index", axis: "x", intersect: false },
        scales: {
          x: {
            type: "category",
            title: { display: true, text: "Date", color: "#41206b" },
            ticks: { color: "#645b70" },
            grid: { color: "#eee8f6" },
          },
          cases: {
            type: "linear",
            position: "left",
            min: 0,
            title: { display: true, text: "Disease Count / Cases", color: "#41206b" },
            ticks: { color: "#645b70" },
            grid: { color: "#eee8f6" },
          },
          cusum: {
            type: "linear",
            position: "right",
            min: 0,
            title: { display: true, text: "CUSUM", color: "#41206b" },
            ticks: { color: "#645b70" },
            grid: { drawOnChartArea: false },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: false,
            mode: "index",
            intersect: false,
            position: "nearest",
            filter: (item) => (item.dataset as unknown as CusumChartDataset).dataset_kind === "cusum",
            external: ({ tooltip }) => this.renderTooltip(canvas, tooltip),
            callbacks: {
              title: (items) => items[0]?.label === undefined ? "" : `Date: ${items[0].label}`,
              label: (item: TooltipItem<"line">) => tooltipLines(item),
              footer: () => `Alert threshold: ${formatCusumForDisplay(thresholdValue(data))}`,
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
      plugins: [
        initialBaselinePeriodPlugin(data.initial_baseline_bands),
        verticalHoverGuidePlugin(),
      ],
    });
  }

  clear(): void {
    this.chart?.destroy();
    this.chart = null;
    this.tooltip?.remove();
    this.tooltip = null;
  }

  resize(): void {
    this.chart?.resize?.();
  }

  resetZoom(): void {
    this.chart?.resetZoom?.();
  }

  private renderTooltip(canvas: HTMLCanvasElement, model: TooltipModel<"line">): void {
    const tooltip = this.tooltip ?? createChartTooltip();
    if (this.tooltip === null) {
      this.tooltip = tooltip;
      (canvas.parentElement ?? canvas).append(tooltip);
    }
    if (model.opacity === 0) {
      if (!tooltip.matches(":hover")) tooltip.hidden = true;
      return;
    }

    const header = requiredTooltipPart(tooltip, ".chart-tooltip-header");
    const body = requiredTooltipPart(tooltip, ".chart-tooltip-body");
    const footer = requiredTooltipPart(tooltip, ".chart-tooltip-footer");
    header.replaceChildren(...model.title.map((line) => tooltipLine(line)));
    body.replaceChildren(...model.body.map((item) => {
      const group = document.createElement("div");
      group.className = "chart-tooltip-item";
      group.append(...item.before.map((line) => tooltipLine(line)));
      group.append(...item.lines.map((line) => tooltipLine(line)));
      group.append(...item.after.map((line) => tooltipLine(line)));
      return group;
    }));
    footer.replaceChildren(...model.footer.map((line) => tooltipLine(line)));
    footer.hidden = model.footer.length === 0;
    tooltip.hidden = false;

    const canvasRect = canvas.getBoundingClientRect();
    const parent = tooltip.parentElement;
    if (parent === null) return;
    const parentRect = parent.getBoundingClientRect();
    const viewportRect = canvas.closest<HTMLElement>(".chart-viewport")?.getBoundingClientRect();
    const visibleLeft = Math.max(canvasRect.left, viewportRect?.left ?? canvasRect.left, 0);
    const visibleRight = Math.min(canvasRect.right, viewportRect?.right ?? canvasRect.right, window.innerWidth);
    const visibleTop = Math.max(canvasRect.top, viewportRect?.top ?? canvasRect.top, 0);
    const visibleBottom = Math.min(canvasRect.bottom, viewportRect?.bottom ?? canvasRect.bottom, window.innerHeight);
    const availableHeight = Math.max(96, visibleBottom - visibleTop - 16);
    tooltip.style.maxHeight = `${availableHeight}px`;

    const tooltipRect = tooltip.getBoundingClientRect();
    const gap = 12;
    const anchorX = canvasRect.left + model.caretX;
    const anchorY = canvasRect.top + model.caretY;
    let left = anchorX + gap;
    if (left + tooltipRect.width > visibleRight) left = anchorX - tooltipRect.width - gap;
    left = clamp(left, visibleLeft, Math.max(visibleLeft, visibleRight - tooltipRect.width));
    let top = anchorY + gap;
    if (top + tooltipRect.height > visibleBottom) top = anchorY - tooltipRect.height - gap;
    top = clamp(top, visibleTop, Math.max(visibleTop, visibleBottom - tooltipRect.height));
    tooltip.style.left = `${left - parentRect.left}px`;
    tooltip.style.top = `${top - parentRect.top}px`;
  }
}

function createChartTooltip(): HTMLElement {
  const tooltip = document.createElement("div");
  tooltip.className = "chart-tooltip";
  tooltip.hidden = true;
  tooltip.setAttribute("role", "tooltip");
  tooltip.innerHTML = `
    <div class="chart-tooltip-header"></div>
    <div class="chart-tooltip-body"></div>
    <div class="chart-tooltip-footer"></div>
  `;
  tooltip.addEventListener("mouseleave", () => {
    tooltip.hidden = true;
  });
  return tooltip;
}

function requiredTooltipPart(tooltip: HTMLElement, selector: string): HTMLElement {
  const part = tooltip.querySelector<HTMLElement>(selector);
  if (part === null) throw new Error(`Missing chart tooltip element: ${selector}`);
  return part;
}

function tooltipLine(text: string): HTMLElement {
  const line = document.createElement("div");
  line.textContent = text;
  return line;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
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
  const record = dataset.records?.[item.dataIndex];
  if (record === null || record === undefined) return dataset.label;
  return [
    `Area: ${record.area}`,
    ...(record.risk_group === undefined ? [] : [`Strata: ${record.risk_group}`]),
    `Count: ${record.count}`,
    `CUSUM: ${formatCusumForDisplay(record.cusum)}`,
    `Alert: ${record.is_alert ? "Yes" : "No"}`,
  ];
}

function thresholdValue(data: CusumChartData): number {
  const threshold = data.datasets.find((dataset) => dataset.dataset_kind === "threshold")?.data[0];
  return typeof threshold === "number" ? threshold : 0;
}

function verticalHoverGuidePlugin(): Plugin<"line"> {
  return {
    id: "vertical-hover-guide",
    afterDatasetsDraw(chart) {
      const active = chart.getActiveElements();
      const x = active[0]?.element.x;
      if (x === undefined) return;
      const { top, bottom } = chart.chartArea;
      chart.ctx.save();
      chart.ctx.beginPath();
      chart.ctx.setLineDash([3, 3]);
      chart.ctx.moveTo(x, top);
      chart.ctx.lineTo(x, bottom);
      chart.ctx.lineWidth = 1;
      chart.ctx.strokeStyle = "rgba(65, 32, 107, 0.48)";
      chart.ctx.stroke();
      chart.ctx.restore();
    },
  };
}
