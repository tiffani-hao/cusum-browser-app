import { aggregateDuplicates, standardizeRecords } from "./aggregation";
import { calculateSeries } from "./cusum";
import { fillMissingPeriods } from "./missing-periods";
import type {
  AnalysisResult,
  CompletedPeriodRecord,
  ProcessedCusumRecord,
} from "./types";
import { validateOptions, validateRecords } from "./validation";

export function analyzeCusum(records: unknown, options: unknown): AnalysisResult {
  const recordValidation = validateRecords(records);
  const optionValidation = validateOptions(options);
  if (!recordValidation.valid || !optionValidation.valid) {
    return {
      success: false,
      issues: [
        ...(recordValidation.valid ? [] : recordValidation.issues),
        ...(optionValidation.valid ? [] : optionValidation.issues),
      ],
    };
  }
  const validated = recordValidation.value;
  const validOptions = optionValidation.value;
  const aggregated = aggregateDuplicates(standardizeRecords(validated, validOptions));
  const completed = fillMissingPeriods(aggregated, validOptions.analysis_interval);
  const groups = new Map<string, CompletedPeriodRecord[]>();
  for (const record of completed) {
    const group = groups.get(record.series_key) ?? [];
    group.push(record);
    groups.set(record.series_key, group);
  }
  const processed: ProcessedCusumRecord[] = [];
  for (const group of groups.values()) processed.push(...calculateSeries(group, validOptions));
  const riskGroups = [...new Set(processed.flatMap((record) => record.risk_group === undefined ? [] : [record.risk_group]))].sort();
  const alertCount = processed.filter((record) => record.is_alert).length;
  return {
    success: true,
    records: processed,
    summary: {
      input_row_count: validated.length,
      processed_row_count: processed.length,
      independent_series_count: groups.size,
      alert_count: alertCount,
      maximum_cusum: processed.reduce((maximum, record) => Math.max(maximum, record.cusum), 0),
      analysis_interval: validOptions.analysis_interval,
      smoothing_window: validOptions.smoothing_window,
      baseline_window: validOptions.baseline_window,
      k: validOptions.k,
      threshold: validOptions.threshold,
      areas_included: new Set(processed.map((record) => record.area)).size,
      risk_groups_included: riskGroups,
      alerts_detected: alertCount,
    },
  };
}
