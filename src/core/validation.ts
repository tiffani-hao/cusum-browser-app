import { ANALYSIS_INTERVALS } from "./constants";
import { parseIsoDate } from "./dates";
import type {
  AnalysisInterval,
  AnalysisOptions,
  RawTabularRecord,
  ValidatedInputRecord,
  ValidationIssue,
  ValidationResult,
} from "./types";

function issue(code: string, message: string, field?: string, recordIndex?: number): ValidationIssue {
  return {
    code,
    message,
    ...(field === undefined ? {} : { field }),
    ...(recordIndex === undefined ? {} : { record_index: recordIndex }),
  };
}

export function validateOptions(value: unknown): ValidationResult<AnalysisOptions> {
  if (typeof value !== "object" || value === null) {
    return { valid: false, issues: [issue("invalid_options", "Analysis options must be an object.")] };
  }
  const options = value as Record<string, unknown>;
  const issues: ValidationIssue[] = [];
  const interval = options.analysis_interval;
  if (typeof interval !== "string" || !ANALYSIS_INTERVALS.includes(interval as AnalysisInterval)) {
    issues.push(issue("invalid_interval", "Analysis interval must be daily, weekly, or monthly.", "analysis_interval"));
  }
  for (const [field, label] of [
    ["smoothing_window", "Smoothing window"],
    ["baseline_window", "Baseline window"],
  ] as const) {
    const candidate = options[field];
    if (typeof candidate !== "number" || !Number.isInteger(candidate) || candidate <= 0) {
      issues.push(issue(`invalid_${field}`, `${label} must be a positive integer.`, field));
    }
  }
  for (const [field, label] of [["k", "K"], ["threshold", "Threshold"]] as const) {
    const candidate = options[field];
    if (typeof candidate !== "number" || !Number.isFinite(candidate) || candidate < 0) {
      issues.push(issue(`invalid_${field}`, `${label} must be finite and nonnegative.`, field));
    }
  }
  if (typeof options.group_by_risk_group !== "boolean") {
    issues.push(issue("invalid_group_by_risk_group", "Risk-group grouping must be a boolean.", "group_by_risk_group"));
  }
  if (issues.length > 0) return { valid: false, issues };
  return { valid: true, value: options as unknown as AnalysisOptions };
}

export function validateRecords(value: unknown): ValidationResult<ValidatedInputRecord[]> {
  if (!Array.isArray(value) || value.length === 0) {
    return { valid: false, issues: [issue("empty_input", "At least one input record is required.")] };
  }
  const issues: ValidationIssue[] = [];
  const records: ValidatedInputRecord[] = [];
  value.forEach((candidate: unknown, index) => {
    if (typeof candidate !== "object" || candidate === null) {
      issues.push(issue("invalid_record", "Record must be an object.", undefined, index));
      return;
    }
    const record = candidate as RawTabularRecord;
    const area = record.area;
    const date = record.date;
    const count = record.count;
    if (area === undefined) issues.push(issue("missing_area", "Area is required.", "area", index));
    else if (typeof area !== "string" || area.trim() === "") issues.push(issue("empty_area", "Area must be a nonempty string.", "area", index));
    if (date === undefined) issues.push(issue("missing_date", "Date is required.", "date", index));
    else if (typeof date !== "string" || parseIsoDate(date) === null) issues.push(issue("invalid_date", "Date must be a valid ISO calendar date.", "date", index));
    if (count === undefined) issues.push(issue("missing_count", "Count is required.", "count", index));
    else if (typeof count !== "number") issues.push(issue("nonnumeric_count", "Count must be numeric.", "count", index));
    else if (!Number.isFinite(count)) issues.push(issue("nonfinite_count", "Count must be finite.", "count", index));
    else if (count < 0) issues.push(issue("negative_count", "Count must be nonnegative.", "count", index));

    if (
      typeof area === "string" && area.trim() !== "" &&
      typeof date === "string" && parseIsoDate(date) !== null &&
      typeof count === "number" && Number.isFinite(count) && count >= 0
    ) {
      const riskGroup = record.risk_group;
      records.push({
        area: area.trim(),
        date,
        count,
        ...(riskGroup === undefined || riskGroup === null ? {} : { risk_group: String(riskGroup).trim() }),
      });
    }
  });
  return issues.length > 0 ? { valid: false, issues } : { valid: true, value: records };
}
