import {
  analyzeCusum,
  validateOptions,
} from "../core";
import type {
  AnalysisOptions,
  AnalysisResult,
} from "../core";
import {
  DEFAULT_DISEASE_PRESET,
  DISEASE_PRESETS,
  diseasePresetById,
} from "../config";
import type { DiseasePresetSelection } from "../config";
import {
  importLocalFile,
  MAX_FILE_SIZE_BYTES,
  validateImportedTable,
} from "../import";
import type {
  AnalysisWorkflowState,
  FileParsingResult,
} from "../import";
import { AppStateStore } from "../state";
import { CusumChartController } from "../results";
import type { ChartRenderer } from "../results";
import { defaultCsvDownloader } from "./export-view";
import type { CsvDownloader } from "./export-view";
import { ResultView } from "./result-view";
import { helpDialogMarkup, initializeHelpDialog } from "./help-view";

const MAX_DISPLAYED_ISSUES = 20;

export interface WorkflowDependencies {
  importFile(file: File): Promise<FileParsingResult>;
  analyze(records: unknown, options: unknown): AnalysisResult;
  chart?: ChartRenderer;
  download?: CsvDownloader;
}

export interface WorkflowController {
  selectFile(file: File): Promise<void>;
  runAnalysis(): void;
  clearData(): void;
  getState(): Readonly<AnalysisWorkflowState>;
}

const DEFAULT_DEPENDENCIES: WorkflowDependencies = {
  importFile: importLocalFile,
  analyze: analyzeCusum,
};

function requiredElement<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (element === null) throw new Error(`Missing application element: ${selector}`);
  return element;
}

function staticMarkup(): string {
  const presetOptions = DISEASE_PRESETS.map((preset) =>
    `<option value="${preset.id}">${preset.label}</option>`
  ).join("");
  return `
    <header id="application-header" class="app-header">
      <div class="app-bar-inner">
        <h1>CUSUM-Based Early Detection Tool</h1>
        <button id="help-button" class="button header-help-button" type="button" aria-haspopup="dialog">Help</button>
      </div>
    </header>
    <main id="application-main" class="app-shell">
      <section class="panel upload-panel" aria-labelledby="upload-heading">
        <div class="section-heading">
          <div><h2 id="upload-heading">Upload data</h2><p>Select one locally stored surveillance file.</p></div>
          <button id="clear-data" class="button button-secondary" type="button" disabled>Clear Data</button>
        </div>
        <div id="drop-zone" class="drop-zone" aria-describedby="upload-help privacy-note" aria-busy="false">
          <input id="file-input" class="visually-hidden" type="file" aria-label="Choose CSV or XLSX file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" />
          <div class="drop-zone-copy">
            <span class="drop-icon" aria-hidden="true">＋</span>
            <span><strong>Drop a CSV or XLSX file here</strong><small id="upload-help">One file at a time · maximum ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MiB</small></span>
          </div>
          <button id="browse-files" class="button button-primary" type="button">Browse Files</button>
        </div>
        <p id="privacy-note" class="local-note">Processed locally in your browser.</p>
        <div class="workflow-status">
          <span id="state-label" class="state-label">Ready</span>
          <div id="live-status" class="status-message" role="status" aria-live="polite"></div>
        </div>
        <div id="error-summary" class="error-summary" role="alert" tabindex="-1" hidden>
          <h3>Review these issues</h3>
          <ul></ul>
          <p class="error-recovery">Correct the file or settings described above, then select the file again or update the affected setting.</p>
        </div>
        <div id="warning-summary" class="warning-summary" aria-live="polite" hidden></div>
      </section>

      <section id="file-summary-section" class="panel" aria-labelledby="file-summary-heading" hidden>
        <h2 id="file-summary-heading">File validation</h2>
        <dl id="file-summary" class="summary-grid"></dl>
        <div id="validation-summary" class="validation-card"></div>
      </section>

      <section id="settings-section" class="panel" aria-labelledby="settings-heading" hidden>
        <div class="section-heading">
          <div><h2 id="settings-heading">Analysis settings</h2><p>Choose a preset or adjust the settings used for the next analysis.</p></div>
          <button id="restore-defaults" class="button button-secondary" type="button">Restore Defaults</button>
        </div>
        <div class="settings-grid settings-grid-primary">
          <label>Disease preset
            <select id="disease-preset">
              ${presetOptions}
              <option value="custom">Custom</option>
            </select>
            <small>HIV is the current default preset for this tool.</small>
          </label>
          <label>Analysis interval
            <select id="analysis-interval">
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
            <small>Daily, Monday-anchored weekly, or month-start monthly.</small>
          </label>
          <label class="toggle-label setting-toggle">
            <input id="group-risk" type="checkbox" />
            <span>Group by risk group<small>Analyze area and risk-group combinations separately.</small></span>
          </label>
        </div>
        <div class="settings-grid settings-grid-numeric">
          <label>Smoothing window
            <input id="smoothing-window" type="number" min="1" step="1" inputmode="numeric" />
            <small>Trailing periods; default 3.</small>
          </label>
          <label>Baseline window
            <input id="baseline-window" type="number" min="1" step="1" inputmode="numeric" />
            <small>Rolling periods; default 36.</small>
          </label>
          <label>K
            <input id="k-value" type="number" min="0" step="0.01" inputmode="decimal" />
            <small>Nonnegative allowance; default 0.1.</small>
          </label>
          <label>Alert threshold
            <input id="threshold" type="number" min="0" step="0.1" inputmode="decimal" />
            <small>Alert when CUSUM is greater; default 3.</small>
          </label>
        </div>
        <div id="option-errors" class="field-errors" aria-live="polite"></div>
        <div class="analysis-actions">
          <button id="run-analysis" class="button button-primary run-button" type="button" disabled>Run Analysis</button>
          <p id="analysis-action-help" class="muted">Import a valid file to enable analysis.</p>
        </div>
      </section>

      <section id="results-section" class="panel" aria-labelledby="results-heading" hidden>
      </section>
    </main>
    ${helpDialogMarkup()}
  `;
}

export function createWorkflowApp(
  root: HTMLElement,
  dependencies: WorkflowDependencies = DEFAULT_DEPENDENCIES,
): WorkflowController {
  root.innerHTML = staticMarkup();
  initializeHelpDialog(root);
  const store = new AppStateStore();
  const resultView = new ResultView(
    requiredElement(root, "#results-section"),
    store,
    {
      chart: dependencies.chart ?? new CusumChartController(),
      download: dependencies.download ?? defaultCsvDownloader,
      requestRender: () => render(),
    },
  );
  let importSequence = 0;
  let optionIssues: string[] = [];

  const fileInput = requiredElement<HTMLInputElement>(root, "#file-input");
  const browseButton = requiredElement<HTMLButtonElement>(root, "#browse-files");
  const dropZone = requiredElement<HTMLElement>(root, "#drop-zone");
  const clearButton = requiredElement<HTMLButtonElement>(root, "#clear-data");
  const runButton = requiredElement<HTMLButtonElement>(root, "#run-analysis");
  const diseasePreset = requiredElement<HTMLSelectElement>(root, "#disease-preset");
  const interval = requiredElement<HTMLSelectElement>(root, "#analysis-interval");
  const smoothing = requiredElement<HTMLInputElement>(root, "#smoothing-window");
  const baseline = requiredElement<HTMLInputElement>(root, "#baseline-window");
  const kValue = requiredElement<HTMLInputElement>(root, "#k-value");
  const threshold = requiredElement<HTMLInputElement>(root, "#threshold");
  const groupRisk = requiredElement<HTMLInputElement>(root, "#group-risk");
  const restoreDefaults = requiredElement<HTMLButtonElement>(root, "#restore-defaults");

  function syncOptionControls(
    options: AnalysisOptions,
    preset: DiseasePresetSelection,
  ): void {
    diseasePreset.value = preset;
    interval.value = options.analysis_interval;
    smoothing.value = String(options.smoothing_window);
    baseline.value = String(options.baseline_window);
    kValue.value = String(options.k);
    threshold.value = String(options.threshold);
    groupRisk.checked = options.group_by_risk_group;
  }

  function readOptions(): unknown {
    return {
      analysis_interval: interval.value,
      smoothing_window: Number(smoothing.value),
      baseline_window: Number(baseline.value),
      k: Number(kValue.value),
      threshold: Number(threshold.value),
      group_by_risk_group: groupRisk.checked,
    };
  }

  function updateOptions(): void {
    diseasePreset.value = "custom";
    const validation = validateOptions(readOptions());
    if (validation.valid) {
      optionIssues = [];
      store.updateOptions(validation.value, "custom");
    } else {
      optionIssues = validation.issues.map((issue) => issue.message);
      store.setDiseasePreset("custom");
      store.markResultsStale("Analysis settings are invalid. Correct them and run Analysis again.");
    }
    render();
  }

  for (const control of [interval, smoothing, baseline, kValue, threshold, groupRisk]) {
    control.addEventListener("change", updateOptions);
    control.addEventListener("input", updateOptions);
  }

  diseasePreset.addEventListener("change", () => {
    optionIssues = [];
    if (diseasePreset.value === "custom") {
      store.setDiseasePreset("custom");
    } else {
      const preset = diseasePresetById(diseasePreset.value);
      if (preset === undefined) throw new Error(`Unknown disease preset: ${diseasePreset.value}`);
      store.updateOptions({ ...preset.options }, preset.id);
    }
    syncOptionControls(store.state.options, store.state.disease_preset);
    render();
  });

  restoreDefaults.addEventListener("click", () => {
    optionIssues = [];
    store.updateOptions({ ...DEFAULT_DISEASE_PRESET.options }, DEFAULT_DISEASE_PRESET.id);
    syncOptionControls(store.state.options, store.state.disease_preset);
    render();
  });

  async function selectFile(file: File): Promise<void> {
    const sequence = ++importSequence;
    optionIssues = [];
    store.startParsing(file);
    render();
    const result = await dependencies.importFile(file);
    if (sequence !== importSequence) return;
    if (result.success) {
      const validation = validateImportedTable(result.table.columns, result.table.rows);
      store.finishParsing(result, validation);
    } else {
      store.finishParsing(result);
    }
    render();
  }

  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (file !== undefined) void selectFile(file);
  });
  browseButton.addEventListener("click", () => fileInput.click());
  for (const eventName of ["dragenter", "dragover"]) {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.add("is-dragging");
    });
  }
  for (const eventName of ["dragleave", "drop"]) {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.remove("is-dragging");
    });
  }
  dropZone.addEventListener("drop", (event) => {
    const file = event.dataTransfer?.files[0];
    if (file !== undefined) void selectFile(file);
  });

  function runAnalysis(): void {
    const state = store.state;
    if (state.validation?.valid !== true || optionIssues.length > 0) return;
    store.startAnalysis();
    render();
    store.finishAnalysis(dependencies.analyze(state.validation.valid_records, state.options));
    render();
  }

  function clearData(): void {
    importSequence += 1;
    optionIssues = [];
    store.clearData();
    fileInput.value = "";
    render();
  }

  runButton.addEventListener("click", runAnalysis);
  clearButton.addEventListener("click", clearData);

  function render(): void {
    const state = store.state;
    requiredElement<HTMLElement>(root, "#live-status").textContent = state.message;
    requiredElement<HTMLElement>(root, "#state-label").textContent = statusLabel(state.status);
    clearButton.disabled = state.status === "idle";
    const isBusy = state.status === "parsing" || state.status === "analysis-running";
    browseButton.disabled = isBusy;
    fileInput.disabled = isBusy;
    dropZone.setAttribute("aria-busy", String(state.status === "parsing"));
    dropZone.setAttribute("aria-disabled", String(isBusy));
    dropZone.classList.toggle("is-disabled", isBusy);

    const errorSummary = requiredElement<HTMLElement>(root, "#error-summary");
    const errorList = requiredElement<HTMLUListElement>(errorSummary, "ul");
    errorList.replaceChildren();
    const errors = [
      ...state.parsing_issues.filter((issue) => issue.severity === "error").map((issue) => issue.message),
      ...(state.validation?.issues.map((issue) => issue.message) ?? []),
    ];
    errorSummary.hidden = errors.length === 0;
    errors.slice(0, MAX_DISPLAYED_ISSUES).forEach((message) => {
      const item = document.createElement("li");
      item.textContent = message;
      errorList.append(item);
    });
    if (errors.length > MAX_DISPLAYED_ISSUES) {
      const item = document.createElement("li");
      item.textContent = `${(errors.length - MAX_DISPLAYED_ISSUES).toLocaleString()} additional issues are not displayed.`;
      errorList.append(item);
    }

    const warnings = [
      ...state.parsing_issues.filter((issue) => issue.severity === "warning"),
      ...(state.validation?.warnings ?? []),
    ];
    const warningSummary = requiredElement<HTMLElement>(root, "#warning-summary");
    warningSummary.hidden = warnings.length === 0;
    warningSummary.textContent = warnings.length === 0
      ? ""
      : `Warning: ${warnings.map((warning) => warning.message).join(" ")}`;

    renderFileSummary(root, state);
    renderValidation(root, state);

    const settingsSection = requiredElement<HTMLElement>(root, "#settings-section");
    settingsSection.hidden = state.metadata === null;
    groupRisk.disabled = state.validation?.has_risk_group !== true;
    if (groupRisk.disabled && groupRisk.checked) {
      groupRisk.checked = false;
      store.updateOptions({ ...state.options, group_by_risk_group: false });
    }
    syncOptionControls(store.state.options, store.state.disease_preset);
    const optionErrorContainer = requiredElement<HTMLElement>(root, "#option-errors");
    optionErrorContainer.replaceChildren();
    optionIssues.forEach((message) => {
      const paragraph = document.createElement("p");
      paragraph.textContent = message;
      optionErrorContainer.append(paragraph);
    });
    runButton.disabled = store.state.validation?.valid !== true || optionIssues.length > 0 ||
      state.status === "analysis-running";
    restoreDefaults.disabled = isBusy;
    requiredElement<HTMLElement>(root, "#analysis-action-help").textContent = analysisActionHelp(store.state, optionIssues);

    resultView.render(store.state);
  }

  syncOptionControls(store.state.options, store.state.disease_preset);
  render();
  return { selectFile, runAnalysis, clearData, getState: () => store.state };
}

function renderFileSummary(root: HTMLElement, state: Readonly<AnalysisWorkflowState>): void {
  const section = requiredElement<HTMLElement>(root, "#file-summary-section");
  section.hidden = state.metadata === null;
  const list = requiredElement<HTMLElement>(root, "#file-summary");
  list.replaceChildren();
  if (state.metadata === null) return;
  const entries: [string, string][] = [
    ["Filename", state.metadata.filename],
    ["File type", state.metadata.extension.toUpperCase()],
    ["File size", formatBytes(state.metadata.size_bytes)],
    ["Raw rows", state.metadata.parsed_row_count.toLocaleString()],
    ["Detected columns", state.metadata.columns.join(", ")],
  ];
  if (state.metadata.worksheet_name !== undefined) entries.push(["Worksheet", state.metadata.worksheet_name]);
  for (const [term, value] of entries) {
    const wrapper = document.createElement("div");
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = term;
    dd.textContent = value;
    wrapper.append(dt, dd);
    list.append(wrapper);
  }
}

function renderValidation(root: HTMLElement, state: Readonly<AnalysisWorkflowState>): void {
  const container = requiredElement<HTMLElement>(root, "#validation-summary");
  container.replaceChildren();
  const validation = state.validation;
  if (validation === null) return;
  const heading = document.createElement("h3");
  heading.textContent = validation.valid ? "Input is valid" : "Input needs attention";
  const details = document.createElement("p");
  const warningCount = state.parsing_issues.filter((issue) => issue.severity === "warning").length +
    validation.warnings.length;
  details.textContent = validation.valid
    ? `${validation.valid_record_count.toLocaleString()} valid records · required columns found · risk_group ${validation.has_risk_group ? "found" : "not present"} · ${warningCount} warnings`
    : `${validation.issues.length.toLocaleString()} blocking issues · ${validation.invalid_record_count.toLocaleString()} invalid records · ${warningCount} warnings`;
  container.className = `validation-card ${validation.valid ? "is-valid" : "is-invalid"}`;
  container.append(heading, details);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
}

function statusLabel(status: AnalysisWorkflowState["status"]): string {
  const labels: Record<AnalysisWorkflowState["status"], string> = {
    idle: "Ready",
    parsing: "Reading file",
    "parse-failed": "Import failed",
    parsed: "File parsed",
    "validation-failed": "Input invalid",
    "input-valid": "Ready to analyze",
    "analysis-running": "Analyzing",
    "analysis-completed": "Results ready",
    "analysis-failed": "Analysis failed",
  };
  return labels[status];
}

function analysisActionHelp(
  state: Readonly<AnalysisWorkflowState>,
  optionIssues: string[],
): string {
  if (state.status === "analysis-running") return "Analysis is running locally. Duplicate runs are disabled.";
  if (optionIssues.length > 0) return "Correct the analysis-setting errors before running.";
  if (state.validation?.valid !== true) return "Import a valid file to enable analysis.";
  if (state.result_view.result_stale) return "Settings changed. Run again to refresh results and re-enable export.";
  if (state.analysis_result?.success === true) return "Run again to replace the current completed result.";
  return "Ready to run locally in this browser.";
}
