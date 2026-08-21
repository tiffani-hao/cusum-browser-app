import type { AnalysisOptions, AnalysisResult } from "../core";
import { DEFAULT_DISEASE_PRESET } from "../config";
import type { DiseasePresetSelection } from "../config";
import type {
  AnalysisWorkflowState,
  FileParsingIssue,
  FileParsingResult,
  InputValidationSummary,
} from "../import";
import {
  createCompletedResultViewState,
  createInitialResultViewState,
} from "../results";
import type { ResultDisplayFilters } from "../results";

export function initialAppState(): AnalysisWorkflowState {
  return {
    status: "idle",
    file: null,
    metadata: null,
    parsed_records: [],
    parsing_issues: [],
    validation: null,
    disease_preset: DEFAULT_DISEASE_PRESET.id,
    options: { ...DEFAULT_DISEASE_PRESET.options },
    analysis_result: null,
    result_view: createInitialResultViewState(),
    message: "Select a CSV or XLSX file to begin.",
  };
}

export class AppStateStore {
  private current: AnalysisWorkflowState = initialAppState();

  get state(): Readonly<AnalysisWorkflowState> {
    return this.current;
  }

  startParsing(file: File): void {
    this.current = {
      ...initialAppState(),
      status: "parsing",
      file,
      message: "Reading the file locally…",
    };
  }

  finishParsing(result: FileParsingResult, validation?: InputValidationSummary): void {
    if (!result.success) {
      this.current = {
        ...this.current,
        status: "parse-failed",
        metadata: null,
        parsed_records: [],
        parsing_issues: result.issues,
        validation: null,
        analysis_result: null,
        result_view: createInitialResultViewState(),
        message: "The file could not be imported.",
      };
      return;
    }
    if (validation === undefined) throw new Error("Successful parsing requires validation.");
    this.current = {
      ...this.current,
      status: validation.valid ? "input-valid" : "validation-failed",
      metadata: result.metadata,
      parsed_records: result.table.rows,
      parsing_issues: result.issues,
      validation,
      analysis_result: null,
      result_view: createInitialResultViewState(),
      options: {
        ...this.current.options,
        group_by_risk_group: validation.has_risk_group && this.current.options.group_by_risk_group,
      },
      message: validation.valid ? "File imported and validated." : "File imported with blocking validation errors.",
    };
  }

  updateOptions(
    options: AnalysisOptions,
    diseasePreset: DiseasePresetSelection = this.current.disease_preset,
  ): void {
    const hadCompletedResult = this.current.analysis_result?.success === true;
    const changed = diseasePreset !== this.current.disease_preset ||
      !sameOptions(options, this.current.options);
    this.current = {
      ...this.current,
      options,
      disease_preset: diseasePreset,
      status: hadCompletedResult && changed && this.current.validation?.valid === true
        ? "input-valid"
        : this.current.status,
      result_view: {
        ...this.current.result_view,
        result_stale: this.current.result_view.result_stale || (hadCompletedResult && changed),
        export_message: "",
      },
      message: this.current.validation?.valid === true
        ? hadCompletedResult && changed
          ? "Analysis settings changed. Run Analysis to refresh the results."
          : changed
            ? "Analysis settings updated."
            : this.current.message
        : this.current.message,
    };
  }

  setDiseasePreset(
    diseasePreset: DiseasePresetSelection,
    message = "Analysis settings changed. Run Analysis to refresh the results.",
  ): void {
    if (diseasePreset === this.current.disease_preset) return;
    const hadCompletedResult = this.current.analysis_result?.success === true;
    this.current = {
      ...this.current,
      disease_preset: diseasePreset,
      status: hadCompletedResult && this.current.validation?.valid === true
        ? "input-valid"
        : this.current.status,
      result_view: {
        ...this.current.result_view,
        result_stale: this.current.result_view.result_stale || hadCompletedResult,
        export_message: "",
      },
      message: hadCompletedResult ? message : "Analysis settings updated.",
    };
  }

  startAnalysis(): void {
    this.current = {
      ...this.current,
      status: "analysis-running",
      analysis_result: null,
      result_view: createInitialResultViewState(),
      message: "Running analysis locally…",
    };
  }

  finishAnalysis(result: AnalysisResult): void {
    this.current = {
      ...this.current,
      status: result.success ? "analysis-completed" : "analysis-failed",
      analysis_result: result,
      result_view: result.success
        ? createCompletedResultViewState(result.records)
        : createInitialResultViewState(),
      message: result.success ? "Analysis completed." : "Analysis could not be completed.",
    };
  }

  clearData(): void {
    this.current = initialAppState();
  }

  setFailure(issues: FileParsingIssue[]): void {
    this.current = {
      ...this.current,
      status: "parse-failed",
      parsing_issues: issues,
      analysis_result: null,
      result_view: createInitialResultViewState(),
      message: "The file could not be imported.",
    };
  }

  updateDisplayFilters(filters: ResultDisplayFilters): void {
    this.current = {
      ...this.current,
      result_view: {
        ...this.current.result_view,
        filters,
        processed_page: 1,
        alert_page: 1,
        export_message: "",
      },
      message: "Display filters updated. CUSUM was not recalculated.",
    };
  }

  resetDisplayFilters(): void {
    if (this.current.analysis_result?.success !== true) return;
    this.current = {
      ...this.current,
      result_view: createCompletedResultViewState(this.current.analysis_result.records),
      message: "Display filters reset. CUSUM was not recalculated.",
    };
  }

  setProcessedPage(page: number): void {
    this.current = {
      ...this.current,
      result_view: { ...this.current.result_view, processed_page: page },
    };
  }

  setProcessedPageSize(pageSize: number): void {
    this.current = {
      ...this.current,
      result_view: { ...this.current.result_view, processed_page: 1, processed_page_size: pageSize },
    };
  }

  setAlertPage(page: number): void {
    this.current = {
      ...this.current,
      result_view: { ...this.current.result_view, alert_page: page },
    };
  }

  setAlertsExpanded(expanded: boolean): void {
    this.current = {
      ...this.current,
      result_view: {
        ...this.current.result_view,
        alerts_expanded: expanded,
        alert_page: 1,
      },
    };
  }

  setExportMessage(message: string): void {
    this.current = {
      ...this.current,
      result_view: { ...this.current.result_view, export_message: message },
      message,
    };
  }

  markResultsStale(message = "Analysis settings changed. Run Analysis to refresh the results."): void {
    if (this.current.analysis_result?.success !== true) return;
    this.current = {
      ...this.current,
      status: this.current.validation?.valid === true ? "input-valid" : this.current.status,
      result_view: {
        ...this.current.result_view,
        result_stale: true,
        export_message: "",
      },
      message,
    };
  }
}

function sameOptions(left: AnalysisOptions, right: AnalysisOptions): boolean {
  return left.analysis_interval === right.analysis_interval &&
    left.smoothing_window === right.smoothing_window &&
    left.baseline_window === right.baseline_window &&
    left.k === right.k &&
    left.threshold === right.threshold &&
    left.group_by_risk_group === right.group_by_risk_group;
}
