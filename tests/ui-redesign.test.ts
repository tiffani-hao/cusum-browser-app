// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { identifyAlertEpisodes } from "../src/core";
import type { AnalysisResult, ProcessedCusumRecord } from "../src/core";
import {
  DEFAULT_DISEASE_PRESET,
  DISEASE_PRESETS,
} from "../src/config";
import type { FileParsingResult } from "../src/import";
import { createWorkflowApp } from "../src/ui/workflow-app";

function parsed(withRiskGroup = false): FileParsingResult {
  const columns = withRiskGroup
    ? ["area", "date", "count", "strata"]
    : ["area", "date", "count"];
  const rows = withRiskGroup
    ? [{ area: "Area A", date: "2024-01-01", count: "1", strata: "Group 1" }]
    : [{ area: "Area A", date: "2024-01-01", count: "1" }];
  return {
    success: true,
    metadata: {
      filename: "synthetic.csv",
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

function setup(
  analysisResult: AnalysisResult = completedResult([]),
  withRiskGroup = false,
) {
  document.body.innerHTML = '<div id="app"></div>';
  const root = document.querySelector<HTMLElement>("#app")!;
  const analyze = vi.fn(() => analysisResult);
  const controller = createWorkflowApp(root, {
    importFile: vi.fn(async () => parsed(withRiskGroup)),
    analyze,
    chart: { render: vi.fn(), clear: vi.fn() },
    download: vi.fn(() => "neutral.csv"),
  });
  return { root, controller, analyze };
}

describe("compact workflow redesign", () => {
  it("uses a compact header containing only the approved title and Help", () => {
    const { root } = setup();
    const header = root.querySelector<HTMLElement>("#application-header")!;
    expect(header.querySelector("h1")?.textContent).toBe("CUSUM-Based Early Detection Tool");
    expect(header.querySelectorAll("button")).toHaveLength(1);
    expect(header.querySelector("button")?.textContent).toBe("Help");
    expect(header.querySelector("p")).toBeNull();
    expect(header.textContent).not.toContain("Browser-local surveillance analysis");
    expect(header.textContent).not.toContain("uploaded to a server");
  });

  it("uses unnumbered vertical workflow headings", async () => {
    const { root, controller } = setup();
    await controller.selectFile(new File(["synthetic"], "synthetic.csv"));
    controller.runAnalysis();
    const headings = [...root.querySelectorAll("main h2")].map((heading) => heading.textContent);
    expect(headings).toEqual(["Upload data", "File validation", "Analysis settings", "Results"]);
    expect(root.querySelectorAll(".step-label")).toHaveLength(0);
    expect(root.querySelector("main")?.textContent).not.toMatch(/\bStep [1-4]\b/);
    expect(root.querySelector("#privacy-note")?.textContent).toBe("Processed locally in your browser.");
    expect(root.querySelector("#upload-heading")?.parentElement?.textContent).toContain(
      "Select data file for analysis. For instructions, see Help.",
    );
  });

  it("opens the existing Help dialog from the upload instructions", () => {
    const { root } = setup();
    root.querySelector<HTMLButtonElement>("#upload-help-link")!.click();
    expect(root.querySelector<HTMLElement>("#help-overlay")?.hidden).toBe(false);
  });

  it("shows the canonical strata name for a legacy compatibility header", async () => {
    const legacy = parsed(true);
    if (!legacy.success) throw new Error("Expected parsed fixture");
    legacy.metadata.columns = ["area", "date", "count", "risk_group"];
    legacy.table.columns = ["area", "date", "count", "risk_group"];
    legacy.table.rows = [{ area: "Area A", date: "2024-01-01", count: "1", risk_group: "Group 1" }];
    document.body.innerHTML = '<div id="app"></div>';
    const root = document.querySelector<HTMLElement>("#app")!;
    const controller = createWorkflowApp(root, {
      importFile: vi.fn(async () => legacy),
      analyze: vi.fn(() => completedResult([])),
      chart: { render: vi.fn(), clear: vi.fn() },
      download: vi.fn(() => "neutral.csv"),
    });
    await controller.selectFile(new File(["synthetic"], "synthetic.csv"));
    const summary = root.querySelector("#file-summary")?.textContent ?? "";
    expect(summary).toContain("Detected columnsarea, date, count, strata");
    expect(summary).not.toContain("risk_group");
  });

  it("offers the existing synthetic samples in a compact download dialog", () => {
    const { root } = setup();
    const open = root.querySelector<HTMLButtonElement>("#open-sample-data")!;
    const overlay = root.querySelector<HTMLElement>("#sample-data-overlay")!;
    expect(open.textContent).toBe("Download Sample Data");
    open.click();
    expect(overlay.hidden).toBe(false);
    expect(document.activeElement).toBe(root.querySelector("#close-sample-data"));
    const links = [...root.querySelectorAll<HTMLAnchorElement>(".sample-download-link")];
    expect(links.map((link) => link.textContent)).toEqual([
      "Basic monthly example",
      "Daily example",
      "Five-year daily example",
      "Stratified monthly example",
      "XLSX monthly example",
    ]);
    expect(links.map((link) => link.getAttribute("download"))).toEqual([
      "basic-example.csv",
      "daily-example.csv",
      "five-year-daily-example.csv",
      "stratified-monthly-example.csv",
      "synthetic-example.xlsx",
    ]);
    expect(links.every((link) => link.href.includes("/sample-data/"))).toBe(true);
    root.querySelector<HTMLButtonElement>("#close-sample-data")!.click();
    expect(overlay.hidden).toBe(true);
    expect(document.activeElement).toBe(open);
  });

  it("defines the dark-purple theme as reusable custom properties", () => {
    const css = readFileSync(join(process.cwd(), "src/styles.css"), "utf8");
    expect(css).toContain("--purple-950: #24123d");
    expect(css).toContain("--purple-700: #55308a");
    expect(css).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(css).toContain("@media (max-width: 38rem)");
  });
});

describe("disease preset behavior", () => {
  it("configures only Default (HIV) and Custom, with the exact default values", () => {
    const { root, controller } = setup();
    const select = root.querySelector<HTMLSelectElement>("#disease-preset")!;
    expect(DISEASE_PRESETS).toHaveLength(1);
    expect([...select.options].map((option) => option.textContent)).toEqual(["Default (HIV)", "Custom"]);
    expect(select.value).toBe("hiv");
    expect(controller.getState().disease_preset).toBe("hiv");
    expect(DEFAULT_DISEASE_PRESET).toEqual({
      id: "hiv",
      label: "Default (HIV)",
      options: {
        analysis_interval: "monthly",
        smoothing_window: 3,
        baseline_window: 36,
        k: 0.1,
        threshold: 4,
        group_by_risk_group: false,
      },
    });
  });

  it("uses Custom only while preset-controlled values differ from Default (HIV)", async () => {
    const { root, controller, analyze } = setup();
    await controller.selectFile(new File(["synthetic"], "synthetic.csv"));
    const threshold = root.querySelector<HTMLInputElement>("#threshold")!;
    threshold.value = "5";
    threshold.dispatchEvent(new Event("change", { bubbles: true }));
    expect(root.querySelector<HTMLSelectElement>("#disease-preset")?.value).toBe("custom");
    expect(controller.getState().options.threshold).toBe(5);
    expect(analyze).not.toHaveBeenCalled();
    threshold.value = "4";
    threshold.dispatchEvent(new Event("change", { bubbles: true }));
    expect(root.querySelector<HTMLSelectElement>("#disease-preset")?.value).toBe("hiv");
    expect(controller.getState().disease_preset).toBe("hiv");
  });

  it("keeps current values when Custom is selected and reapplies exact HIV values", async () => {
    const { root, controller, analyze } = setup();
    await controller.selectFile(new File(["synthetic"], "synthetic.csv"));
    const threshold = root.querySelector<HTMLInputElement>("#threshold")!;
    threshold.value = "5";
    threshold.dispatchEvent(new Event("change", { bubbles: true }));
    const preset = root.querySelector<HTMLSelectElement>("#disease-preset")!;
    preset.value = "custom";
    preset.dispatchEvent(new Event("change", { bubbles: true }));
    expect(controller.getState().options.threshold).toBe(5);
    preset.value = "hiv";
    preset.dispatchEvent(new Event("change", { bubbles: true }));
    expect(controller.getState().options).toEqual(DEFAULT_DISEASE_PRESET.options);
    expect(analyze).not.toHaveBeenCalled();
  });

  it("marks results stale on preset changes and Restore Defaults preserves the file", async () => {
    const { root, controller, analyze } = setup();
    await controller.selectFile(new File(["synthetic"], "selected.csv"));
    controller.runAnalysis();
    const threshold = root.querySelector<HTMLInputElement>("#threshold")!;
    threshold.value = "5";
    threshold.dispatchEvent(new Event("change", { bubbles: true }));
    expect(controller.getState().disease_preset).toBe("custom");
    root.querySelector<HTMLButtonElement>("#restore-defaults")!.click();
    expect(controller.getState().disease_preset).toBe("hiv");
    expect(controller.getState().options).toEqual(DEFAULT_DISEASE_PRESET.options);
    expect(controller.getState().file?.name).toBe("selected.csv");
    expect(controller.getState().result_view.result_stale).toBe(true);
    expect(analyze).toHaveBeenCalledOnce();
  });

  it("keeps Default (HIV) selected when stratification changes", async () => {
    const { root, controller } = setup(completedResult([]), true);
    await controller.selectFile(new File(["synthetic"], "synthetic.csv"));
    expect(controller.getState().options.group_by_risk_group).toBe(true);
    expect(controller.getState().disease_preset).toBe("hiv");
    controller.runAnalysis();
    const grouping = root.querySelector<HTMLInputElement>("#group-risk")!;
    grouping.checked = false;
    grouping.dispatchEvent(new Event("change", { bubbles: true }));
    expect(controller.getState().disease_preset).toBe("hiv");
    expect(controller.getState().options.group_by_risk_group).toBe(false);
    expect(controller.getState().result_view.result_stale).toBe(true);
    grouping.checked = true;
    grouping.dispatchEvent(new Event("change", { bubbles: true }));
    expect(controller.getState().disease_preset).toBe("hiv");
    expect(controller.getState().options.group_by_risk_group).toBe(true);
  });

  it("keeps Custom selected when stratification changes after a parameter edit", async () => {
    const { root, controller } = setup(completedResult([]), true);
    await controller.selectFile(new File(["synthetic"], "synthetic.csv"));
    const threshold = root.querySelector<HTMLInputElement>("#threshold")!;
    threshold.value = "5";
    threshold.dispatchEvent(new Event("change", { bubbles: true }));
    const grouping = root.querySelector<HTMLInputElement>("#group-risk")!;
    grouping.checked = true;
    grouping.dispatchEvent(new Event("change", { bubbles: true }));
    expect(controller.getState().disease_preset).toBe("custom");
    expect(controller.getState().options.group_by_risk_group).toBe(true);
  });
});

describe("Results, alerts, and Help", () => {
  it("shows four approved KPI cards without duplicated settings", async () => {
    const records = [
      { ...record(1, true), area: "Area A", date: "2024-01-01" },
      { ...record(2, true), area: "Area A", date: "2024-02-01" },
    ];
    const { root, controller } = setup(completedResult(records));
    await controller.selectFile(new File(["synthetic"], "synthetic.csv"));
    controller.runAnalysis();
    expect(root.querySelectorAll("#analysis-summary > div")).toHaveLength(4);
    expect(root.querySelector("#analysis-summary")?.textContent).not.toContain("Independent series");
    expect(root.textContent).not.toContain("Active analytical settings");
    expect(root.querySelector("#active-settings")).toBeNull();
    expect(root.querySelector("#analysis-summary")?.textContent).toContain("Alerts1");
  });

  it("uses a compact no-alert state without rendering a table", async () => {
    const { root, controller } = setup(completedResult([record(1, false)]));
    await controller.selectFile(new File(["synthetic"], "synthetic.csv"));
    controller.runAnalysis();
    const alerts = root.querySelector<HTMLElement>("#alert-table-container")!;
    expect(alerts.querySelector(".alert-summary")?.textContent).toBe(
      "Total alert episodes0Currently active0Inactive0Series with alerts0",
    );
    expect(alerts.textContent).toContain("No alert episodes match the current display filters.");
    expect(alerts.querySelector("table")).toBeNull();
  });

  it("summarizes active alert episodes, previews five, and expands and collapses", async () => {
    const records = Array.from({ length: 6 }, (_, index) => [
      { ...record(1, false, "Group 1"), area: `Area ${index + 1}`, date: "2024-01-01" },
      { ...record(2, true, "Group 1"), area: `Area ${index + 1}`, date: "2024-02-01" },
    ]).flat();
    const { root, controller } = setup(completedResult(records));
    await controller.selectFile(new File(["synthetic"], "synthetic.csv"));
    controller.runAnalysis();
    const container = root.querySelector<HTMLElement>("#alert-table-container")!;
    expect(container.querySelector(".alert-summary")?.textContent).toBe(
      "Total alert episodes6Currently active6Inactive0Series with alerts6",
    );
    expect(container.querySelectorAll("tbody tr")).toHaveLength(5);
    expect([...container.querySelectorAll("thead th")].map((header) => header.textContent)).toEqual([
      "Area",
      "Strata",
      "Start Date",
      "End Date",
      "Periods",
      "Total Cases",
    ]);
    const showAll = [...container.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.textContent?.startsWith("Show all alert episodes"))!;
    showAll.click();
    expect(container.querySelectorAll("tbody tr")).toHaveLength(6);
    const collapse = [...container.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.textContent === "Collapse alert episodes")!;
    collapse.click();
    expect(container.querySelectorAll("tbody tr")).toHaveLength(5);
  });

  it("hides inactive episodes by default and reveals them without rerunning analysis", async () => {
    const records = [
      { ...record(1, false), area: "Area A", date: "2024-01-01", count: 1 },
      { ...record(2, true), area: "Area A", date: "2024-02-01", count: 2 },
      { ...record(3, false), area: "Area A", date: "2024-03-01", count: 3 },
      { ...record(4, true), area: "Area A", date: "2024-04-01", count: 4 },
    ];
    const { root, controller, analyze } = setup(completedResult(records));
    await controller.selectFile(new File(["synthetic"], "synthetic.csv"));
    controller.runAnalysis();
    const container = root.querySelector<HTMLElement>("#alert-table-container")!;
    const completeSummary = "Total alert episodes2Currently active1Inactive1Series with alerts1";
    expect(container.querySelector(".alert-summary")?.textContent).toBe(completeSummary);
    expect(container.querySelectorAll("tbody tr")).toHaveLength(1);
    expect([...container.querySelectorAll("tbody td")].map((cell) => cell.textContent)).toEqual([
      "Area A", "—", "2024-04-01", "2024-04-01", "1", "4",
    ]);
    const showInactive = container.querySelector<HTMLInputElement>(".alert-history-toggle input")!;
    expect(showInactive.checked).toBe(false);
    showInactive.checked = true;
    showInactive.dispatchEvent(new Event("change", { bubbles: true }));
    expect(container.querySelectorAll("tbody tr")).toHaveLength(2);
    expect(container.querySelector(".alert-summary")?.textContent).toBe(completeSummary);
    expect(controller.getState().result_view.show_inactive_alerts).toBe(true);
    expect(analyze).toHaveBeenCalledOnce();
  });

  it("keeps the complete alert dashboard visible when every episode is inactive", async () => {
    const records = [
      { ...record(1, false), area: "Area A", date: "2024-01-01" },
      { ...record(2, true), area: "Area A", date: "2024-02-01" },
      { ...record(3, false), area: "Area A", date: "2024-03-01" },
    ];
    const { root, controller } = setup(completedResult(records));
    await controller.selectFile(new File(["synthetic"], "synthetic.csv"));
    controller.runAnalysis();
    const container = root.querySelector<HTMLElement>("#alert-table-container")!;
    expect(container.querySelector(".alert-summary")?.textContent).toBe(
      "Total alert episodes1Currently active0Inactive1Series with alerts1",
    );
    expect(container.querySelector("table")).toBeNull();
    const showInactive = container.querySelector<HTMLInputElement>(".alert-history-toggle input")!;
    showInactive.checked = true;
    showInactive.dispatchEvent(new Event("change", { bubbles: true }));
    expect(container.querySelectorAll("tbody tr")).toHaveLength(1);
    expect(container.querySelector(".alert-summary")?.textContent).toBe(
      "Total alert episodes1Currently active0Inactive1Series with alerts1",
    );
  });

  it("summarizes unique stratified series across all areas independently of display filters", async () => {
    const records = [
      { ...record(1, true, "Group 1"), area: "Area A", date: "2024-01-01" },
      { ...record(2, true, "Group 2"), area: "Area A", date: "2024-01-01" },
      { ...record(3, true, "Group 1"), area: "Area B", date: "2024-01-01" },
    ];
    const { root, controller, analyze } = setup(completedResult(records), true);
    await controller.selectFile(new File(["synthetic"], "synthetic.csv"));
    controller.runAnalysis();
    const container = root.querySelector<HTMLElement>("#alert-table-container")!;
    const completeSummary = "Total alert episodes3Currently active3Inactive0Series with alerts3";
    expect(container.querySelector(".alert-summary")?.textContent).toBe(completeSummary);
    const areaFilter = root.querySelector<HTMLSelectElement>("#area-filter")!;
    [...areaFilter.options].forEach((option) => { option.selected = option.value === "Area A"; });
    areaFilter.dispatchEvent(new Event("change", { bubbles: true }));
    const strataFilter = root.querySelector<HTMLSelectElement>("#risk-filter")!;
    [...strataFilter.options].forEach((option) => { option.selected = option.value === "Group 1"; });
    strataFilter.dispatchEvent(new Event("change", { bubbles: true }));
    expect(container.querySelector(".alert-summary")?.textContent).toBe(completeSummary);
    expect(container.querySelectorAll("tbody tr")).toHaveLength(1);
    expect(analyze).toHaveBeenCalledOnce();
  });

  it("opens and closes Help accessibly, handles Escape, and returns focus", () => {
    const { root } = setup();
    const help = root.querySelector<HTMLButtonElement>("#help-button")!;
    const overlay = root.querySelector<HTMLElement>("#help-overlay")!;
    expect(overlay.hidden).toBe(true);
    expect(root.querySelector("main .help-panel")).toBeNull();
    help.click();
    expect(overlay.hidden).toBe(false);
    expect(document.body.classList.contains("help-open")).toBe(true);
    expect(document.activeElement).toBe(root.querySelector("#close-help"));
    expect(root.querySelectorAll(".sample-link")).toHaveLength(5);
    expect(root.querySelector("#help-dialog")?.textContent).toContain("About this tool");
    expect(root.querySelector("#help-dialog")?.textContent).toContain(
      "Select Custom to specify your own CUSUM settings",
    );
    expect(root.querySelector("#help-dialog")?.textContent).toContain("About CUSUM");
    const body = root.querySelector<HTMLElement>(".help-dialog-body")!;
    body.scrollTop = 200;
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(overlay.hidden).toBe(true);
    expect(document.body.classList.contains("help-open")).toBe(false);
    expect(document.activeElement).toBe(help);
    help.click();
    expect(body.scrollTop).toBe(0);
    root.querySelector<HTMLButtonElement>("#close-help")!.click();
    expect(overlay.hidden).toBe(true);
    expect(document.activeElement).toBe(help);
  });

  it("provides unnumbered section navigation and collapsed troubleshooting disclosures", () => {
    const { root } = setup();
    const expectedSections = [
      ["About this tool", "#help-about"],
      ["Preparing and uploading data", "#help-uploading"],
      ["Presets and analysis settings", "#help-settings"],
      ["Initial baseline period", "#help-baseline"],
      ["Understanding the graph and alerts", "#help-graph"],
      ["Display filters", "#help-filters"],
      ["Exporting results", "#help-exporting"],
      ["Privacy and browser session", "#help-privacy"],
      ["Troubleshooting", "#help-troubleshooting"],
    ] as const;
    const navigation = root.querySelector<HTMLElement>(".help-section-nav")!;
    const links = [...navigation.querySelectorAll<HTMLAnchorElement>("a")];
    expect(navigation.getAttribute("aria-label")).toBe("Help sections");
    expect(links.map((link) => [link.textContent, link.getAttribute("href")])).toEqual(expectedSections);
    links.forEach((link) => expect(root.querySelector(link.getAttribute("href")!)).not.toBeNull());
    expect(navigation.textContent).not.toContain("Contents");
    const headings = [...root.querySelectorAll(".help-dialog-body > section > h3")]
      .map((heading) => heading.textContent);
    expect(headings).toEqual([...expectedSections.map(([heading]) => heading), "About CUSUM"]);
    expect(headings.every((heading) => !/^\d+\./.test(heading ?? ""))).toBe(true);

    const disclosures = [...root.querySelectorAll<HTMLDetailsElement>(".help-troubleshooting details")];
    expect(disclosures).toHaveLength(6);
    expect(disclosures.every((details) => !details.open)).toBe(true);
    disclosures[0]?.querySelector("summary")?.click();
    expect(disclosures[0]?.open).toBe(true);
    expect(disclosures.slice(1).every((details) => !details.open)).toBe(true);

    root.querySelector<HTMLButtonElement>("#help-button")!.click();
    const summaries = [...root.querySelectorAll<HTMLElement>(".help-troubleshooting summary")];
    const lastSummary = summaries.at(-1)!;
    lastSummary.focus();
    lastSummary.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(root.querySelector("#close-help"));
    root.querySelector<HTMLButtonElement>("#close-help")!.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true }),
    );
    expect(document.activeElement).toBe(lastSummary);
    root.querySelector<HTMLButtonElement>("#close-help")!.click();
  });

  it("keeps the requested examples, large desktop sizing, and narrow-screen override", () => {
    const { root } = setup();
    expect(root.querySelector('pre[aria-label="Basic CSV format"]')?.textContent).toBe(
      "area,date,count\nArea A,2024-01-01,5\nArea A,2024-02-01,7",
    );
    expect(root.querySelector('pre[aria-label="Stratified CSV format"]')?.textContent).toBe(
      "area,date,count,strata\nArea A,2024-01-01,5,Group 1\nArea A,2024-02-01,7,Group 1",
    );
    expect(root.querySelector("#help-dialog")?.textContent?.toLowerCase()).not.toContain("risk group");
    expect(root.querySelector<HTMLAnchorElement>('a[download="cusum-strata-example.csv"]')?.href)
      .toContain("/sample-data/strata-example.csv");
    const css = readFileSync(join(process.cwd(), "src/styles.css"), "utf8");
    expect(css).toContain("width: min(82vw, 82rem)");
    expect(css).toContain("height: min(88vh, 56rem)");
    expect(css).toContain("grid-template-rows: auto minmax(0, 1fr)");
    expect(css).toContain("height: 100vh");
  });
});

function completedResult(records: ProcessedCusumRecord[]): AnalysisResult {
  return {
    success: true,
    records,
    summary: {
      input_row_count: records.length,
      processed_row_count: records.length,
      independent_series_count: new Set(records.map((item) => item.area)).size,
      alert_count: identifyAlertEpisodes(records).length,
      maximum_cusum: records.length === 0 ? 0 : Math.max(...records.map((item) => item.cusum)),
      analysis_interval: "monthly",
      smoothing_window: 3,
      baseline_window: 36,
      k: 0.1,
      threshold: 3,
      areas_included: new Set(records.map((item) => item.area)).size,
      risk_groups_included: [...new Set(records.flatMap((item) => item.risk_group ?? []))],
      alerts_detected: identifyAlertEpisodes(records).length,
    },
  };
}

function record(index: number, isAlert: boolean, riskGroup?: string): ProcessedCusumRecord {
  return {
    area: index % 2 === 0 ? "Area B" : "Area A",
    ...(riskGroup === undefined ? {} : { risk_group: riskGroup }),
    date: `2024-${String(index).padStart(2, "0")}-01`,
    count: index,
    smoothed_count: index,
    baseline_mean: 1,
    baseline_std: 1,
    normalized_count: index - 1,
    cusum: isAlert ? 3 + index / 10 : 0,
    threshold: 3,
    is_alert: isAlert,
  };
}
