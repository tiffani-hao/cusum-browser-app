import { describe, expect, it } from "vitest";
import type { ProcessedCusumRecord } from "../src/core";
import {
  createDefaultDisplayFilters,
  filterChartRecords,
  filterProcessedRecords,
  independentSeries,
  seriesLabel,
  uniqueAreas,
  uniqueRiskGroups,
} from "../src/results";

const records: ProcessedCusumRecord[] = [
  makeRecord("B", "2024-01-02", false, "High"),
  makeRecord("A", "2024-01-01", true, "Low"),
  makeRecord("A", "2024-01-02", false, "High"),
];

describe("result selectors and display filters", () => {
  it("returns unique sorted area and risk-group options", () => {
    expect(uniqueAreas(records)).toEqual(["A", "B"]);
    expect(uniqueRiskGroups(records)).toEqual(["High", "Low"]);
  });

  it("returns independent series in deterministic area and risk order", () => {
    expect(independentSeries(records).map((series) => series.label)).toEqual([
      "A — High",
      "A — Low",
      "B — High",
    ]);
  });

  it("uses area-only labels when risk groups are absent", () => {
    expect(seriesLabel({ area: "Area A" })).toBe("Area A");
  });

  it("initially selects every available option", () => {
    const filters = createDefaultDisplayFilters(records);
    expect(filters.selected_areas).toEqual(["A", "B"]);
    expect(filters.selected_risk_groups).toEqual(["High", "Low"]);
    expect(filters.selected_series).toHaveLength(3);
  });

  it("filters by area", () => {
    const filters = { ...createDefaultDisplayFilters(records), selected_areas: ["A"] };
    expect(filterProcessedRecords(records, filters).map((record) => record.area)).toEqual(["A", "A"]);
  });

  it("filters by risk group", () => {
    const filters = { ...createDefaultDisplayFilters(records), selected_risk_groups: ["Low"] };
    expect(filterProcessedRecords(records, filters)).toHaveLength(1);
  });

  it("filters alerts using the engine-provided flag", () => {
    const filters = { ...createDefaultDisplayFilters(records), alert_only: true };
    expect(filterProcessedRecords(records, filters)).toEqual([records[1]]);
  });

  it("filters an inclusive ISO date range", () => {
    const filters = {
      ...createDefaultDisplayFilters(records),
      start_date: "2024-01-02",
      end_date: "2024-01-02",
    };
    expect(filterProcessedRecords(records, filters)).toHaveLength(2);
  });

  it("applies explicit series visibility to chart records only", () => {
    const defaults = createDefaultDisplayFilters(records);
    const filters = { ...defaults, selected_series: [defaults.selected_series[0]!] };
    expect(filterChartRecords(records, filters)).toHaveLength(1);
    expect(filterProcessedRecords(records, filters)).toHaveLength(3);
  });
});

function makeRecord(area: string, date: string, isAlert: boolean, riskGroup?: string): ProcessedCusumRecord {
  return {
    area,
    ...(riskGroup === undefined ? {} : { risk_group: riskGroup }),
    date,
    count: 1,
    smoothed_count: 1,
    baseline_mean: 1,
    baseline_std: 1,
    normalized_count: 0,
    cusum: isAlert ? 4 : 0,
    threshold: 3,
    is_alert: isAlert,
  };
}

