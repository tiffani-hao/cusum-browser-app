// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import type { ChartConfiguration, ChartData, TooltipItem } from "chart.js";
import type { ProcessedCusumRecord } from "../src/core";
import { buildCusumChartData, CusumChartController } from "../src/results";
import type { ChartFactory } from "../src/results";

const records: ProcessedCusumRecord[] = [
  record("B", "2024-01-04", 4, true),
  record("A", "2024-01-04", 5, false),
  record("A", "2024-01-03", 3, true),
  record("A", "2024-01-02", 2, false),
  record("A", "2024-01-01", 1, false),
  record("B", "2024-01-03", 2, true),
  record("B", "2024-01-02", 1, false),
  record("B", "2024-01-01", 0, false),
];

describe("CUSUM chart data", () => {
  it("creates deterministic count and CUSUM datasets for every independent series", () => {
    const data = buildCusumChartData(records, 3);
    expect(data.datasets.filter((dataset) => dataset.dataset_kind === "count").map((dataset) => dataset.label))
      .toEqual(["A — Disease count", "B — Disease count"]);
    expect(data.datasets.filter((dataset) => dataset.dataset_kind === "cusum").map((dataset) => dataset.label))
      .toEqual(["A", "B"]);
  });

  it("uses processed counts, including zeros, with a subtle baseline fill", () => {
    const completed = [
      { ...record("A", "2024-01-01", 0, false), count: 4 },
      { ...record("A", "2024-01-02", 0, false), count: 0 },
    ];
    const count = buildCusumChartData(completed, 3).datasets.find((dataset) =>
      dataset.dataset_kind === "count"
    );
    expect(count).toMatchObject({
      data: [4, 0],
      fill: "origin",
      yAxisID: "cases",
      pointRadius: 0,
      pointHoverRadius: 0,
    });
    expect(count?.backgroundColor).toContain("0.08");
  });

  it("uses chronologically ordered ISO category labels", () => {
    expect(buildCusumChartData(records, 3).labels).toEqual([
      "2024-01-01",
      "2024-01-02",
      "2024-01-03",
      "2024-01-04",
    ]);
  });

  it("creates exactly one dashed threshold dataset", () => {
    const data = buildCusumChartData(records, 3);
    const thresholds = data.datasets.filter((dataset) => dataset.threshold_line);
    expect(thresholds).toHaveLength(1);
    expect(thresholds[0]?.data).toEqual([3, 3, 3, 3]);
    expect(thresholds[0]?.borderDash).toEqual([8, 6]);
  });

  it("maps alert point styling only from is_alert without recalculation", () => {
    const data = buildCusumChartData(records, 3);
    const areaA = data.datasets.find((dataset) => dataset.dataset_kind === "cusum" && dataset.label === "A")!;
    const areaB = data.datasets.find((dataset) => dataset.dataset_kind === "cusum" && dataset.label === "B")!;
    expect(areaA.pointRadius).toEqual([1, 1, 3.5, 1]);
    expect(areaA.records?.[3]?.cusum).toBe(5);
    expect(areaA.records?.[3]?.is_alert).toBe(false);
    expect((areaB.pointRadius as number[])[3]).toBe(3.5);
  });

  it("shades the configured initial baseline window without hiding chart data", () => {
    const data = buildCusumChartData(records, 3, 3);
    const cusum = data.datasets.filter((dataset) => dataset.dataset_kind === "cusum");
    expect(cusum[0]?.data).toEqual([1, 2, 3, 5]);
    expect(cusum[1]?.data).toEqual([0, 1, 2, 4]);
    expect(cusum[0]?.records?.slice(0, 3).every((record) => record !== null)).toBe(true);
    expect(data.initial_baseline_bands).toEqual([{ start_index: 0, end_index: 2 }]);
  });

  it("derives the shaded length from the selected baseline window", () => {
    expect(buildCusumChartData(records, 3, 2).initial_baseline_bands).toEqual([
      { start_index: 0, end_index: 1 },
    ]);
  });

  it("does not restart the initial baseline window when display filters hide earlier dates", () => {
    const visible = records.filter((record) => record.date >= "2024-01-03");
    const data = buildCusumChartData(visible, 3, 3, records);

    expect(data.labels).toEqual(["2024-01-03", "2024-01-04"]);
    expect(data.initial_baseline_bands).toEqual([{ start_index: 0, end_index: 0 }]);
    expect(data.datasets.find((dataset) => dataset.dataset_kind === "cusum")?.data).toEqual([3, 5]);
  });

  it("returns no threshold dataset for an empty result", () => {
    expect(buildCusumChartData([], 3, 36)).toEqual({ labels: [], datasets: [], initial_baseline_bands: [] });
  });
});

describe("chart lifecycle", () => {
  it("creates a chart, destroys it before replacement, and clears it", () => {
    const destroyFirst = vi.fn();
    const destroySecond = vi.fn();
    const resizeSecond = vi.fn();
    const resetZoomSecond = vi.fn();
    const factory = vi.fn()
      .mockReturnValueOnce({ destroy: destroyFirst })
      .mockReturnValueOnce({ destroy: destroySecond, resize: resizeSecond, resetZoom: resetZoomSecond });
    const controller = new CusumChartController(factory);
    const canvas = {} as HTMLCanvasElement;
    const data = buildCusumChartData(records, 3);
    controller.render(canvas, data);
    controller.render(canvas, data);
    expect(factory).toHaveBeenCalledTimes(2);
    expect(destroyFirst).toHaveBeenCalledOnce();
    controller.resize();
    expect(resizeSecond).toHaveBeenCalledOnce();
    controller.resetZoom();
    expect(resetZoomSecond).toHaveBeenCalledOnce();
    controller.clear();
    expect(destroySecond).toHaveBeenCalledOnce();
  });

  it("configures separate zero-minimum count and CUSUM axes and hides an unbounded legend", () => {
    const configurations: ChartConfiguration<"line">[] = [];
    const factory: ChartFactory = vi.fn((_canvas, configuration) => {
      configurations.push(configuration);
      return { destroy: vi.fn() };
    });
    new CusumChartController(factory).render({} as HTMLCanvasElement, buildCusumChartData(records, 3));
    const configuration = configurations[0];
    expect(configuration?.options?.scales?.cases).toMatchObject({
      min: 0,
      position: "left",
      title: { text: "Disease Count / Cases" },
    });
    expect(configuration?.options?.scales?.cusum).toMatchObject({
      min: 0,
      position: "right",
      title: { text: "CUSUM" },
    });
    expect(configuration?.options?.plugins?.legend?.display).toBe(false);
    expect(configuration?.plugins?.map((plugin) => plugin.id)).toEqual([
      "initial-baseline-period",
      "vertical-hover-guide",
    ]);
  });

  it("uses native shared x-index interaction without requiring point intersection", () => {
    const configurations: ChartConfiguration<"line">[] = [];
    const factory: ChartFactory = vi.fn((_canvas, configuration) => {
      configurations.push(configuration);
      return { destroy: vi.fn() };
    });
    const data = buildCusumChartData(records, 3);
    new CusumChartController(factory).render({} as HTMLCanvasElement, data);
    expect(configurations[0]?.options?.interaction).toMatchObject({
      mode: "index",
      axis: "x",
      intersect: false,
    });
    expect(configurations[0]?.options?.plugins?.tooltip).toMatchObject({
      enabled: false,
      mode: "index",
      intersect: false,
      position: "nearest",
    });
    expect(configurations[0]?.options?.plugins?.tooltip?.external).toBeTypeOf("function");
    const filter = configurations[0]?.options?.plugins?.tooltip?.filter;
    expect(filter).toBeTypeOf("function");
    const count = data.datasets.find((dataset) => dataset.dataset_kind === "count")!;
    const cusum = data.datasets.find((dataset) => dataset.dataset_kind === "cusum")!;
    const threshold = data.datasets.find((dataset) => dataset.dataset_kind === "threshold")!;
    const item = (dataset: typeof count) => ({ dataset } as unknown as TooltipItem<"line">);
    const chartData = data as unknown as ChartData<"line">;
    expect(filter?.(item(count), 0, [], chartData)).toBe(false);
    expect(filter?.(item(cusum), 0, [], chartData)).toBe(true);
    expect(filter?.(item(threshold), 0, [], chartData)).toBe(false);
  });

  it("configures local x-axis zoom, pinch, drag zoom, and Shift-drag panning", () => {
    const configurations: ChartConfiguration<"line">[] = [];
    const factory: ChartFactory = vi.fn((_canvas, configuration) => {
      configurations.push(configuration);
      return { destroy: vi.fn() };
    });
    new CusumChartController(factory).render({} as HTMLCanvasElement, buildCusumChartData(records, 3));
    expect(configurations[0]?.options?.plugins?.zoom).toMatchObject({
      limits: { x: { min: "original", max: "original", minRange: 1 } },
      pan: { enabled: true, mode: "x", modifierKey: "shift" },
      zoom: {
        mode: "x",
        wheel: { enabled: true, modifierKey: "ctrl" },
        pinch: { enabled: true },
        drag: { enabled: true },
      },
    });
  });

  it("groups count, CUSUM, strata, and alert status in the shared tooltip", () => {
    const configurations: ChartConfiguration<"line">[] = [];
    const factory: ChartFactory = vi.fn((_canvas, configuration) => {
      configurations.push(configuration);
      return { destroy: vi.fn() };
    });
    const preciseRecords = [{
      ...record("A", "2024-01-01", 4.829374923, false),
      risk_group: "Group 1",
    }];
    const data = buildCusumChartData(preciseRecords, 3);
    new CusumChartController(factory).render({} as HTMLCanvasElement, data);
    const callbacks = configurations[0]?.options?.plugins?.tooltip?.callbacks;
    const label = callbacks?.label;
    expect(label).toBeTypeOf("function");
    const cusum = data.datasets.find((dataset) => dataset.dataset_kind === "cusum")!;
    const lines = (label as (item: TooltipItem<"line">) => string[])({
      dataset: cusum,
      dataIndex: 0,
      raw: 1,
    } as unknown as TooltipItem<"line">);
    expect(lines).toEqual([
      "Area: A",
      "Strata: Group 1",
      "Count: 2",
      "CUSUM: 4.83",
      "Alert: No",
    ]);
    const title = callbacks?.title as ((items: TooltipItem<"line">[]) => string) | undefined;
    expect(title?.([{ label: "2024-01-01" } as TooltipItem<"line">])).toBe("Date: 2024-01-01");
    const footer = callbacks?.footer as (() => string) | undefined;
    expect(footer?.()).toBe("Alert threshold: 3.00");
    expect(preciseRecords[0]?.cusum).toBe(4.829374923);
  });

  it("draws a snapped vertical guide through the active chart index", () => {
    const configurations: ChartConfiguration<"line">[] = [];
    const factory: ChartFactory = vi.fn((_canvas, configuration) => {
      configurations.push(configuration);
      return { destroy: vi.fn() };
    });
    new CusumChartController(factory).render({} as HTMLCanvasElement, buildCusumChartData(records, 3));
    const guide = configurations[0]?.plugins?.find((plugin) => plugin.id === "vertical-hover-guide");
    const context = {
      save: vi.fn(),
      beginPath: vi.fn(),
      setLineDash: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      restore: vi.fn(),
      lineWidth: 0,
      strokeStyle: "",
    };
    const draw = guide?.afterDatasetsDraw as unknown as (chart: unknown) => void;
    draw({
      getActiveElements: () => [{ element: { x: 42 } }],
      chartArea: { top: 10, bottom: 90 },
      ctx: context,
    });
    expect(context.moveTo).toHaveBeenCalledWith(42, 10);
    expect(context.lineTo).toHaveBeenCalledWith(42, 90);
    expect(context.setLineDash).toHaveBeenCalledWith([3, 3]);
    expect(context.stroke).toHaveBeenCalledOnce();
  });
});

function record(area: string, date: string, cusum: number, isAlert: boolean): ProcessedCusumRecord {
  return {
    area,
    date,
    count: 2,
    smoothed_count: 2,
    baseline_mean: 1,
    baseline_std: 1,
    normalized_count: 1,
    cusum,
    threshold: 3,
    is_alert: isAlert,
  };
}
