import type { ProcessedCusumRecord } from "../core";
import { independentSeries, seriesKey, uniqueAreas, uniqueRiskGroups } from "./result-selectors";
import type { ResultDisplayFilters, ResultViewState } from "./types";

export function createDefaultDisplayFilters(records: ProcessedCusumRecord[]): ResultDisplayFilters {
  return {
    selected_areas: uniqueAreas(records),
    selected_risk_groups: uniqueRiskGroups(records),
    selected_series: independentSeries(records).map((series) => series.key),
    alert_only: false,
    start_date: "",
    end_date: "",
  };
}

export function createInitialResultViewState(): ResultViewState {
  return {
    filters: {
      selected_areas: [],
      selected_risk_groups: [],
      selected_series: [],
      alert_only: false,
      start_date: "",
      end_date: "",
    },
    processed_page: 1,
    processed_page_size: 25,
    alert_page: 1,
    alert_page_size: 25,
    alerts_expanded: false,
    result_stale: false,
    export_message: "",
  };
}

export function createCompletedResultViewState(records: ProcessedCusumRecord[]): ResultViewState {
  return {
    ...createInitialResultViewState(),
    filters: createDefaultDisplayFilters(records),
  };
}

export function filterProcessedRecords(
  records: ProcessedCusumRecord[],
  filters: ResultDisplayFilters,
): ProcessedCusumRecord[] {
  const selectedAreas = new Set(filters.selected_areas);
  const selectedRiskGroups = new Set(filters.selected_risk_groups);
  return records.filter((record) =>
    selectedAreas.has(record.area) &&
    (record.risk_group === undefined || selectedRiskGroups.has(record.risk_group)) &&
    (!filters.alert_only || record.is_alert) &&
    (filters.start_date === "" || record.date >= filters.start_date) &&
    (filters.end_date === "" || record.date <= filters.end_date)
  );
}

export function filterChartRecords(
  records: ProcessedCusumRecord[],
  filters: ResultDisplayFilters,
): ProcessedCusumRecord[] {
  const selectedSeries = new Set(filters.selected_series);
  return filterProcessedRecords(records, filters).filter((record) => selectedSeries.has(seriesKey(record)));
}

export function filterSelectedSeries(
  filteredRecords: ProcessedCusumRecord[],
  selectedSeriesKeys: string[],
): ProcessedCusumRecord[] {
  const selectedSeries = new Set(selectedSeriesKeys);
  return filteredRecords.filter((record) => selectedSeries.has(seriesKey(record)));
}
