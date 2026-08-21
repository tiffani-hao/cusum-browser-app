import type { ProcessedCusumRecord } from "../core";

export interface ResultDisplayFilters {
  selected_areas: string[];
  selected_risk_groups: string[];
  selected_series: string[];
  alert_only: boolean;
  start_date: string;
  end_date: string;
}

export interface ResultViewState {
  filters: ResultDisplayFilters;
  processed_page: number;
  processed_page_size: number;
  alert_page: number;
  alert_page_size: number;
  alerts_expanded: boolean;
  result_stale: boolean;
  export_message: string;
}

export interface SeriesOption {
  key: string;
  label: string;
  area: string;
  risk_group?: string;
}

export interface PaginatedRecords {
  records: ProcessedCusumRecord[];
  page: number;
  page_size: number;
  total_records: number;
  total_pages: number;
  range_start: number;
  range_end: number;
}

export interface ChartPointMetadata {
  series: string;
  date: string;
  count: number;
  cusum: number;
  is_alert: boolean;
}

export interface CusumChartDataset {
  label: string;
  data: (number | null)[];
  borderColor: string;
  backgroundColor: string;
  borderWidth: number;
  borderDash?: number[];
  pointBackgroundColor: string | string[];
  pointBorderColor: string | string[];
  pointRadius: number | number[];
  pointHoverRadius: number | number[];
  tension: number;
  spanGaps: boolean;
  records?: (ChartPointMetadata | null)[];
  threshold_line?: boolean;
}

export interface CusumChartData {
  labels: string[];
  datasets: CusumChartDataset[];
}

export type ExportResultType = "processed-results" | "filtered-results" | "alerts";
