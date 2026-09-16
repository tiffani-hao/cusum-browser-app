// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import type { ChartConfiguration, TooltipItem } from "chart.js";
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
  it("creates one deterministic dataset per independent series", () => {
    const data = buildCusumChartData(records, 3);
    expect(data.datasets.slice(0, -1).map((dataset) => dataset.label)).toEqual(["A", "B"]);
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
    const areaA = data.datasets[0]!;
    const areaB = data.datasets[1]!;
    expect(areaA.pointRadius).toEqual([2, 2, 5, 2]);
    expect(areaA.records?.[3]?.cusum).toBe(5);
    expect(areaA.records?.[3]?.is_alert).toBe(false);
    expect((areaB.pointRadius as number[])[3]).toBe(5);
  });

  it("shades the configured initial baseline window without hiding chart data", () => {
    const data = buildCusumChartData(records, 3, 3);
    expect(data.datasets[0]?.data).toEqual([1, 2, 3, 5]);
    expect(data.datasets[1]?.data).toEqual([0, 1, 2, 4]);
    expect(data.datasets[0]?.records?.slice(0, 3).every((record) => record !== null)).toBe(true);
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
    expect(data.datasets[0]?.data).toEqual([3, 5]);
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

  it("configures a zero-minimum CUSUM axis and hides an unbounded legend", () => {
    const configurations: ChartConfiguration<"line">[] = [];
    const factory: ChartFactory = vi.fn((_canvas, configuration) => {
      configurations.push(configuration);
      return { destroy: vi.fn() };
    });
    new CusumChartController(factory).render({} as HTMLCanvasElement, buildCusumChartData(records, 3));
    const configuration = configurations[0];
    expect(configuration?.options?.scales?.y).toMatchObject({ min: 0 });
    expect(configuration?.options?.plugins?.legend?.display).toBe(false);
    expect(configuration?.plugins?.map((plugin) => plugin.id)).toContain("initial-baseline-period");
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

  it("preserves detailed hover tooltip values from calculated records", () => {
    const configurations: ChartConfiguration<"line">[] = [];
    const factory: ChartFactory = vi.fn((_canvas, configuration) => {
      configurations.push(configuration);
      return { destroy: vi.fn() };
    });
    const data = buildCusumChartData(records, 3);
    new CusumChartController(factory).render({} as HTMLCanvasElement, data);
    const label = configurations[0]?.options?.plugins?.tooltip?.callbacks?.label;
    expect(label).toBeTypeOf("function");
    const lines = (label as (item: TooltipItem<"line">) => string[])({
      dataset: data.datasets[0],
      dataIndex: 0,
      raw: 1,
    } as unknown as TooltipItem<"line">);
    expect(lines).toEqual([
      "Series: A",
      "Date: 2024-01-01",
      "Count: 2",
      "CUSUM: 1",
      "Alert: No",
    ]);
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
