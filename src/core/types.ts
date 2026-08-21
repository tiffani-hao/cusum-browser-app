export type AnalysisInterval = "daily" | "weekly" | "monthly";

export interface RawTabularRecord {
  area?: unknown;
  date?: unknown;
  count?: unknown;
  risk_group?: unknown;
}

export interface AnalysisOptions {
  analysis_interval: AnalysisInterval;
  smoothing_window: number;
  baseline_window: number;
  k: number;
  threshold: number;
  group_by_risk_group: boolean;
}

export interface ValidatedInputRecord {
  area: string;
  date: string;
  count: number;
  risk_group?: string;
}

export interface ValidationIssue {
  code: string;
  message: string;
  field?: string;
  record_index?: number;
}

export type ValidationResult<T> =
  | { valid: true; value: T }
  | { valid: false; issues: ValidationIssue[] };

export interface IndependentSeriesDefinition {
  key: string;
  area: string;
  risk_group?: string;
}

export interface StandardizedRecord extends ValidatedInputRecord {
  series_key: string;
}

export type AggregatedRecord = StandardizedRecord;
export type CompletedPeriodRecord = AggregatedRecord;

export interface ProcessedCusumRecord {
  area: string;
  risk_group?: string;
  date: string;
  count: number;
  smoothed_count: number;
  baseline_mean: number;
  baseline_std: number;
  normalized_count: number;
  cusum: number;
  threshold: number;
  is_alert: boolean;
}

export interface AnalysisSummary {
  input_row_count: number;
  processed_row_count: number;
  independent_series_count: number;
  alert_count: number;
  maximum_cusum: number;
  analysis_interval: AnalysisInterval;
  smoothing_window: number;
  baseline_window: number;
  k: number;
  threshold: number;
  areas_included: number;
  risk_groups_included: string[];
  alerts_detected: number;
}

export type AnalysisResult =
  | { success: true; records: ProcessedCusumRecord[]; summary: AnalysisSummary }
  | { success: false; issues: ValidationIssue[] };

export interface GoldenFixture {
  fixture_name: string;
  scenario: string;
  analysis_options: AnalysisOptions;
  alert_comparison_rule: "cusum > threshold";
  independent_series_fields: string[];
  raw_records: RawTabularRecord[];
  input_row_count: number;
  processed_row_count: number;
  expected_records: ProcessedCusumRecord[];
  summary: {
    areas_included: number;
    risk_groups_included: string[];
    alerts_detected: number;
  };
}
