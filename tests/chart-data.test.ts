import { describe, expect, it, vi } from "vitest";
import type { ChartConfiguration, TooltipItem } from "chart.js";
import type { ProcessedCusumRecord } from "../src/core";
import { buildCusumChartData, CusumChartController } from "../src/results";
import type { ChartFactory } from "../src/results";

const records: ProcessedCusumRecord[] = [
  record("B", "2024-01-02", 4, true),
  record("A", "2024-01-02", 5, false),
  record("A", "2024-01-01", 1, false),
];

describe("CUSUM chart data", () => {
  it("creates one deterministic dataset per independent series", () => {
    const data = buildCusumChartData(records, 3);
    expect(data.datasets.slice(0, -1).map((dataset) => dataset.label)).toEqual(["A", "B"]);
  });

  it("uses chronologically ordered ISO category labels", () => {
    expect(buildCusumChartData(records, 3).labels).toEqual(["2024-01-01", "2024-01-02"]);
  });

  it("creates exactly one dashed threshold dataset", () => {
    const data = buildCusumChartData(records, 3);
    const thresholds = data.datasets.filter((dataset) => dataset.threshold_line);
    expect(thresholds).toHaveLength(1);
    expect(thresholds[0]?.data).toEqual([3, 3]);
    expect(thresholds[0]?.borderDash).toEqual([8, 6]);
  });

  it("maps alert point styling only from is_alert without recalculation", () => {
    const data = buildCusumChartData(records, 3);
    const areaA = data.datasets[0]!;
    expect(areaA.pointRadius).toEqual([2, 2]);
    expect(areaA.records?.[1]?.cusum).toBe(5);
    expect(areaA.records?.[1]?.is_alert).toBe(false);
  });

  it("returns no threshold dataset for an empty result", () => {
    expect(buildCusumChartData([], 3)).toEqual({ labels: [], datasets: [] });
  });
});

describe("chart lifecycle", () => {
  it("creates a chart, destroys it before replacement, and clears it", () => {
    const destroyFirst = vi.fn();
    const destroySecond = vi.fn();
    const factory = vi.fn()
      .mockReturnValueOnce({ destroy: destroyFirst })
      .mockReturnValueOnce({ destroy: destroySecond });
    const controller = new CusumChartController(factory);
    const canvas = {} as HTMLCanvasElement;
    const data = buildCusumChartData(records, 3);
    controller.render(canvas, data);
    controller.render(canvas, data);
    expect(factory).toHaveBeenCalledTimes(2);
    expect(destroyFirst).toHaveBeenCalledOnce();
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
