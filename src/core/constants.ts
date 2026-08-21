import type { AnalysisOptions } from "./types";

export const DEFAULT_ANALYSIS_OPTIONS: Readonly<AnalysisOptions> = {
  analysis_interval: "monthly",
  smoothing_window: 3,
  baseline_window: 36,
  k: 0.1,
  threshold: 3,
  group_by_risk_group: false,
};

export const ANALYSIS_INTERVALS = ["daily", "weekly", "monthly"] as const;
