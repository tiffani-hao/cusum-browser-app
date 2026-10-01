import { describe, expect, it } from "vitest";
import { analyzeCusum } from "../src/core";
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

  it.each([
    ["daily", "2024-01-01", "2024-01-02", "2024-01-03"],
    ["weekly", "2024-01-01", "2024-01-08", "2024-01-15"],
    ["monthly", "2024-01-01", "2024-02-01", "2024-03-01"],
  ] as const)("completes every %s series across the global date range", (interval, start, middle, end) => {
    const aggregated = aggregateDuplicates(standardizeRecords([
      { area: "A", date: start, count: 1 },
      { area: "A", date: end, count: 2 },
      { area: "B", date: middle, count: 5 },
    ], { ...DEFAULT_ANALYSIS_OPTIONS, analysis_interval: interval }));

    const completed = fillMissingPeriods(aggregated, interval);
    expect(completed.filter((record) => record.area === "B").map(({ date, count }) => ({ date, count })))
      .toEqual([
        { date: start, count: 0 },
        { date: middle, count: 5 },
        { date: end, count: 0 },
      ]);
  });

  it("adds trailing monthly zero records before CUSUM calculation", () => {
    const result = analyzeCusum([
      { area: "Pierce", date: "2026-05-01", count: 3 },
      { area: "Pierce", date: "2026-06-01", count: 2 },
      { area: "Pierce", date: "2026-07-01", count: 4 },
      { area: "Pierce", date: "2026-08-01", count: 2 },
      { area: "Pierce", date: "2026-09-01", count: 3 },
      { area: "Pierce", date: "2026-10-01", count: 2 },
      { area: "King", date: "2026-05-01", count: 1 },
      { area: "King", date: "2026-06-01", count: 2 },
    ], { ...DEFAULT_ANALYSIS_OPTIONS, analysis_interval: "monthly" });

    expect(result.success).toBe(true);
    if (!result.success) return;
    const kingRecords = result.records.filter((record) => record.area === "King");
    expect(kingRecords.map(({ date, count }) => ({ date, count })))
      .toEqual([
        { date: "2026-05-01", count: 1 },
        { date: "2026-06-01", count: 2 },
        { date: "2026-07-01", count: 0 },
        { date: "2026-08-01", count: 0 },
        { date: "2026-09-01", count: 0 },
        { date: "2026-10-01", count: 0 },
      ]);
    expect(kingRecords[2]).toMatchObject({
      date: "2026-07-01",
      count: 0,
      smoothed_count: 1,
      baseline_mean: 1,
      normalized_count: 0,
      cusum: 0,
      is_alert: false,
    });
    expect(result.summary.processed_row_count).toBe(12);
  });

  it("completes each Area–Strata series across the global monthly range", () => {
    const result = analyzeCusum([
      { area: "Pierce", risk_group: "Group 1", date: "2026-05-01", count: 3 },
      { area: "Pierce", risk_group: "Group 1", date: "2026-10-01", count: 2 },
      { area: "King", risk_group: "Group 1", date: "2026-05-01", count: 1 },
      { area: "King", risk_group: "Group 1", date: "2026-06-01", count: 2 },
      { area: "King", risk_group: "Group 2", date: "2026-06-01", count: 4 },
      { area: "King", risk_group: "Group 2", date: "2026-10-01", count: 5 },
    ], {
      ...DEFAULT_ANALYSIS_OPTIONS,
      analysis_interval: "monthly",
      group_by_risk_group: true,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    const groupOne = result.records.filter((record) =>
      record.area === "King" && record.risk_group === "Group 1"
    );
    const groupTwo = result.records.filter((record) =>
      record.area === "King" && record.risk_group === "Group 2"
    );
    expect(groupOne.map(({ date, count }) => ({ date, count }))).toEqual([
      { date: "2026-05-01", count: 1 },
      { date: "2026-06-01", count: 2 },
      { date: "2026-07-01", count: 0 },
      { date: "2026-08-01", count: 0 },
      { date: "2026-09-01", count: 0 },
      { date: "2026-10-01", count: 0 },
    ]);
    expect(groupTwo.map(({ date, count }) => ({ date, count }))).toEqual([
      { date: "2026-05-01", count: 0 },
      { date: "2026-06-01", count: 4 },
      { date: "2026-07-01", count: 0 },
      { date: "2026-08-01", count: 0 },
      { date: "2026-09-01", count: 0 },
      { date: "2026-10-01", count: 5 },
    ]);
    expect(result.summary.processed_row_count).toBe(18);
  });
});
