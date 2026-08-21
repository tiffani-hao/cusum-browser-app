// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { AnalysisResult, ProcessedCusumRecord } from "../src/core";
import {
  DEFAULT_DISEASE_PRESET,
  DISEASE_PRESETS,
} from "../src/config";
import type { FileParsingResult } from "../src/import";
import { createWorkflowApp } from "../src/ui/workflow-app";

function parsed(withRiskGroup = false): FileParsingResult {
  const columns = withRiskGroup
    ? ["area", "date", "count", "risk_group"]
    : ["area", "date", "count"];
  const rows = withRiskGroup
    ? [{ area: "Area A", date: "2024-01-01", count: "1", risk_group: "Group 1" }]
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
  it("configures only HIV and Custom, with exact HIV values", () => {
    const { root, controller } = setup();
    const select = root.querySelector<HTMLSelectElement>("#disease-preset")!;
    expect(DISEASE_PRESETS).toHaveLength(1);
    expect([...select.options].map((option) => option.textContent)).toEqual(["HIV", "Custom"]);
    expect(select.value).toBe("hiv");
    expect(controller.getState().disease_preset).toBe("hiv");
    expect(DEFAULT_DISEASE_PRESET).toEqual({
      id: "hiv",
      label: "HIV",
      options: {
        analysis_interval: "monthly",
        smoothing_window: 3,
        baseline_window: 36,
        k: 0.1,
        threshold: 3,
        group_by_risk_group: false,
      },
    });
  });

  it("switches manual edits to Custom without running analysis", async () => {
    const { root, controller, analyze } = setup();
    await controller.selectFile(new File(["synthetic"], "synthetic.csv"));
    const threshold = root.querySelector<HTMLInputElement>("#threshold")!;
    threshold.value = "4";
    threshold.dispatchEvent(new Event("change", { bubbles: true }));
    expect(root.querySelector<HTMLSelectElement>("#disease-preset")?.value).toBe("custom");
    expect(controller.getState().options.threshold).toBe(4);
    expect(analyze).not.toHaveBeenCalled();
  });

  it("keeps current values when Custom is selected and reapplies exact HIV values", async () => {
    const { root, controller, analyze } = setup();
    await controller.selectFile(new File(["synthetic"], "synthetic.csv"));
    const threshold = root.querySelector<HTMLInputElement>("#threshold")!;
    threshold.value = "4";
    threshold.dispatchEvent(new Event("change", { bubbles: true }));
    const preset = root.querySelector<HTMLSelectElement>("#disease-preset")!;
    preset.value = "custom";
    preset.dispatchEvent(new Event("change", { bubbles: true }));
    expect(controller.getState().options.threshold).toBe(4);
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
    threshold.value = "4";
    threshold.dispatchEvent(new Event("change", { bubbles: true }));
    expect(controller.getState().disease_preset).toBe("custom");
    root.querySelector<HTMLButtonElement>("#restore-defaults")!.click();
    expect(controller.getState().disease_preset).toBe("hiv");
    expect(controller.getState().options).toEqual(DEFAULT_DISEASE_PRESET.options);
    expect(controller.getState().file?.name).toBe("selected.csv");
    expect(controller.getState().result_view.result_stale).toBe(true);
    expect(analyze).toHaveBeenCalledOnce();
  });

  it("resets risk-group grouping when HIV is selected", async () => {
    const { root, controller } = setup(completedResult([]), true);
    await controller.selectFile(new File(["synthetic"], "synthetic.csv"));
    const grouping = root.querySelector<HTMLInputElement>("#group-risk")!;
    grouping.checked = true;
    grouping.dispatchEvent(new Event("change", { bubbles: true }));
    expect(controller.getState().disease_preset).toBe("custom");
    const preset = root.querySelector<HTMLSelectElement>("#disease-preset")!;
    preset.value = "hiv";
    preset.dispatchEvent(new Event("change", { bubbles: true }));
    expect(grouping.checked).toBe(false);
    expect(controller.getState().options.group_by_risk_group).toBe(false);
  });
});

describe("Results, alerts, and Help", () => {
  it("shows four approved KPI cards without duplicated settings", async () => {
    const { root, controller } = setup(completedResult([record(1, true)]));
    await controller.selectFile(new File(["synthetic"], "synthetic.csv"));
    controller.runAnalysis();
    expect(root.querySelectorAll("#analysis-summary > div")).toHaveLength(4);
    expect(root.querySelector("#analysis-summary")?.textContent).not.toContain("Independent series");
    expect(root.textContent).not.toContain("Active analytical settings");
    expect(root.querySelector("#active-settings")).toBeNull();
  });

  it("uses a compact no-alert state without rendering a table", async () => {
    const { root, controller } = setup(completedResult([record(1, false)]));
    await controller.selectFile(new File(["synthetic"], "synthetic.csv"));
    controller.runAnalysis();
    const alerts = root.querySelector<HTMLElement>("#alert-table-container")!;
    expect(alerts.textContent).toContain("No alerts match the current display filters.");
    expect(alerts.querySelector("table")).toBeNull();
  });

  it("summarizes alerts, previews five, and expands and collapses", async () => {
    const alerts = Array.from({ length: 7 }, (_, index) =>
      record(index + 1, true, index % 2 === 0 ? "Group 1" : "Group 2")
    );
    const { root, controller } = setup(completedResult(alerts));
    await controller.selectFile(new File(["synthetic"], "synthetic.csv"));
    controller.runAnalysis();
    const container = root.querySelector<HTMLElement>("#alert-table-container")!;
    expect(container.querySelector(".alert-summary")?.textContent).toContain("Displayed alerts7");
    expect(container.querySelectorAll("tbody tr")).toHaveLength(5);
    expect(container.querySelector("thead")?.textContent).toContain("Risk group");
    const showAll = [...container.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.textContent?.startsWith("Show all alerts"))!;
    showAll.click();
    expect(container.querySelectorAll("tbody tr")).toHaveLength(7);
    const collapse = [...container.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.textContent === "Collapse alerts")!;
    collapse.click();
    expect(container.querySelectorAll("tbody tr")).toHaveLength(5);
  });

  it("opens and closes Help accessibly, handles Escape, and returns focus", () => {
    const { root } = setup();
    const help = root.querySelector<HTMLButtonElement>("#help-button")!;
    const overlay = root.querySelector<HTMLElement>("#help-overlay")!;
    expect(overlay.hidden).toBe(true);
    expect(root.querySelector("main .help-panel")).toBeNull();
    help.click();
    expect(overlay.hidden).toBe(false);
    expect(document.activeElement).toBe(root.querySelector("#close-help"));
    expect(root.querySelectorAll(".sample-link")).toHaveLength(5);
    expect(root.querySelector("#help-dialog")?.textContent).toContain("CUSUM methodology");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(overlay.hidden).toBe(true);
    expect(document.activeElement).toBe(help);
    help.click();
    root.querySelector<HTMLButtonElement>("#close-help")!.click();
    expect(overlay.hidden).toBe(true);
    expect(document.activeElement).toBe(help);
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
      alert_count: records.filter((item) => item.is_alert).length,
      maximum_cusum: records.length === 0 ? 0 : Math.max(...records.map((item) => item.cusum)),
      analysis_interval: "monthly",
      smoothing_window: 3,
      baseline_window: 36,
      k: 0.1,
      threshold: 3,
      areas_included: new Set(records.map((item) => item.area)).size,
      risk_groups_included: [...new Set(records.flatMap((item) => item.risk_group ?? []))],
      alerts_detected: records.filter((item) => item.is_alert).length,
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
