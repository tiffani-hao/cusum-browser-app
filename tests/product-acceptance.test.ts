// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { analyzeCusum, DEFAULT_ANALYSIS_OPTIONS } from "../src/core";
import type { AnalysisInterval, ProcessedCusumRecord } from "../src/core";
import type { FileParsingResult } from "../src/import";
import type { ExportResultType } from "../src/results";
import { createWorkflowApp } from "../src/ui/workflow-app";

function parsed(
  columns = ["area", "date", "count"],
  rows: Record<string, string>[] = [
    { area: "Area A", date: "2024-01-01", count: "1" },
    { area: "Area A", date: "2024-02-01", count: "8" },
  ],
): FileParsingResult {
  return {
    success: true,
    metadata: {
      filename: "synthetic.csv",
      extension: "csv",
      mime_type: "text/csv",
      size_bytes: 80,
      parsed_row_count: rows.length,
      columns,
    },
    table: { columns, rows },
    issues: [],
  };
}

function app(importResult: FileParsingResult = parsed()) {
  document.body.innerHTML = '<div id="app"></div>';
  const root = document.querySelector<HTMLElement>("#app")!;
  const analyze = vi.fn(analyzeCusum);
  const chart = { render: vi.fn(), clear: vi.fn() };
  const download = vi.fn((
    _records: ProcessedCusumRecord[],
    _type: ExportResultType,
    _interval: AnalysisInterval,
  ) => "neutral.csv");
  const controller = createWorkflowApp(root, {
    importFile: vi.fn(async () => importResult),
    analyze,
    chart,
    download,
  });
  return { root, controller, analyze, chart, download };
}

describe("Product acceptance states", () => {
  it("provides accessible methodology, interpretation caution, privacy, and synthetic downloads", () => {
    const { root } = app();
    expect(root.querySelector("#help-dialog")?.getAttribute("role")).toBe("dialog");
    expect(root.querySelector(".help-dialog-body")?.textContent).toContain("does not independently establish an outbreak");
    expect(root.querySelector(".help-dialog-body")?.textContent).toContain(
      "Your file is processed locally in this browser and is not uploaded to a server.",
    );
    const links = [...root.querySelectorAll<HTMLAnchorElement>(".sample-link")];
    expect(links).toHaveLength(5);
    expect(links.every((link) => link.hasAttribute("download"))).toBe(true);
    expect(links.every((link) => link.getAttribute("href")?.includes("/sample-data/"))).toBe(true);
  });

  it("restores analytical defaults without clearing the selected file or rerunning analysis", async () => {
    const { root, controller, analyze } = app();
    await controller.selectFile(new File(["synthetic"], "synthetic.csv"));
    controller.runAnalysis();
    const threshold = root.querySelector<HTMLInputElement>("#threshold")!;
    threshold.value = "5";
    threshold.dispatchEvent(new Event("change", { bubbles: true }));
    root.querySelector<HTMLButtonElement>("#restore-defaults")!.click();
    expect(controller.getState().metadata?.filename).toBe("synthetic.csv");
    expect(controller.getState().options).toMatchObject(DEFAULT_ANALYSIS_OPTIONS);
    expect(controller.getState().result_view.result_stale).toBe(true);
    expect(analyze).toHaveBeenCalledOnce();
  });

  it("limits row-level issue rendering and reports undisplayed issues", async () => {
    const rows = Array.from({ length: 30 }, (_, index) => ({
      area: "A",
      date: "not-a-date",
      count: String(index),
    }));
    const { root, controller } = app(parsed(undefined, rows));
    await controller.selectFile(new File(["synthetic"], "invalid.csv"));
    const issues = root.querySelectorAll("#error-summary li");
    expect(issues).toHaveLength(21);
    expect(issues[20]?.textContent).toContain("additional issues are not displayed");
    expect(root.querySelector<HTMLButtonElement>("#run-analysis")?.disabled).toBe(true);
  });

  it("shows a local parsing state and disables conflicting controls", async () => {
    let resolveImport!: (result: FileParsingResult) => void;
    const importPromise = new Promise<FileParsingResult>((resolve) => {
      resolveImport = resolve;
    });
    document.body.innerHTML = '<div id="app"></div>';
    const root = document.querySelector<HTMLElement>("#app")!;
    const controller = createWorkflowApp(root, {
      importFile: vi.fn(async () => importPromise),
      analyze: analyzeCusum,
      chart: { render: vi.fn(), clear: vi.fn() },
    });
    const selecting = controller.selectFile(new File(["synthetic"], "synthetic.csv"));
    expect(root.querySelector("#state-label")?.textContent).toBe("Reading file");
    expect(root.querySelector<HTMLButtonElement>("#browse-files")?.disabled).toBe(true);
    expect(root.querySelector("#drop-zone")?.getAttribute("aria-busy")).toBe("true");
    resolveImport(parsed());
    await selecting;
    expect(root.querySelector("#state-label")?.textContent).toBe("Ready to analyze");
  });

  it("removes completed results when a newly selected file is invalid", async () => {
    document.body.innerHTML = '<div id="app"></div>';
    const root = document.querySelector<HTMLElement>("#app")!;
    let next: FileParsingResult = parsed();
    const controller = createWorkflowApp(root, {
      importFile: vi.fn(async () => next),
      analyze: analyzeCusum,
      chart: { render: vi.fn(), clear: vi.fn() },
    });
    await controller.selectFile(new File(["valid"], "valid.csv"));
    controller.runAnalysis();
    next = {
      success: false,
      issues: [{ code: "bad", message: "The workbook could not be read.", scope: "parser", severity: "error" }],
    };
    expect(root.querySelector<HTMLElement>("#results-section")?.hidden).toBe(false);
    await controller.selectFile(new File(["invalid"], "invalid.xlsx"));
    expect(root.querySelector<HTMLElement>("#results-section")?.hidden).toBe(true);
    expect(root.querySelector<HTMLButtonElement>("#run-analysis")?.disabled).toBe(true);
    expect(root.querySelector("#error-summary")?.textContent).toContain("workbook could not be read");
  });

  it("keeps export disabled while completed results are stale", async () => {
    const { root, controller } = app();
    await controller.selectFile(new File(["synthetic"], "synthetic.csv"));
    controller.runAnalysis();
    const k = root.querySelector<HTMLInputElement>("#k-value")!;
    k.value = "0.2";
    k.dispatchEvent(new Event("input", { bubbles: true }));
    expect(root.querySelector<HTMLElement>("#stale-results")?.hidden).toBe(false);
    expect(root.querySelector<HTMLButtonElement>("#export-all")?.disabled).toBe(true);
    expect(root.querySelector("#analysis-action-help")?.textContent).toContain("Run again");
  });
});
