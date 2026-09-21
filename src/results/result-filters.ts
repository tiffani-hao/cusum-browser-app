import { identifyAlertEpisodes } from "../core";
import type { AlertEpisode, ProcessedCusumRecord } from "../core";
import { independentSeries, seriesKey, uniqueAreas, uniqueRiskGroups } from "./result-selectors";
import type { ResultDisplayFilters, ResultViewState } from "./types";

export const MAX_DISPLAYED_CHART_SERIES = 20;

export function createDefaultDisplayFilters(records: ProcessedCusumRecord[]): ResultDisplayFilters {
  const series = independentSeries(records);
  const stratified = series.some((option) => option.risk_group !== undefined);
  const defaultSeries = series.slice(0, MAX_DISPLAYED_CHART_SERIES);
  return {
    selected_areas: stratified ? uniqueAreas(records) : defaultSeries.map((option) => option.area),
    selected_risk_groups: uniqueRiskGroups(records),
    selected_series: stratified ? defaultSeries.map((option) => option.key) : [],
    series_with_alerts_only: false,
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
      series_with_alerts_only: false,
      start_date: "",
      end_date: "",
    },
    processed_page: 1,
    processed_page_size: 25,
    alert_page: 1,
    alert_page_size: 25,
    alerts_expanded: false,
    show_inactive_alerts: false,
    result_stale: false,
    export_message: "",
  };
}

export function filterAlertEpisodes(
  episodes: readonly AlertEpisode[],
  filters: ResultDisplayFilters,
): AlertEpisode[] {
  const selectedAreas = new Set(filters.selected_areas);
  const selectedRiskGroups = new Set(filters.selected_risk_groups);
  return episodes.filter((episode) =>
    selectedAreas.has(episode.area) &&
    (episode.risk_group === undefined || selectedRiskGroups.has(episode.risk_group)) &&
    (filters.start_date === "" || episode.end_date >= filters.start_date) &&
    (filters.end_date === "" || episode.start_date <= filters.end_date)
  );
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
    (filters.start_date === "" || record.date >= filters.start_date) &&
    (filters.end_date === "" || record.date <= filters.end_date)
  );
}

export function filterChartRecords(
  records: ProcessedCusumRecord[],
  filters: ResultDisplayFilters,
): ProcessedCusumRecord[] {
  const stratified = records.some((record) => record.risk_group !== undefined);
  const selectedSeries = stratified ? new Set(filters.selected_series) : null;
  const seriesWithAlerts = filters.series_with_alerts_only
    ? new Set(identifyAlertEpisodes(records).map((episode) => seriesKey(episode)))
    : null;
  return filterProcessedRecords(records, filters).filter((record) => {
    const key = seriesKey(record);
    return (selectedSeries === null || selectedSeries.has(key)) &&
      (seriesWithAlerts === null || seriesWithAlerts.has(key));
  });
}

export function filterSelectedSeries(
  filteredRecords: ProcessedCusumRecord[],
  selectedSeriesKeys: string[],
): ProcessedCusumRecord[] {
  const selectedSeries = new Set(selectedSeriesKeys);
  return filteredRecords.filter((record) => selectedSeries.has(seriesKey(record)));
}
