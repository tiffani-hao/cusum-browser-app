import { describe, expect, it } from "vitest";
import { DEFAULT_ANALYSIS_OPTIONS, validateOptions, validateRecords } from "../src/core";

describe("record validation", () => {
  it.each([
    [[], "empty_input"],
    [[{ date: "2024-01-01", count: 1 }], "missing_area"],
    [[{ area: "A", count: 1 }], "missing_date"],
    [[{ area: "A", date: "2024-01-01" }], "missing_count"],
    [[{ area: " ", date: "2024-01-01", count: 1 }], "empty_area"],
    [[{ area: "A", date: "January 1", count: 1 }], "invalid_date"],
    [[{ area: "A", date: "2024-02-30", count: 1 }], "invalid_date"],
    [[{ area: "A", date: "2024-01-01", count: "1" }], "nonnumeric_count"],
    [[{ area: "A", date: "2024-01-01", count: Number.POSITIVE_INFINITY }], "nonfinite_count"],
    [[{ area: "A", date: "2024-01-01", count: -1 }], "negative_count"],
  ])("returns a structured issue for invalid input", (records, code) => {
    const result = validateRecords(records);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.issues.map((entry) => entry.code)).toContain(code);
  });

  it("normalizes surrounding area and risk-group whitespace", () => {
    const result = validateRecords([{ area: " A ", date: "2024-01-01", count: 1, risk_group: " G " }]);
    expect(result).toEqual({
      valid: true,
      value: [{ area: "A", date: "2024-01-01", count: 1, risk_group: "G" }],
    });
  });
});

describe("option validation", () => {
  it.each([
    [{ ...DEFAULT_ANALYSIS_OPTIONS, analysis_interval: "yearly" }, "invalid_interval"],
    [{ ...DEFAULT_ANALYSIS_OPTIONS, smoothing_window: 0 }, "invalid_smoothing_window"],
    [{ ...DEFAULT_ANALYSIS_OPTIONS, smoothing_window: 1.5 }, "invalid_smoothing_window"],
    [{ ...DEFAULT_ANALYSIS_OPTIONS, baseline_window: 0 }, "invalid_baseline_window"],
    [{ ...DEFAULT_ANALYSIS_OPTIONS, k: -1 }, "invalid_k"],
    [{ ...DEFAULT_ANALYSIS_OPTIONS, k: Number.NaN }, "invalid_k"],
    [{ ...DEFAULT_ANALYSIS_OPTIONS, threshold: -1 }, "invalid_threshold"],
    [{ ...DEFAULT_ANALYSIS_OPTIONS, threshold: Number.POSITIVE_INFINITY }, "invalid_threshold"],
    [{ ...DEFAULT_ANALYSIS_OPTIONS, group_by_risk_group: "yes" }, "invalid_group_by_risk_group"],
  ])("rejects invalid options", (options, code) => {
    const result = validateOptions(options);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.issues.map((entry) => entry.code)).toContain(code);
  });
});
