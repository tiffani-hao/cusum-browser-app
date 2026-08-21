import { describe, expect, it } from "vitest";
import { analyzeCusum, DEFAULT_ANALYSIS_OPTIONS } from "../src/core";
import type { FileParsingResult, InputValidationSummary } from "../src/import";
import { AppStateStore } from "../src/state";

const file = new File(["area,date,count\nA,2024-01-01,1"], "data.csv", { type: "text/csv" });
const parsed: FileParsingResult = {
  success: true,
  metadata: {
    filename: "data.csv",
    extension: "csv",
    mime_type: "text/csv",
    size_bytes: file.size,
    parsed_row_count: 1,
    columns: ["area", "date", "count"],
  },
  table: {
    columns: ["area", "date", "count"],
    rows: [{ area: "A", date: "2024-01-01", count: "1" }],
  },
  issues: [],
};
const valid: InputValidationSummary = {
  valid: true,
  required_columns_found: ["area", "date", "count"],
  missing_required_columns: [],
  has_risk_group: false,
  valid_record_count: 1,
  invalid_record_count: 0,
  issues: [],
  warnings: [],
  valid_records: [{ area: "A", date: "2024-01-01", count: 1 }],
};

describe("in-memory application state", () => {
  it("starts empty and enters parsing state", () => {
    const store = new AppStateStore();
    expect(store.state.status).toBe("idle");
    store.startParsing(file);
    expect(store.state.status).toBe("parsing");
  });

  it("represents parse and validation failures", () => {
    const store = new AppStateStore();
    store.startParsing(file);
    store.finishParsing({ success: false, issues: [{ code: "bad", message: "Bad file", scope: "file", severity: "error" }] });
    expect(store.state.status).toBe("parse-failed");
    store.startParsing(file);
    store.finishParsing(parsed, { ...valid, valid: false, invalid_record_count: 1, valid_record_count: 0, valid_records: [], issues: [{ code: "invalid", message: "Invalid" }] });
    expect(store.state.status).toBe("validation-failed");
  });

  it("moves through valid, running, and completed states", () => {
    const store = new AppStateStore();
    store.startParsing(file);
    store.finishParsing(parsed, valid);
    expect(store.state.status).toBe("input-valid");
    store.startAnalysis();
    expect(store.state.status).toBe("analysis-running");
    store.finishAnalysis(analyzeCusum(valid.valid_records, DEFAULT_ANALYSIS_OPTIONS));
    expect(store.state.status).toBe("analysis-completed");
  });

  it("clears all file and result data", () => {
    const store = new AppStateStore();
    store.startParsing(file);
    store.finishParsing(parsed, valid);
    store.finishAnalysis(analyzeCusum(valid.valid_records, DEFAULT_ANALYSIS_OPTIONS));
    store.clearData();
    expect(store.state.status).toBe("idle");
    expect(store.state.file).toBeNull();
    expect(store.state.parsed_records).toEqual([]);
    expect(store.state.analysis_result).toBeNull();
  });

  it("selecting a new file clears a previous analysis", () => {
    const store = new AppStateStore();
    store.startParsing(file);
    store.finishParsing(parsed, valid);
    store.finishAnalysis(analyzeCusum(valid.valid_records, DEFAULT_ANALYSIS_OPTIONS));
    store.startParsing(new File(["x"], "next.csv"));
    expect(store.state.analysis_result).toBeNull();
    expect(store.state.metadata).toBeNull();
  });

  it("marks a completed result stale when analytical settings change", () => {
    const store = completedStore();
    store.updateOptions({ ...DEFAULT_ANALYSIS_OPTIONS, threshold: 4 });
    expect(store.state.result_view.result_stale).toBe(true);
    expect(store.state.analysis_result?.success).toBe(true);
    expect(store.state.status).toBe("input-valid");
  });

  it("changes display filters without marking results stale", () => {
    const store = completedStore();
    store.setProcessedPage(2);
    store.updateDisplayFilters({
      ...store.state.result_view.filters,
      alert_only: true,
    });
    expect(store.state.result_view.filters.alert_only).toBe(true);
    expect(store.state.result_view.processed_page).toBe(1);
    expect(store.state.result_view.result_stale).toBe(false);
    expect(store.state.status).toBe("analysis-completed");
  });

  it("resets filters and clearData removes all result-view state", () => {
    const store = completedStore();
    store.updateDisplayFilters({
      ...store.state.result_view.filters,
      selected_areas: [],
      alert_only: true,
    });
    store.resetDisplayFilters();
    expect(store.state.result_view.filters.selected_areas).toEqual(["A"]);
    expect(store.state.result_view.filters.alert_only).toBe(false);
    store.clearData();
    expect(store.state.result_view.filters.selected_areas).toEqual([]);
    expect(store.state.result_view.processed_page).toBe(1);
  });
});

function completedStore(): AppStateStore {
  const store = new AppStateStore();
  store.startParsing(file);
  store.finishParsing(parsed, valid);
  store.finishAnalysis(analyzeCusum(valid.valid_records, DEFAULT_ANALYSIS_OPTIONS));
  return store;
}
