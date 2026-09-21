import type { AnalysisWorkflowState } from "../import";
import { countDisplayedAlertEpisodes, identifyAlertEpisodes } from "../core";
import {
  chartWidthForIntervals,
  filterChartRecords,
  filterAlertEpisodes,
  filterProcessedRecords,
  formatResultNumber,
  independentSeries,
  MAX_DISPLAYED_CHART_SERIES,
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
    const chartRecords = filterChartRecords(result.records, state.result_view.filters);
    const stratified = result.records.some((record) => record.risk_group !== undefined);
    const allAlertEpisodes = identifyAlertEpisodes(result.records);
    const filteredAlertEpisodes = filterAlertEpisodes(
      allAlertEpisodes,
      state.result_view.filters,
    );
    this.currentChartIntervalCount = new Set(chartRecords.map((record) => record.date)).size;
    this.updateChartWidth();
    requiredElement<HTMLElement>(this.root, "#filter-result-summary").textContent =
      `${filtered.length.toLocaleString()} of ${result.records.length.toLocaleString()} processed records displayed; ` +
      (stratified
        ? `${state.result_view.filters.selected_series.length.toLocaleString()} series selected; `
        : `${state.result_view.filters.selected_areas.length.toLocaleString()} Areas selected; `) +
      `${independentSeries(chartRecords).length.toLocaleString()} series currently plotted.`;
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
        state.result_view.filters.series_with_alerts_only
          ? "No selected series within the current display filters has an alert episode. Adjust the filters or turn off Show Only Series with Alerts."
          : undefined,
      );
      this.setChartInteractionStatus("");
      this.lastChartRecords = result.records;
      this.lastChartKey = chartKey;
    }
    renderAlertTable(
      requiredElement(this.root, "#alert-table-container"),
      allAlertEpisodes,
      filteredAlertEpisodes,
      state.result_view.alert_page,
      state.result_view.alert_page_size,
      state.result_view.alerts_expanded,
      state.result_view.show_inactive_alerts,
      {
        setPage: (page) => {
          this.store.setAlertPage(page);
          this.dependencies.requestRender();
        },
        setExpanded: (expanded) => {
          this.store.setAlertsExpanded(expanded);
          this.dependencies.requestRender();
        },
        setShowInactive: (showInactive) => {
          this.store.setShowInactiveAlerts(showInactive);
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
    const area = requiredElement<HTMLElement>(this.root, "#area-filter");
    const risk = requiredElement<HTMLElement>(this.root, "#risk-filter");
    const series = requiredElement<HTMLElement>(this.root, "#series-filter");
    const areaControl = requiredElement<HTMLFieldSetElement>(this.root, "#area-filter-control");
    const riskControl = requiredElement<HTMLFieldSetElement>(this.root, "#risk-filter-control");
    const seriesControl = requiredElement<HTMLFieldSetElement>(this.root, "#series-filter-control");
    const availableSeries = independentSeries(result.records);
    const stratified = availableSeries.some((option) => option.risk_group !== undefined);
    riskControl.hidden = !stratified;
    seriesControl.hidden = !stratified;
    const areaDefaultHelp = requiredElement<HTMLElement>(this.root, "#area-default-help");
    areaDefaultHelp.hidden = stratified || availableSeries.length <= MAX_DISPLAYED_CHART_SERIES;
    areaDefaultHelp.textContent = !stratified && availableSeries.length > MAX_DISPLAYED_CHART_SERIES
      ? `The first ${MAX_DISPLAYED_CHART_SERIES} of ${availableSeries.length.toLocaleString()} Areas are selected by default; all remain available here.`
      : "";
    requiredElement<HTMLElement>(this.root, "#series-filter-help").textContent =
      availableSeries.some((option) => option.risk_group !== undefined)
        ? "Select individual plotted series. Each series represents an Area–Strata combination."
        : "Select individual plotted series. Each series represents one Area.";
    requiredElement<HTMLElement>(this.root, "#series-default-help").textContent =
      availableSeries.length > MAX_DISPLAYED_CHART_SERIES
        ? `The first ${MAX_DISPLAYED_CHART_SERIES} of ${availableSeries.length.toLocaleString()} series are selected by default; all remain available here.`
        : "All series are selected by default.";
    const alertSeriesOnly = requiredElement<HTMLInputElement>(this.root, "#series-with-alerts-filter");
    const startDate = requiredElement<HTMLInputElement>(this.root, "#start-date-filter");
    const endDate = requiredElement<HTMLInputElement>(this.root, "#end-date-filter");
    alertSeriesOnly.checked = filters.series_with_alerts_only;
    startDate.value = filters.start_date;
    endDate.value = filters.end_date;
    areaControl.disabled = disabled;
    riskControl.disabled = disabled;
    seriesControl.disabled = disabled;
    for (const control of [alertSeriesOnly, startDate, endDate]) control.disabled = disabled;
    requiredElement<HTMLButtonElement>(this.root, "#reset-display-filters").disabled = disabled;
    const update = (): void => {
      this.store.updateDisplayFilters({
        selected_areas: selectedCheckboxValues(area),
        selected_risk_groups: selectedCheckboxValues(risk),
        selected_series: selectedCheckboxValues(series),
        series_with_alerts_only: filters.series_with_alerts_only,
        start_date: startDate.value,
        end_date: endDate.value,
      });
      this.dependencies.requestRender();
    };
    renderCheckboxOptions(area, uniqueAreas(result.records), filters.selected_areas, update);
    renderCheckboxOptions(risk, uniqueRiskGroups(result.records), filters.selected_risk_groups, update);
    renderCheckboxOptions(
      series,
      availableSeries.map((option) => ({ value: option.key, label: option.label })),
      filters.selected_series,
      update,
    );
    configureCheckboxActions(
      requiredElement(this.root, "#area-select-all"),
      requiredElement(this.root, "#area-clear-all"),
      area,
      update,
    );
    configureCheckboxActions(
      requiredElement(this.root, "#risk-select-all"),
      requiredElement(this.root, "#risk-clear-all"),
      risk,
      update,
    );
    configureCheckboxActions(
      requiredElement(this.root, "#series-select-all"),
      requiredElement(this.root, "#series-clear-all"),
      series,
      update,
    );
    replaceChangeHandler(alertSeriesOnly, () => {
      this.store.setSeriesWithAlertsOnly(alertSeriesOnly.checked);
      this.dependencies.requestRender();
    });
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
    const chartRecords = filterChartRecords(result.records, state.result_view.filters);
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
        alert_count: countDisplayedAlertEpisodes(chartRecords, result.records),
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
        <fieldset id="area-filter-control" class="filter-control checkbox-filter">
          <legend>Areas</legend>
          <div class="checkbox-list-actions">
            <button id="area-select-all" class="button button-secondary filter-list-button" type="button">Select all</button>
            <button id="area-clear-all" class="button button-secondary filter-list-button" type="button">Clear all</button>
          </div>
          <div id="area-filter" class="checkbox-option-list" role="group" aria-label="Areas"></div>
          <small>Filter by geographic or surveillance unit. Selected areas determine which series are eligible to display.</small>
          <small id="area-default-help"></small>
        </fieldset>
        <fieldset id="risk-filter-control" class="filter-control checkbox-filter">
          <legend>Strata</legend>
          <div class="checkbox-list-actions">
            <button id="risk-select-all" class="button button-secondary filter-list-button" type="button">Select all</button>
            <button id="risk-clear-all" class="button button-secondary filter-list-button" type="button">Clear all</button>
          </div>
          <div id="risk-filter" class="checkbox-option-list" role="group" aria-label="Strata"></div>
          <small>Filter by strata value across the selected Areas.</small>
        </fieldset>
        <fieldset id="series-filter-control" class="filter-control checkbox-filter">
          <legend>Displayed Series</legend>
          <div class="checkbox-list-actions">
            <button id="series-select-all" class="button button-secondary filter-list-button" type="button">Select all</button>
            <button id="series-clear-all" class="button button-secondary filter-list-button" type="button">Clear all</button>
          </div>
          <div id="series-filter" class="checkbox-option-list" role="group" aria-label="Displayed Series"></div>
          <small id="series-filter-help"></small>
          <small id="series-default-help"></small>
        </fieldset>
        <div class="filter-control">
          <label class="toggle-label compact"><input id="series-with-alerts-filter" type="checkbox" /> Show Only Series with Alerts</label>
          <small>Show the full history of selected series that have at least one alert episode.</small>
        </div>
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
        <button id="export-alerts" class="button button-secondary export-button" type="button">Export above-threshold periods</button>
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

function renderCheckboxOptions(
  container: HTMLElement,
  options: string[] | { value: string; label: string }[],
  selected: string[],
  onChange: () => void,
): void {
  container.replaceChildren();
  const selectedSet = new Set(selected);
  options.forEach((item) => {
    const value = typeof item === "string" ? item : item.value;
    const label = document.createElement("label");
    label.className = "filter-checkbox-option";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = encodeURIComponent(value);
    input.checked = selectedSet.has(value);
    input.addEventListener("change", onChange);
    const text = document.createElement("span");
    text.textContent = typeof item === "string" ? item : item.label;
    label.append(input, text);
    container.append(label);
  });
}

function selectedCheckboxValues(container: HTMLElement): string[] {
  return [...container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]:checked')]
    .map((input) => decodeURIComponent(input.value));
}

function configureCheckboxActions(
  selectAll: HTMLButtonElement,
  clearAll: HTMLButtonElement,
  container: HTMLElement,
  onChange: () => void,
): void {
  selectAll.onclick = () => {
    setAllCheckboxes(container, true);
    onChange();
  };
  clearAll.onclick = () => {
    setAllCheckboxes(container, false);
    onChange();
  };
}

function setAllCheckboxes(container: HTMLElement, checked: boolean): void {
  container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')
    .forEach((input) => { input.checked = checked; });
}

const changeHandlers = new WeakMap<Element, EventListener>();

function replaceChangeHandler(element: Element, handler: () => void): void {
  const previous = changeHandlers.get(element);
  if (previous !== undefined) element.removeEventListener("change", previous);
  element.addEventListener("change", handler);
  changeHandlers.set(element, handler);
}
