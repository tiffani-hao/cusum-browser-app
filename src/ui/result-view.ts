import type { AnalysisWorkflowState } from "../import";
import {
  filterProcessedRecords,
  filterSelectedSeries,
  formatResultNumber,
  independentSeries,
  uniqueAreas,
  uniqueRiskGroups,
} from "../results";
import type { ChartRenderer } from "../results";
import type { AppStateStore } from "../state";
import { renderAlertTable } from "./alert-table-view";
import { renderChartView } from "./chart-view";
import type { CsvDownloader } from "./export-view";
import { renderProcessedTable } from "./processed-table-view";

export interface ResultViewDependencies {
  chart: ChartRenderer;
  download: CsvDownloader;
  requestRender(): void;
}

export class ResultView {
  private readonly canvas: HTMLCanvasElement;
  private readonly chartSummary: HTMLElement;
  private readonly chartEmpty: HTMLElement;
  private lastChartKey = "";
  private lastChartRecords: unknown = null;

  constructor(
    private readonly root: HTMLElement,
    private readonly store: AppStateStore,
    private readonly dependencies: ResultViewDependencies,
  ) {
    root.innerHTML = resultMarkup();
    this.canvas = requiredElement(root, "#cusum-chart");
    this.chartSummary = requiredElement(root, "#chart-summary");
    this.chartEmpty = requiredElement(root, "#chart-empty");
    requiredElement<HTMLButtonElement>(root, "#reset-display-filters").addEventListener("click", () => {
      store.resetDisplayFilters();
      dependencies.requestRender();
    });
    requiredElement<HTMLButtonElement>(root, "#export-all").addEventListener("click", () => this.export("all"));
    requiredElement<HTMLButtonElement>(root, "#export-filtered").addEventListener("click", () => this.export("filtered"));
    requiredElement<HTMLButtonElement>(root, "#export-alerts").addEventListener("click", () => this.export("alerts"));
  }

  render(state: Readonly<AnalysisWorkflowState>): void {
    const result = state.analysis_result;
    this.root.hidden = result?.success !== true;
    if (result?.success !== true) {
      this.clear();
      return;
    }
    const disabled = state.result_view.result_stale;
    requiredElement<HTMLElement>(this.root, "#stale-results").hidden = !disabled;
    this.renderMetrics(state);
    this.renderFilters(state, disabled);
    const filtered = filterProcessedRecords(result.records, state.result_view.filters);
    const chartRecords = filterSelectedSeries(filtered, state.result_view.filters.selected_series);
    requiredElement<HTMLElement>(this.root, "#filter-result-summary").textContent =
      `${filtered.length.toLocaleString()} of ${result.records.length.toLocaleString()} processed records displayed; ` +
      `${state.result_view.filters.selected_series.length.toLocaleString()} chart series selected.`;
    const chartKey = JSON.stringify({
      filters: state.result_view.filters,
      threshold: result.summary.threshold,
    });
    if (this.lastChartRecords !== result.records || this.lastChartKey !== chartKey) {
      renderChartView(
        { canvas: this.canvas, summary: this.chartSummary, empty: this.chartEmpty },
        chartRecords,
        result.summary.threshold,
        this.dependencies.chart,
      );
      this.lastChartRecords = result.records;
      this.lastChartKey = chartKey;
    }
    renderAlertTable(
      requiredElement(this.root, "#alert-table-container"),
      filtered,
      state.result_view.alert_page,
      state.result_view.alert_page_size,
      state.result_view.alerts_expanded,
      {
        setPage: (page) => {
          this.store.setAlertPage(page);
          this.dependencies.requestRender();
        },
        setExpanded: (expanded) => {
          this.store.setAlertsExpanded(expanded);
          this.dependencies.requestRender();
        },
      },
    );
    renderProcessedTable(
      requiredElement(this.root, "#processed-table-container"),
      filtered,
      state.result_view.processed_page,
      state.result_view.processed_page_size,
      {
        setPage: (page) => {
          this.store.setProcessedPage(page);
          this.dependencies.requestRender();
        },
        setPageSize: (pageSize) => {
          this.store.setProcessedPageSize(pageSize);
          this.dependencies.requestRender();
        },
      },
    );
    for (const button of this.root.querySelectorAll<HTMLButtonElement>(".export-button")) button.disabled = disabled;
    requiredElement<HTMLElement>(this.root, "#export-status").textContent = state.result_view.export_message;
  }

  clear(): void {
    this.dependencies.chart.clear();
    this.lastChartKey = "";
    this.lastChartRecords = null;
  }

  private renderMetrics(state: Readonly<AnalysisWorkflowState>): void {
    const result = state.analysis_result;
    if (result?.success !== true) return;
    const metrics: [string, string][] = [
      ["Input rows", result.summary.input_row_count.toLocaleString()],
      ["Processed rows", result.summary.processed_row_count.toLocaleString()],
      ["Alerts", result.summary.alert_count.toLocaleString()],
      ["Maximum CUSUM", formatResultNumber(result.summary.maximum_cusum)],
    ];
    renderDefinitionList(requiredElement(this.root, "#analysis-summary"), metrics);
  }

  private renderFilters(state: Readonly<AnalysisWorkflowState>, disabled: boolean): void {
    const result = state.analysis_result;
    if (result?.success !== true) return;
    const filters = state.result_view.filters;
    const area = requiredElement<HTMLSelectElement>(this.root, "#area-filter");
    const risk = requiredElement<HTMLSelectElement>(this.root, "#risk-filter");
    const series = requiredElement<HTMLSelectElement>(this.root, "#series-filter");
    renderSelectOptions(area, uniqueAreas(result.records), filters.selected_areas);
    renderSelectOptions(risk, uniqueRiskGroups(result.records), filters.selected_risk_groups);
    renderSelectOptions(
      series,
      independentSeries(result.records).map((option) => ({ value: option.key, label: option.label })),
      filters.selected_series,
    );
    risk.closest<HTMLElement>(".filter-control")!.hidden = risk.options.length === 0;
    const alertOnly = requiredElement<HTMLInputElement>(this.root, "#alert-only-filter");
    const startDate = requiredElement<HTMLInputElement>(this.root, "#start-date-filter");
    const endDate = requiredElement<HTMLInputElement>(this.root, "#end-date-filter");
    alertOnly.checked = filters.alert_only;
    startDate.value = filters.start_date;
    endDate.value = filters.end_date;
    for (const control of [area, risk, series, alertOnly, startDate, endDate]) control.disabled = disabled;
    requiredElement<HTMLButtonElement>(this.root, "#reset-display-filters").disabled = disabled;
    const update = (): void => {
      this.store.updateDisplayFilters({
        selected_areas: selectedValues(area),
        selected_risk_groups: selectedValues(risk),
        selected_series: selectedValues(series),
        alert_only: alertOnly.checked,
        start_date: startDate.value,
        end_date: endDate.value,
      });
      this.dependencies.requestRender();
    };
    replaceChangeHandler(area, update);
    replaceChangeHandler(risk, update);
    replaceChangeHandler(series, update);
    replaceChangeHandler(alertOnly, update);
    replaceChangeHandler(startDate, update);
    replaceChangeHandler(endDate, update);
  }

  private export(kind: "all" | "filtered" | "alerts"): void {
    const state = this.store.state;
    const result = state.analysis_result;
    if (result?.success !== true || state.result_view.result_stale) return;
    const filtered = filterProcessedRecords(result.records, state.result_view.filters);
    const records = kind === "all"
      ? result.records
      : kind === "alerts"
        ? filtered.filter((record) => record.is_alert)
        : filtered;
    const resultType = kind === "all" ? "processed-results" : kind === "alerts" ? "alerts" : "filtered-results";
    const filename = this.dependencies.download(records, resultType, result.summary.analysis_interval);
    this.store.setExportMessage(`${records.length.toLocaleString()} records exported locally as ${filename}.`);
    this.dependencies.requestRender();
  }
}

function resultMarkup(): string {
  return `
    <div class="results-heading">
      <div><h2 id="results-heading">Results</h2><p class="completion-label">Analysis completed</p></div>
    </div>
    <p id="stale-results" class="stale-notice" role="status" hidden>These results are stale because analytical settings changed. Run Analysis again before exporting.</p>
    <dl id="analysis-summary" class="metric-grid" aria-label="Analysis result metrics"></dl>

    <section class="result-subsection display-filter-section" aria-labelledby="display-filter-heading">
      <div class="section-heading">
        <div><h3 id="display-filter-heading">Display Filters</h3><p>Display filters change what is shown; they do not recalculate CUSUM.</p></div>
        <button id="reset-display-filters" class="button button-secondary" type="button">Reset Display Filters</button>
      </div>
      <div class="filter-grid">
        <label class="filter-control">Areas shown
          <select id="area-filter" multiple size="4"></select>
          <small>Use Ctrl/Command to select multiple.</small>
        </label>
        <label class="filter-control">Risk groups shown
          <select id="risk-filter" multiple size="4"></select>
          <small>Use Ctrl/Command to select multiple.</small>
        </label>
        <label class="filter-control">Chart series shown
          <select id="series-filter" multiple size="4"></select>
          <small>Every series is shown initially.</small>
        </label>
        <label class="toggle-label compact"><input id="alert-only-filter" type="checkbox" /> Show alerts only</label>
        <label class="filter-control">Display start date<input id="start-date-filter" type="date" /></label>
        <label class="filter-control">Display end date<input id="end-date-filter" type="date" /></label>
      </div>
      <p id="filter-result-summary" class="filter-result-summary" role="status" aria-live="polite"></p>
    </section>

    <section class="result-subsection" aria-labelledby="chart-heading">
      <h3 id="chart-heading">CUSUM time series</h3>
      <p>The dashed line is the alert threshold. A point is an alert only when CUSUM is strictly greater than the threshold.</p>
      <p id="chart-summary" class="chart-summary"></p>
      <p id="chart-empty" class="empty-state" hidden>No chart data match the current filters.</p>
      <div class="chart-frame"><canvas id="cusum-chart" aria-label="CUSUM time-series chart" role="img"></canvas></div>
    </section>

    <section class="result-subsection" aria-labelledby="alert-table-heading">
      <h3 id="alert-table-heading">Alerts</h3>
      <div id="alert-table-container"></div>
    </section>

    <section class="result-subsection" aria-labelledby="processed-table-heading">
      <h3 id="processed-table-heading">Complete processed results</h3>
      <div id="processed-table-container"></div>
    </section>

    <section class="result-subsection" aria-labelledby="export-heading">
      <h3 id="export-heading">Local CSV export</h3>
      <p>Exports contain processed results only and are generated on this device.</p>
      <p class="muted">A current completed analysis is required. Exports are disabled while results are stale.</p>
      <div class="button-row">
        <button id="export-all" class="button button-secondary export-button" type="button">Export all processed results</button>
        <button id="export-filtered" class="button button-secondary export-button" type="button">Export filtered processed results</button>
        <button id="export-alerts" class="button button-secondary export-button" type="button">Export alerts only</button>
      </div>
      <p id="export-status" role="status" aria-live="polite"></p>
    </section>
  `;
}

function requiredElement<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (element === null) throw new Error(`Missing result element: ${selector}`);
  return element;
}

function renderDefinitionList(list: HTMLElement, entries: [string, string][]): void {
  list.replaceChildren();
  entries.forEach(([term, value]) => {
    const wrapper = document.createElement("div");
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = term;
    dd.textContent = value;
    wrapper.append(dt, dd);
    list.append(wrapper);
  });
}

function renderSelectOptions(
  select: HTMLSelectElement,
  options: string[] | { value: string; label: string }[],
  selected: string[],
): void {
  select.replaceChildren();
  const selectedSet = new Set(selected);
  options.forEach((item) => {
    const value = typeof item === "string" ? item : item.value;
    const option = document.createElement("option");
    option.value = value;
    option.textContent = typeof item === "string" ? item : item.label;
    option.selected = selectedSet.has(value);
    select.append(option);
  });
}

function selectedValues(select: HTMLSelectElement): string[] {
  return [...select.selectedOptions].map((option) => option.value);
}

const changeHandlers = new WeakMap<Element, EventListener>();

function replaceChangeHandler(element: Element, handler: () => void): void {
  const previous = changeHandlers.get(element);
  if (previous !== undefined) element.removeEventListener("change", previous);
  element.addEventListener("change", handler);
  changeHandlers.set(element, handler);
}
