import { describe, expect, it } from "vitest";
import { aggregateDuplicates, standardizeRecords } from "../src/core/aggregation";
import { DEFAULT_ANALYSIS_OPTIONS } from "../src/core/constants";
import { fillMissingPeriods } from "../src/core/missing-periods";

describe("grouping and preprocessing", () => {
  it("aggregates duplicates and sorts by area and date", () => {
    const records = standardizeRecords([
      { area: "B", date: "2024-01-02", count: 1 },
      { area: "A", date: "2024-01-01", count: 2 },
      { area: "A", date: "2024-01-01", count: 3 },
    ], { ...DEFAULT_ANALYSIS_OPTIONS, analysis_interval: "daily" });
    const aggregated = aggregateDuplicates(records);
    expect(aggregated.map(({ area, date, count }) => ({ area, date, count }))).toEqual([
      { area: "A", date: "2024-01-01", count: 5 },
      { area: "B", date: "2024-01-02", count: 1 },
    ]);
  });

  it("separates risk groups when enabled", () => {
    const aggregated = aggregateDuplicates(standardizeRecords([
      { area: "A", risk_group: "G2", date: "2024-01-01", count: 2 },
      { area: "A", risk_group: "G1", date: "2024-01-01", count: 1 },
    ], { ...DEFAULT_ANALYSIS_OPTIONS, group_by_risk_group: true }));
    expect(aggregated.map((record) => record.risk_group)).toEqual(["G1", "G2"]);
  });

  it("ignores risk groups when grouping is disabled", () => {
    const aggregated = aggregateDuplicates(standardizeRecords([
      { area: "A", risk_group: "G1", date: "2024-01-01", count: 1 },
      { area: "A", risk_group: "G2", date: "2024-01-01", count: 2 },
    ], DEFAULT_ANALYSIS_OPTIONS));
    expect(aggregated).toHaveLength(1);
    expect(aggregated[0]?.count).toBe(3);
    expect(aggregated[0]?.risk_group).toBeUndefined();
  });

  it.each([
    ["daily", "2024-01-01", "2024-01-03", 3],
    ["weekly", "2024-01-01", "2024-01-15", 3],
    ["monthly", "2024-01-01", "2024-03-01", 3],
  ] as const)("fills missing %s periods per series", (interval, start, end, size) => {
    const aggregated = aggregateDuplicates(standardizeRecords([
      { area: "A", date: start, count: 1 },
      { area: "A", date: end, count: 2 },
    ], { ...DEFAULT_ANALYSIS_OPTIONS, analysis_interval: interval }));
    const completed = fillMissingPeriods(aggregated, interval);
    expect(completed).toHaveLength(size);
    expect(completed[1]?.count).toBe(0);
  });
});
