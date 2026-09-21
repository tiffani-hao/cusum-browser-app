import { describe, expect, it } from "vitest";
import type { AlertEpisode, ProcessedCusumRecord } from "../src/core";
import {
  createDefaultDisplayFilters,
  filterChartRecords,
  filterAlertEpisodes,
  filterProcessedRecords,
  independentSeries,
  MAX_DISPLAYED_CHART_SERIES,
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
  it("returns unique sorted area and strata options", () => {
    expect(uniqueAreas(records)).toEqual(["A", "B"]);
    expect(uniqueRiskGroups(records)).toEqual(["High", "Low"]);
  });

  it("returns independent series in deterministic area and strata order", () => {
    expect(independentSeries(records).map((series) => series.label)).toEqual([
      "A — High",
      "A — Low",
      "B — High",
    ]);
  });

  it("uses area-only labels when strata are absent", () => {
    expect(seriesLabel({ area: "Area A" })).toBe("Area A");
  });

  it("initially selects every series when fewer than 20 are available", () => {
    const filters = createDefaultDisplayFilters(records);
    expect(filters.selected_areas).toEqual(["A", "B"]);
    expect(filters.selected_risk_groups).toEqual(["High", "Low"]);
    expect(filters.selected_series).toHaveLength(3);
  });

  it("uses selected Areas directly for fewer than 20 non-stratified series", () => {
    const areaRecords = [
      makeRecord("Area A", "2024-01-01", false),
      makeRecord("Area B", "2024-01-01", false),
    ];
    const filters = createDefaultDisplayFilters(areaRecords);
    expect(filters.selected_areas).toEqual(["Area A", "Area B"]);
    expect(filters.selected_series).toEqual([]);
    expect(filterChartRecords(areaRecords, filters)).toEqual(areaRecords);
  });

  it("initially selects the first 20 non-stratified Areas in stable order", () => {
    const manyRecords = Array.from({ length: 25 }, (_, index) =>
      makeRecord(`Area ${String(index + 1).padStart(2, "0")}`, "2024-01-01", false)
    );
    const options = independentSeries(manyRecords);
    const filters = createDefaultDisplayFilters(manyRecords);
    expect(options).toHaveLength(25);
    expect(filters.selected_areas).toEqual(
      options.slice(0, MAX_DISPLAYED_CHART_SERIES).map((series) => series.area),
    );
    expect(filters.selected_series).toEqual([]);
  });

  it("initially selects the first 20 stratified series in stable order", () => {
    const manyRecords = Array.from({ length: 25 }, (_, index) =>
      makeRecord("Area A", "2024-01-01", false, `Group ${String(index + 1).padStart(2, "0")}`)
    );
    const options = independentSeries(manyRecords);
    const filters = createDefaultDisplayFilters(manyRecords);
    expect(options.map((series) => series.label).slice(0, 2)).toEqual([
      "Area A — Group 01",
      "Area A — Group 02",
    ]);
    expect(filters.selected_series).toEqual(
      options.slice(0, MAX_DISPLAYED_CHART_SERIES).map((series) => series.key),
    );
  });

  it("filters by area", () => {
    const filters = { ...createDefaultDisplayFilters(records), selected_areas: ["A"] };
    expect(filterProcessedRecords(records, filters).map((record) => record.area)).toEqual(["A", "A"]);
  });

  it("filters by strata", () => {
    const filters = { ...createDefaultDisplayFilters(records), selected_risk_groups: ["Low"] };
    expect(filterProcessedRecords(records, filters)).toHaveLength(1);
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

  it("shows the full history of selected series with active or inactive alert episodes", () => {
    const alertSeriesRecords = [
      makeRecord("A", "2024-01-01", false, "Group 1"),
      makeRecord("A", "2024-02-01", true, "Group 1"),
      makeRecord("A", "2024-03-01", false, "Group 1"),
      makeRecord("B", "2024-01-01", false, "Group 1"),
      makeRecord("B", "2024-02-01", false, "Group 1"),
      makeRecord("C", "2024-01-01", false, "Group 1"),
      makeRecord("C", "2024-02-01", true, "Group 1"),
    ];
    const defaults = createDefaultDisplayFilters(alertSeriesRecords);
    const filtered = filterChartRecords(alertSeriesRecords, {
      ...defaults,
      series_with_alerts_only: true,
    });
    expect(filtered.map((record) => `${record.area}/${record.date}/${record.is_alert}`)).toEqual([
      "A/2024-01-01/false",
      "A/2024-02-01/true",
      "A/2024-03-01/false",
      "C/2024-01-01/false",
      "C/2024-02-01/true",
    ]);
    expect(filterProcessedRecords(alertSeriesRecords, {
      ...defaults,
      series_with_alerts_only: true,
    })).toEqual(alertSeriesRecords);
  });

  it("finds alert series from the complete analysis outside the display date range", () => {
    const datedRecords = [
      makeRecord("A", "2024-01-01", true),
      makeRecord("A", "2024-02-01", false),
      makeRecord("B", "2024-02-01", false),
    ];
    const filters = {
      ...createDefaultDisplayFilters(datedRecords),
      series_with_alerts_only: true,
      start_date: "2024-02-01",
      end_date: "2024-02-01",
    };
    expect(filterChartRecords(datedRecords, filters)).toEqual([datedRecords[1]]);
  });

  it("applies the Area filter on top of selected alert series without changing selection", () => {
    const areaRecords = [
      makeRecord("A", "2024-01-01", true, "Group 1"),
      makeRecord("A", "2024-02-01", false, "Group 1"),
      makeRecord("B", "2024-01-01", true, "Group 1"),
      makeRecord("B", "2024-02-01", false, "Group 1"),
    ];
    const defaults = createDefaultDisplayFilters(areaRecords);
    const filters = {
      ...defaults,
      selected_areas: ["A"],
      series_with_alerts_only: true,
    };
    expect(filterChartRecords(areaRecords, filters).map((record) => record.area)).toEqual(["A", "A"]);
    expect(filters.selected_series).toEqual(defaults.selected_series);
  });

  it("returns an empty chart selection when no selected series has an alert episode", () => {
    const noAlertRecords = [
      makeRecord("A", "2024-01-01", false),
      makeRecord("B", "2024-01-01", false),
    ];
    expect(filterChartRecords(noAlertRecords, {
      ...createDefaultDisplayFilters(noAlertRecords),
      series_with_alerts_only: true,
    })).toEqual([]);
  });

  it("filters alert episodes by series fields and overlapping date range", () => {
    const episodes: AlertEpisode[] = [
      {
        area: "A",
        risk_group: "Low",
        start_date: "2024-01-01",
        end_date: "2024-03-01",
        periods: 3,
        total_cases: 8,
        is_active: false,
      },
      {
        area: "B",
        risk_group: "High",
        start_date: "2024-04-01",
        end_date: "2024-04-01",
        periods: 1,
        total_cases: 2,
        is_active: true,
      },
    ];
    const filters = {
      ...createDefaultDisplayFilters(records),
      selected_areas: ["A"],
      selected_risk_groups: ["Low"],
      start_date: "2024-02-01",
      end_date: "2024-02-28",
    };
    expect(filterAlertEpisodes(episodes, filters)).toEqual([episodes[0]]);
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
