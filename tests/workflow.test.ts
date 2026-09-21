// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { analyzeCusum } from "../src/core";
import type { AnalysisInterval, ProcessedCusumRecord } from "../src/core";
import type { FileParsingResult } from "../src/import";
import type { ExportResultType, VisualizationSnapshot } from "../src/results";
import { createWorkflowApp } from "../src/ui/workflow-app";

function result(columns: string[] = ["area", "date", "count"], rows: Record<string, string>[] = [
  { area: "A", date: "2024-01-01", count: "1" },
  { area: "A", date: "2024-01-02", count: "10" },
]): FileParsingResult {
  return {
    success: true,
    metadata: {
      filename: "data.csv",
      extension: "csv",
      mime_type: "text/csv",
      size_bytes: 50,
      parsed_row_count: rows.length,
      columns,
    },
    table: { columns, rows },
    issues: [],
  };
}

function setup(parsed: FileParsingResult | ((file: File) => FileParsingResult) = result()) {
  document.body.innerHTML = '<div id="app"></div>';
  const root = document.querySelector<HTMLElement>("#app");
  if (root === null) throw new Error("Missing test root.");
  const analyze = vi.fn(analyzeCusum);
  const chart = { render: vi.fn(), clear: vi.fn(), resetZoom: vi.fn() };
  const download = vi.fn((
    _records: ProcessedCusumRecord[],
    _type: ExportResultType,
    _interval: AnalysisInterval,
  ) => "cusum-test.csv");
  const downloadVisualization = vi.fn((_snapshot: VisualizationSnapshot) =>
    "cusum-visualization-2026-09-15.html"
  );
  const controller = createWorkflowApp(root, {
    importFile: vi.fn(async (file: File) => {
      const selected = typeof parsed === "function" ? parsed(file) : parsed;
      return selected.success ? {
        ...selected,
        metadata: { ...selected.metadata, filename: file.name },
      } : selected;
    }),
    analyze,
    chart,
    download,
    downloadVisualization,
  });
  return { root, controller, analyze, chart, download, downloadVisualization };
}

describe("Application workflow", () => {
  it("gates analysis until valid input is present", async () => {
    const { root, controller } = setup();
    const run = root.querySelector<HTMLButtonElement>("#run-analysis");
    expect(run?.disabled).toBe(true);
    await controller.selectFile(new File(["data"], "data.csv"));
    expect(run?.disabled).toBe(false);
  });

  it("keeps analysis disabled for invalid input", async () => {
    const { root, controller } = setup(result(["area", "date"], [{ area: "A", date: "2024-01-01" }]));
    await controller.selectFile(new File(["data"], "data.csv"));
    expect(root.querySelector<HTMLButtonElement>("#run-analysis")?.disabled).toBe(true);
  });

  it("enables stratification only when the optional column exists", async () => {
    const withoutRisk = setup();
    await withoutRisk.controller.selectFile(new File(["data"], "data.csv"));
    expect(withoutRisk.root.querySelector<HTMLInputElement>("#group-risk")?.disabled).toBe(true);

    const withRisk = setup(result(
      ["area", "date", "count", "risk_group"],
      [{ area: "A", date: "2024-01-01", count: "1", risk_group: "G" }],
    ));
    await withRisk.controller.selectFile(new File(["data"], "data.csv"));
    expect(withRisk.root.querySelector<HTMLInputElement>("#group-risk")?.disabled).toBe(false);
    expect(withRisk.root.querySelector<HTMLInputElement>("#group-risk")?.checked).toBe(true);
    expect(withRisk.controller.getState().disease_preset).toBe("hiv");
    expect(withRisk.root.querySelector("#validation-summary")?.textContent).toContain(
      "stratification variable found",
    );
  });

  it("resets and restores automatic stratification as files change", async () => {
    const plain = result();
    const stratified = result(
      ["area", "date", "count", "risk_group"],
      [{ area: "A", date: "2024-01-01", count: "1", risk_group: "Stratum A" }],
    );
    const { root, controller } = setup((file) => file.name.startsWith("stratified") ? stratified : plain);
    const control = root.querySelector<HTMLInputElement>("#group-risk")!;
    const label = control.closest<HTMLElement>(".setting-toggle")!;

    await controller.selectFile(new File(["data"], "stratified.csv"));
    expect(control.disabled).toBe(false);
    expect(control.checked).toBe(true);
    expect(label.classList.contains("is-disabled")).toBe(false);
    expect(controller.getState().disease_preset).toBe("hiv");

    await controller.selectFile(new File(["data"], "plain.csv"));
    expect(control.disabled).toBe(true);
    expect(control.checked).toBe(false);
    expect(label.classList.contains("is-disabled")).toBe(true);
    expect(controller.getState().options.group_by_risk_group).toBe(false);

    await controller.selectFile(new File(["data"], "stratified-next.csv"));
    expect(control.disabled).toBe(false);
    expect(control.checked).toBe(true);
    expect(controller.getState().disease_preset).toBe("hiv");
  });

  it("runs the existing engine and renders the complete result through pagination", async () => {
    const rows = Array.from({ length: 12 }, (_, index) => ({
      area: "A",
      date: `2024-${String(index + 1).padStart(2, "0")}-01`,
      count: String(index),
    }));
    const { root, controller, analyze } = setup(result(undefined, rows));
    await controller.selectFile(new File(["data"], "data.csv"));
    controller.runAnalysis();
    expect(analyze).toHaveBeenCalledOnce();
    expect(controller.getState().status).toBe("analysis-completed");
    expect(root.querySelector("#analysis-summary")?.textContent).toContain("Processed rows");
    expect(root.querySelectorAll("#processed-table-container tbody tr").length).toBe(12);
  });

  it("shows key processed columns while retaining calculation intermediates in analytical records", async () => {
    const { root, controller } = setup();
    await controller.selectFile(new File(["data"], "data.csv"));
    controller.runAnalysis();
    const headers = [...root.querySelectorAll("#processed-table-container thead th")]
      .map((header) => header.textContent);
    expect(headers).toEqual([
      "Area",
      "Date",
      "Count",
      "Normalized count",
      "CUSUM",
      "Threshold",
      "Alert status",
    ]);
    expect(headers).not.toContain("Smoothed count");
    expect(headers).not.toContain("Baseline mean");
    expect(headers).not.toContain("Baseline standard deviation");
    expect(root.querySelector("#processed-table-container caption")?.textContent).toBe(
      "Key processed CUSUM results; tabular alternative to the chart",
    );
    const result = controller.getState().analysis_result;
    expect(result?.success).toBe(true);
    if (result?.success !== true) return;
    expect(result.records[0]).toEqual(expect.objectContaining({
      smoothed_count: expect.any(Number),
      baseline_mean: expect.any(Number),
      baseline_std: expect.any(Number),
    }));
  });

  it("renders imported filenames as text and clears all rendered state", async () => {
    const { root, controller } = setup();
    await controller.selectFile(new File(["data"], "<img src=x>.csv"));
    expect(root.querySelector("#file-summary")?.textContent).toContain("<img src=x>.csv");
    expect(root.querySelector("#file-summary img")).toBeNull();
    controller.runAnalysis();
    controller.clearData();
    expect(controller.getState().status).toBe("idle");
    expect(root.querySelector<HTMLElement>("#file-summary-section")?.hidden).toBe(true);
    expect(root.querySelector<HTMLElement>("#results-section")?.hidden).toBe(true);
  });

  it("replaces prior analysis when a new file is selected", async () => {
    const { controller } = setup();
    await controller.selectFile(new File(["one"], "one.csv"));
    controller.runAnalysis();
    expect(controller.getState().analysis_result).not.toBeNull();
    await controller.selectFile(new File(["two"], "two.csv"));
    expect(controller.getState().analysis_result).toBeNull();
    expect(controller.getState().metadata?.filename).toBe("two.csv");
  });

  it("provides keyboard, live-region, labeled-control, chart-summary, and table-header semantics", async () => {
    const { root, controller } = setup();
    await controller.selectFile(new File(["data"], "data.csv"));
    controller.runAnalysis();
    expect(root.querySelector("#drop-zone")?.tagName).toBe("BUTTON");
    expect(root.querySelector("#drop-zone")?.getAttribute("aria-label")).toBe(
      "Choose or drop a CSV or XLSX file",
    );
    expect(root.querySelector("#live-status")?.getAttribute("aria-live")).toBe("polite");
    expect(root.querySelector("#file-input")?.getAttribute("aria-label")).toBe("Choose CSV or XLSX file");
    expect(root.querySelector("#chart-summary")).not.toBeNull();
    expect(root.querySelectorAll("#processed-table-container thead").length).toBe(1);
  });

  it("changes display filters without rerunning analysis and resets table pages", async () => {
    const { root, controller, analyze, chart } = setup();
    await controller.selectFile(new File(["data"], "data.csv"));
    controller.runAnalysis();
    const creationCount = chart.render.mock.calls.length;
    const alertSeriesOnly = root.querySelector<HTMLInputElement>("#series-with-alerts-filter");
    if (alertSeriesOnly === null) throw new Error("Missing series-with-alerts filter.");
    alertSeriesOnly.checked = true;
    alertSeriesOnly.dispatchEvent(new Event("change", { bubbles: true }));
    expect(analyze).toHaveBeenCalledOnce();
    expect(controller.getState().result_view.filters.series_with_alerts_only).toBe(true);
    expect(controller.getState().result_view.processed_page).toBe(1);
    expect(chart.render.mock.calls.length).toBeGreaterThanOrEqual(creationCount);
  });

  it("marks completed results stale after an analytical option changes", async () => {
    const { root, controller } = setup();
    await controller.selectFile(new File(["data"], "data.csv"));
    controller.runAnalysis();
    const threshold = root.querySelector<HTMLInputElement>("#threshold");
    if (threshold === null) throw new Error("Missing threshold input.");
    threshold.value = "5";
    threshold.dispatchEvent(new Event("change", { bubbles: true }));
    expect(controller.getState().result_view.result_stale).toBe(true);
    expect(root.querySelector<HTMLElement>("#stale-results")?.hidden).toBe(false);
    expect(root.querySelector<HTMLButtonElement>("#export-all")?.disabled).toBe(true);
  });

  it("does not recreate the chart for processed-table pagination", async () => {
    const rows = Array.from({ length: 40 }, (_, index) => ({
      area: "A",
      date: `2024-${String(Math.floor(index / 28) + 1).padStart(2, "0")}-${String(index % 28 + 1).padStart(2, "0")}`,
      count: String(index),
    }));
    const { root, controller, chart } = setup(result(undefined, rows));
    await controller.selectFile(new File(["data"], "data.csv"));
    const interval = root.querySelector<HTMLSelectElement>("#analysis-interval");
    if (interval === null) throw new Error("Missing interval control.");
    interval.value = "daily";
    interval.dispatchEvent(new Event("change", { bubbles: true }));
    controller.runAnalysis();
    const before = chart.render.mock.calls.length;
    root.querySelector<HTMLButtonElement>("#processed-table-container .pagination button:last-child")?.click();
    expect(chart.render).toHaveBeenCalledTimes(before);
  });

  it("opens and closes the expanded view without rerunning analysis", async () => {
    const { root, controller, analyze } = setup();
    await controller.selectFile(new File(["data"], "data.csv"));
    controller.runAnalysis();
    const overlay = root.querySelector<HTMLElement>("#expanded-chart-overlay")!;
    const expand = root.querySelector<HTMLButtonElement>("#expand-chart")!;
    const close = root.querySelector<HTMLButtonElement>("#close-expanded-chart")!;

    expand.click();
    expect(overlay.hidden).toBe(false);
    expect(expand.getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(close);
    expect(root.querySelector("#expanded-chart-viewport #chart-surface")).not.toBeNull();
    expect(analyze).toHaveBeenCalledOnce();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(overlay.hidden).toBe(true);
    expect(expand.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(expand);
    expect(root.querySelector("#chart-viewport #chart-surface")).not.toBeNull();
    expect(analyze).toHaveBeenCalledOnce();
  });

  it("resets chart zoom without rerunning analysis", async () => {
    const { root, controller, analyze, chart } = setup();
    await controller.selectFile(new File(["data"], "data.csv"));
    controller.runAnalysis();

    root.querySelector<HTMLButtonElement>("#reset-chart-zoom")!.click();

    expect(chart.resetZoom).toHaveBeenCalledOnce();
    expect(analyze).toHaveBeenCalledOnce();
    expect(root.querySelector("#chart-interaction-status")?.textContent).toContain("Chart zoom reset");
  });

  it("exports the currently filtered chart as a local visualization snapshot", async () => {
    const rows = [
      { area: "A", date: "2024-01-01", count: "1" },
      { area: "B", date: "2024-01-01", count: "2" },
      { area: "B", date: "2024-02-01", count: "3" },
    ];
    const toDataURL = vi.spyOn(HTMLCanvasElement.prototype, "toDataURL")
      .mockReturnValue("data:image/png;base64,c2FmZQ==");
    const { root, controller, analyze, downloadVisualization } = setup(result(undefined, rows));
    await controller.selectFile(new File(["data"], "data.csv"));
    controller.runAnalysis();
    const areaCheckboxes = [...root.querySelectorAll<HTMLInputElement>("#area-filter input[type=checkbox]")];
    areaCheckboxes.forEach((input) => {
      input.checked = input.nextElementSibling?.textContent === "B";
    });
    areaCheckboxes[0]?.dispatchEvent(new Event("change", { bubbles: true }));

    root.querySelector<HTMLButtonElement>("#export-visualization")!.click();

    expect(analyze).toHaveBeenCalledOnce();
    expect(downloadVisualization).toHaveBeenCalledOnce();
    expect(downloadVisualization.mock.calls[0]?.[0]).toMatchObject({
      date_start: "2024-01-01",
      date_end: "2024-02-01",
      series_names: ["B"],
      threshold: 4,
      baseline_window: 36,
      analysis_interval: "monthly",
      image_data_url: "data:image/png;base64,c2FmZQ==",
    });
    expect(root.querySelector("#export-status")?.textContent).toContain("cusum-visualization-2026-09-15.html");
    toDataURL.mockRestore();
  });

  it("exports all, filtered, and alert-only completed results locally", async () => {
    const { root, controller, download } = setup();
    await controller.selectFile(new File(["data"], "data.csv"));
    controller.runAnalysis();
    root.querySelector<HTMLButtonElement>("#export-all")?.click();
    root.querySelector<HTMLButtonElement>("#export-filtered")?.click();
    root.querySelector<HTMLButtonElement>("#export-alerts")?.click();
    expect(download.mock.calls.map((call) => call[1])).toEqual([
      "processed-results",
      "filtered-results",
      "alerts",
    ]);
  });

  it("renders no more than the selected processed-table page size", async () => {
    const rows = Array.from({ length: 60 }, (_, index) => ({
      area: "A",
      date: `2024-${String(Math.floor(index / 28) + 1).padStart(2, "0")}-${String(index % 28 + 1).padStart(2, "0")}`,
      count: String(index),
    }));
    const { root, controller } = setup(result(undefined, rows));
    await controller.selectFile(new File(["data"], "data.csv"));
    const interval = root.querySelector<HTMLSelectElement>("#analysis-interval");
    if (interval === null) throw new Error("Missing interval control.");
    interval.value = "daily";
    interval.dispatchEvent(new Event("change", { bubbles: true }));
    controller.runAnalysis();
    expect(root.querySelectorAll("#processed-table-container tbody tr")).toHaveLength(25);
    const pageSize = root.querySelector<HTMLSelectElement>("#processed-table-container select");
    if (pageSize === null) throw new Error("Missing page-size control.");
    pageSize.value = "50";
    pageSize.dispatchEvent(new Event("change", { bubbles: true }));
    expect(root.querySelectorAll("#processed-table-container tbody tr")).toHaveLength(50);
  });

  it("shows strata controls and columns only for stratified results", async () => {
    const withRisk = setup(result(
      ["area", "date", "count", "risk_group"],
      [
        { area: "A", date: "2024-01-01", count: "1", risk_group: "High" },
        { area: "A", date: "2024-01-02", count: "2", risk_group: "Low" },
      ],
    ));
    await withRisk.controller.selectFile(new File(["data"], "data.csv"));
    const group = withRisk.root.querySelector<HTMLInputElement>("#group-risk");
    if (group === null) throw new Error("Missing grouping control.");
    group.checked = true;
    group.dispatchEvent(new Event("change", { bubbles: true }));
    withRisk.controller.runAnalysis();
    expect(withRisk.root.querySelector("#risk-filter")?.closest<HTMLElement>(".filter-control")?.hidden).toBe(false);
    expect(withRisk.root.querySelector("#processed-table-container thead")?.textContent).toContain("Strata");
  });

  it("destroys chart state on Clear Data", async () => {
    const { controller, chart } = setup();
    await controller.selectFile(new File(["data"], "data.csv"));
    controller.runAnalysis();
    const previousClears = chart.clear.mock.calls.length;
    controller.clearData();
    expect(chart.clear.mock.calls.length).toBeGreaterThan(previousClears);
  });

  it("activates the file input from anywhere in the native upload box", () => {
    const { root } = setup();
    const fileInput = root.querySelector<HTMLInputElement>("#file-input");
    const dropZone = root.querySelector<HTMLButtonElement>("#drop-zone");
    if (fileInput === null || dropZone === null) throw new Error("Missing upload controls.");
    const click = vi.spyOn(fileInput, "click").mockImplementation(() => undefined);
    dropZone.querySelector<HTMLElement>(".drop-zone-copy")!.click();
    expect(click).toHaveBeenCalledOnce();
  });

  it("activates the file input from the upload box keyboard control", () => {
    const { root } = setup();
    const fileInput = root.querySelector<HTMLInputElement>("#file-input");
    const dropZone = root.querySelector<HTMLButtonElement>("#drop-zone");
    if (fileInput === null || dropZone === null) throw new Error("Missing upload controls.");
    const click = vi.spyOn(fileInput, "click").mockImplementation(() => undefined);
    const event = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    dropZone.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(click).toHaveBeenCalledOnce();
  });

  it("routes dropped files through the same import workflow", async () => {
    const { root, controller } = setup();
    const dropZone = root.querySelector<HTMLElement>("#drop-zone");
    const dropped = new File(["data"], "dropped.csv");
    const dragEnter = new Event("dragenter", { bubbles: true, cancelable: true });
    dropZone?.dispatchEvent(dragEnter);
    expect(dropZone?.classList.contains("is-dragging")).toBe(true);
    const event = new Event("drop", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "dataTransfer", { value: { files: [dropped] } });
    dropZone?.dispatchEvent(event);
    expect(dropZone?.classList.contains("is-dragging")).toBe(false);
    await vi.waitFor(() => expect(controller.getState().metadata?.filename).toBe("dropped.csv"));
  });
});
