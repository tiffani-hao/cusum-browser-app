import { trailingMean, trailingSampleStandardDeviation } from "./rolling-statistics";
import type {
  AnalysisOptions,
  CompletedPeriodRecord,
  ProcessedCusumRecord,
} from "./types";

export function calculateSeries(
  records: CompletedPeriodRecord[],
  options: AnalysisOptions,
): ProcessedCusumRecord[] {
  const counts = records.map((record) => record.count);
  let previousCusum = 0;
  return records.map((record, index) => {
    const smoothedCount = trailingMean(counts, index, options.smoothing_window);
    const baselineMean = trailingMean(counts, index, options.baseline_window);
    const baselineStd = trailingSampleStandardDeviation(counts, index, options.baseline_window);
    const normalizedCount = (smoothedCount - baselineMean) / baselineStd;
    const cusum = Math.max(0, previousCusum + normalizedCount - options.k);
    previousCusum = cusum;
    return {
      area: record.area,
      ...(record.risk_group === undefined ? {} : { risk_group: record.risk_group }),
      date: record.date,
      count: record.count,
      smoothed_count: smoothedCount,
      baseline_mean: baselineMean,
      baseline_std: baselineStd,
      normalized_count: normalizedCount,
      cusum,
      threshold: options.threshold,
      is_alert: cusum > options.threshold,
    };
  });
}
