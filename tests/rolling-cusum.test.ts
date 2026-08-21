import { describe, expect, it } from "vitest";
import { analyzeCusum, DEFAULT_ANALYSIS_OPTIONS, trailingMean, trailingSampleStandardDeviation } from "../src/core";

describe("rolling statistics", () => {
  it("calculates trailing and early smoothing means", () => {
    expect(trailingMean([1, 5, 9], 0, 3)).toBe(1);
    expect(trailingMean([1, 5, 9], 1, 3)).toBe(3);
    expect(trailingMean([1, 5, 9], 2, 2)).toBe(7);
  });

  it("calculates sample standard deviation with ddof=1", () => {
    expect(trailingSampleStandardDeviation([1, 2, 3], 2, 3)).toBe(1);
  });

  it("replaces first-period and zero deviation with one", () => {
    expect(trailingSampleStandardDeviation([4], 0, 3)).toBe(1);
    expect(trailingSampleStandardDeviation([4, 4], 1, 3)).toBe(1);
  });
});

describe("CUSUM pipeline", () => {
  it("starts at zero and floors negative accumulation", () => {
    const result = analyzeCusum([
      { area: "A", date: "2024-01-01", count: 2 },
      { area: "A", date: "2024-01-02", count: 1 },
    ], { ...DEFAULT_ANALYSIS_OPTIONS, analysis_interval: "daily", smoothing_window: 1 });
    expect(result.success).toBe(true);
    if (result.success) expect(result.records.map((record) => record.cusum)).toEqual([0, 0]);
  });

  it("uses configurable K and strict configurable thresholds", () => {
    const records = [
      { area: "A", date: "2024-01-01", count: 1 },
      { area: "A", date: "2024-01-02", count: 10 },
    ];
    const result = analyzeCusum(records, {
      ...DEFAULT_ANALYSIS_OPTIONS,
      analysis_interval: "daily",
      smoothing_window: 1,
      baseline_window: 2,
      k: 0,
      threshold: 0.5,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.records[1]?.cusum).toBeCloseTo(Math.SQRT1_2);
      expect(result.records[1]?.is_alert).toBe(true);
    }
  });

  it("does not alert at exact equality", () => {
    const result = analyzeCusum([
      { area: "A", date: "2024-01-01", count: 0 },
    ], { ...DEFAULT_ANALYSIS_OPTIONS, analysis_interval: "daily", threshold: 0 });
    expect(result.success).toBe(true);
    if (result.success) expect(result.records[0]?.is_alert).toBe(false);
  });

  it("resets calculations between areas and risk groups", () => {
    const result = analyzeCusum([
      { area: "A", risk_group: "G1", date: "2024-01-01", count: 1 },
      { area: "A", risk_group: "G1", date: "2024-01-02", count: 10 },
      { area: "A", risk_group: "G2", date: "2024-01-01", count: 1 },
      { area: "B", risk_group: "G1", date: "2024-01-01", count: 1 },
    ], {
      ...DEFAULT_ANALYSIS_OPTIONS,
      analysis_interval: "daily",
      smoothing_window: 1,
      baseline_window: 2,
      k: 0,
      group_by_risk_group: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      const firstBySeries = result.records.filter((record, index, all) =>
        index === 0 ||
        record.area !== all[index - 1]?.area ||
        record.risk_group !== all[index - 1]?.risk_group
      );
      expect(firstBySeries.every((record) => record.cusum === 0)).toBe(true);
      expect(result.summary.independent_series_count).toBe(3);
    }
  });
});
