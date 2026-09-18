import type { AnalysisWorkflowState } from "../import";
import {
  chartWidthForIntervals,
  filterProcessedRecords,
  filterSelectedSeries,
  formatResultNumber,
  independentSeries,
  uniqueAreas,
  uniqueRiskGroups,
} from "../results";
import type { ChartRenderer, VisualizationSnapshot } from "../results";
import type { AppStateStore } from "../state";
import { renderAlertTable } from "./alert-table-view";
import { renderChartView } from "./chart-view";
import type { CsvDownloader, VisualizationDownloader } from "./export-view";
import { renderProcessedTable } from "./processed-table-view";

export interface ResultViewDependencies {
  chart: ChartRenderer;
  download: CsvDownloader;
  downloadVisualization: VisualizationDownloader;
  requestRender(): void;
}

export class ResultView {
  private readonly canvas: HTMLCanvasElement;
  private readonly chartSummary: HTMLElement;
  private readonly chartEmpty: HTMLElement;
  private readonly chartViewport: HTMLElement;
  private readonly chartSurface: HTMLElement;
  private readonly expandedChartViewport: HTMLElement;
  private readonly expandedChartOverlay: HTMLElement;
  private readonly expandedChartDialog: HTMLElement;
  private readonly expandChartButton: HTMLButtonElement;
  private readonly resetChartZoomButton: HTMLButtonElement;
  private readonly resetExpandedChartZoomButton: HTMLButtonElement;
  private readonly closeExpandedChartButton: HTMLButtonElement;
  private lastChartKey = "";
  private lastChartRecords: unknown = null;
  private currentChartIntervalCount = 0;
  private normalChartScrollLeft = 0;

  constructor(
    private readonly root: HTMLElement,
    private readonly store: AppStateStore,
    private readonly dependencies: ResultViewDependencies,
  ) {
    root.innerHTML = resultMarkup();
    this.canvas = requiredElement(root, "#cusum-chart");
    this.chartSummary = requiredElement(root, "#chart-summary");
    this.chartEmpty = requiredElement(root, "#chart-empty");
    this.chartViewport = requiredElement(root, "#chart-viewport");
    this.chartSurface = requiredElement(root, "#chart-surface");
    this.expandedChartViewport = requiredElement(root, "#expanded-chart-viewport");
    this.expandedChartOverlay = requiredElement(root, "#expanded-chart-overlay");
    this.expandedChartDialog = requiredElement(root, "#expanded-chart-dialog");
    this.expandChartButton = requiredElement(root, "#expand-chart");
    this.resetChartZoomButton = requiredElement(root, "#reset-chart-zoom");
    this.resetExpandedChartZoomButton = requiredElement(root, "#reset-expanded-chart-zoom");
    this.closeExpandedChartButton = requiredElement(root, "#close-expanded-chart");
    requiredElement<HTMLButtonElement>(root, "#reset-display-filters").addEventListener("click", () => {
      store.resetDisplayFilters();
      dependencies.requestRender();
    });
    requiredElement<HTMLButtonElement>(root, "#export-all").addEventListener("click", () => this.export("all"));
    requiredElement<HTMLButtonElement>(root, "#export-filtered").addEventListener("click", () => this.export("filtered"));
    requiredElement<HTMLButtonElement>(root, "#export-alerts").addEventListener("click", () => this.export("alerts"));
    requiredElement<HTMLButtonElement>(root, "#export-visualization").addEventListener("click", () => {
      this.exportVisualization();
    });
    this.expandChartButton.addEventListener("click", () => this.openExpandedChart());
    this.resetChartZoomButton.addEventListener("click", () => this.resetChartZoom());
    this.resetExpandedChartZoomButton.addEventListener("click", () => this.resetChartZoom());
    this.closeExpandedChartButton.addEventListener("click", () => this.closeExpandedChart());
    this.expandedChartOverlay.addEventListener("click", (event) => {
      if (event.target === this.expandedChartOverlay) this.closeExpandedChart();
    });
    this.expandedChartDialog.addEventListener("keydown", (event) => this.trapExpandedChartFocus(event));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !this.expandedChartOverlay.hidden) this.closeExpandedChart();
    });
    window.addEventListener("resize", () => this.updateChartWidth());
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
    this.currentChartIntervalCount = new Set(chartRecords.map((record) => record.date)).size;
    this.updateChartWidth();
    requiredElement<HTMLElement>(this.root, "#filter-result-summary").textContent =
      `${filtered.length.toLocaleString()} of ${result.records.length.toLocaleString()} processed records displayed; ` +
      `${state.result_view.filters.selected_series.length.toLocaleString()} chart series selected.`;
    const chartKey = JSON.stringify({
      filters: state.result_view.filters,
      threshold: result.summary.threshold,
    });
    if (this.lastChartRecords !== result.records || this.lastChartKey !== chartKey) {
      renderChartView(
        {
          canvas: this.canvas,
          summary: this.chartSummary,
          empty: this.chartEmpty,
          guidance: requiredElement(this.root, "#initial-baseline-chart-help"),
        },
        chartRecords,
        result.summary.threshold,
        this.dependencies.chart,
        result.summary.baseline_window,
        result.summary.analysis_interval,
        result.records,
      );
      this.setChartInteractionStatus("");
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
    const chartUnavailable = this.canvas.hidden;
    this.expandChartButton.disabled = disabled || chartUnavailable;
    this.resetChartZoomButton.disabled = disabled || chartUnavailable;
    this.resetExpandedChartZoomButton.disabled = disabled || chartUnavailable;
    requiredElement<HTMLButtonElement>(this.root, "#export-visualization").disabled = disabled || chartUnavailable;
    requiredElement<HTMLElement>(this.root, "#export-status").textContent = state.result_view.export_message;
  }

  clear(): void {
    this.closeExpandedChart(false);
    this.dependencies.chart.clear();
    this.lastChartKey = "";
    this.lastChartRecords = null;
    this.currentChartIntervalCount = 0;
    this.chartSurface.style.removeProperty("width");
    this.setChartInteractionStatus("");
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

  private exportVisualization(): void {
    const state = this.store.state;
    const result = state.analysis_result;
    if (result?.success !== true || state.result_view.result_stale || this.canvas.hidden) return;
    const filtered = filterProcessedRecords(result.records, state.result_view.filters);
    const chartRecords = filterSelectedSeries(filtered, state.result_view.filters.selected_series);
    const dates = [...new Set(chartRecords.map((record) => record.date))]
      .sort((left, right) => left.localeCompare(right));
    if (dates.length === 0) return;
    try {
      const snapshot: VisualizationSnapshot = {
        image_data_url: this.canvas.toDataURL("image/png"),
        image_width: this.canvas.clientWidth || this.canvas.width,
        image_height: this.canvas.clientHeight || this.canvas.height,
        date_start: dates[0]!,
        date_end: dates.at(-1)!,
        series_names: independentSeries(chartRecords).map((series) => series.label),
        threshold: result.summary.threshold,
        alert_count: chartRecords.filter((record) => record.is_alert).length,
        baseline_window: result.summary.baseline_window,
        analysis_interval: result.summary.analysis_interval,
      };
      const filename = this.dependencies.downloadVisualization(snapshot);
      this.store.setExportMessage(`Visualization exported locally as ${filename}.`);
    } catch {
      this.store.setExportMessage("The visualization could not be exported in this browser.");
    }
    this.dependencies.requestRender();
  }

  private updateChartWidth(): void {
    const viewport = this.chartSurface.parentElement;
    if (!(viewport instanceof HTMLElement)) return;
    const width = chartWidthForIntervals(this.currentChartIntervalCount, viewport.clientWidth);
    if (width > 0) this.chartSurface.style.width = `${width}px`;
    else this.chartSurface.style.removeProperty("width");
    this.dependencies.chart.resize?.();
  }

  private resetChartZoom(): void {
    this.dependencies.chart.resetZoom?.();
    this.setChartInteractionStatus("Chart zoom reset. All displayed dates are visible.");
  }

  private setChartInteractionStatus(message: string): void {
    requiredElement<HTMLElement>(this.root, "#chart-interaction-status").textContent = message;
    requiredElement<HTMLElement>(this.root, "#expanded-chart-interaction-status").textContent = message;
  }

  private openExpandedChart(): void {
    if (this.expandChartButton.disabled || !this.expandedChartOverlay.hidden) return;
    this.normalChartScrollLeft = this.chartViewport.scrollLeft;
    this.expandedChartOverlay.hidden = false;
    this.expandChartButton.setAttribute("aria-expanded", "true");
    this.setExpandedBackgroundInert(true);
    this.expandedChartViewport.append(this.chartSurface);
    requiredElement<HTMLElement>(this.root, "#expanded-chart-summary").textContent = this.chartSummary.textContent;
    this.updateChartWidth();
    this.expandedChartViewport.scrollLeft = this.normalChartScrollLeft;
    this.closeExpandedChartButton.focus();
  }

  private closeExpandedChart(returnFocus = true): void {
    if (this.expandedChartOverlay.hidden) return;
    this.normalChartScrollLeft = this.expandedChartViewport.scrollLeft;
    this.chartViewport.append(this.chartSurface);
    this.expandedChartOverlay.hidden = true;
    this.expandChartButton.setAttribute("aria-expanded", "false");
    this.setExpandedBackgroundInert(false);
    this.updateChartWidth();
    this.chartViewport.scrollLeft = this.normalChartScrollLeft;
    if (returnFocus && !this.root.hidden) this.expandChartButton.focus();
  }

  private setExpandedBackgroundInert(inert: boolean): void {
    const main = this.root.parentElement;
    const header = document.querySelector<HTMLElement>("#application-header");
    const elements = [
      ...(header === null ? [] : [header]),
      ...([...main?.children ?? []].filter((element) => element !== this.root) as HTMLElement[]),
      ...([...this.root.children].filter((element) => element !== this.expandedChartOverlay) as HTMLElement[]),
    ];
    elements.forEach((element) => element.toggleAttribute("inert", inert));
  }

  private trapExpandedChartFocus(event: KeyboardEvent): void {
    if (event.key !== "Tab") return;
    const focusable = [...this.expandedChartDialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )];
    const first = focusable[0];
    const last = focusable.at(-1);
    if (first === undefined || last === undefined) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
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
      <div><h3 id="display-filter-heading">Display Filters</h3><p>Display filters affect visualization only and do not recalculate the analysis or change the analysis settings.</p></div>
        <button id="reset-display-filters" class="button button-secondary" type="button">Reset Display Filters</button>
      </div>
      <div class="filter-grid">
        <label class="filter-control">Areas shown
          <select id="area-filter" multiple size="4"></select>
          <small>Use Ctrl/Command to select multiple.</small>
        </label>
        <label class="filter-control">Strata shown
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
      <div class="chart-section-heading">
        <h3 id="chart-heading">CUSUM time series</h3>
        <div class="chart-actions">
          <button id="reset-chart-zoom" class="button button-secondary" type="button">Reset zoom</button>
          <button id="expand-chart" class="button button-secondary" type="button" aria-haspopup="dialog" aria-controls="expanded-chart-dialog" aria-expanded="false">Expand chart</button>
        </div>
      </div>
      <p>The dashed line is the alert threshold. A point is an alert only when CUSUM is strictly greater than the threshold.</p>
      <p class="chart-zoom-help">Drag across the chart to zoom on dates. Hold Shift while dragging to pan, use Control + mouse wheel or pinch to zoom, or use Reset zoom.</p>
      <p id="chart-interaction-status" class="visually-hidden" role="status" aria-live="polite"></p>
      <details class="initial-baseline-guidance">
        <summary><span class="initial-baseline-swatch" aria-hidden="true"></span>Initial baseline period</summary>
        <p id="initial-baseline-chart-help"></p>
      </details>
      <p id="chart-summary" class="chart-summary"></p>
      <p id="chart-empty" class="empty-state" hidden>No chart data match the current filters.</p>
      <div id="chart-viewport" class="chart-viewport" role="region" aria-label="Scrollable CUSUM time-series chart" tabindex="0">
        <div id="chart-surface" class="chart-surface">
          <canvas id="cusum-chart" aria-label="CUSUM time-series chart" aria-describedby="initial-baseline-chart-help chart-summary" role="img"></canvas>
        </div>
      </div>
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
      <h3 id="export-heading">Local results export</h3>
      <p>CSV exports contain processed results. The visualization export contains the currently displayed chart. All exports are generated on this device.</p>
      <p class="muted">A current completed analysis is required. Exports are disabled while results are stale.</p>
      <div class="button-row">
        <button id="export-all" class="button button-secondary export-button" type="button">Export all processed results</button>
        <button id="export-filtered" class="button button-secondary export-button" type="button">Export filtered processed results</button>
        <button id="export-alerts" class="button button-secondary export-button" type="button">Export alerts only</button>
        <button id="export-visualization" class="button button-secondary export-button" type="button">Export visualization (HTML)</button>
      </div>
      <p id="export-status" role="status" aria-live="polite"></p>
    </section>

    <div id="expanded-chart-overlay" class="expanded-chart-overlay" hidden>
      <section
        id="expanded-chart-dialog"
        class="expanded-chart-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="expanded-chart-title"
        aria-describedby="expanded-chart-summary"
      >
        <div class="expanded-chart-header">
          <h3 id="expanded-chart-title">CUSUM time series</h3>
          <div class="chart-actions">
            <button id="reset-expanded-chart-zoom" class="button button-secondary" type="button">Reset zoom</button>
            <button id="close-expanded-chart" class="button button-secondary" type="button">Close expanded chart</button>
          </div>
        </div>
        <p id="expanded-chart-summary" class="expanded-chart-summary"></p>
        <p id="expanded-chart-interaction-status" class="visually-hidden" role="status" aria-live="polite"></p>
        <div id="expanded-chart-viewport" class="chart-viewport expanded-chart-viewport" role="region" aria-label="Scrollable expanded CUSUM time-series chart" tabindex="0"></div>
      </section>
    </div>
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
