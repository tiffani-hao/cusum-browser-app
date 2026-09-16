// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import {
  downloadVisualizationHtml,
  serializeVisualizationHtml,
  visualizationFilename,
} from "../src/results";
import type { VisualizationSnapshot } from "../src/results";

describe("offline visualization HTML export", () => {
  it("creates a self-contained snapshot with escaped metadata and no remote code", () => {
    const html = serializeVisualizationHtml(snapshot({ series_names: ["Area <A>", "Group & B"] }));

    expect(html).toContain("data:image/png;base64,c2FmZQ==");
    expect(html).toContain("Area &lt;A&gt;");
    expect(html).toContain("Group &amp; B");
    expect(html).toContain("initial baseline period");
    expect(html).toContain("Data remain visible during this period.");
    expect(html).toContain("Zoom in");
    expect(html).toContain("Reset zoom");
    expect(html).toContain("zoom controls work offline");
    expect(html).not.toMatch(/https?:\/\//i);
    expect(html).not.toMatch(/<script\b[^>]*\bsrc=/i);
    expect(html).not.toMatch(/src=["'](?!data:)/i);
  });

  it("provides working offline image zoom controls and reset behavior", () => {
    const exportedDocument = new DOMParser().parseFromString(
      serializeVisualizationHtml(snapshot()),
      "text/html",
    );
    const script = exportedDocument.querySelector("script")?.textContent;
    if (script === null || script === undefined) throw new Error("Missing inline zoom script.");
    Function("document", script)(exportedDocument);
    const image = exportedDocument.querySelector<HTMLImageElement>("#chart-image")!;
    const output = exportedDocument.querySelector<HTMLOutputElement>("#zoom-value")!;

    exportedDocument.querySelector<HTMLButtonElement>("#zoom-in")!.click();
    expect(image.style.width).toBe("1500px");
    expect(output.textContent).toBe("125%");

    exportedDocument.querySelector<HTMLButtonElement>("#reset-zoom")!.click();
    expect(image.style.width).toBe("1200px");
    expect(output.textContent).toBe("100%");
  });

  it("uses a neutral date-based filename", () => {
    expect(visualizationFilename(new Date("2026-09-15T12:00:00Z")))
      .toBe("cusum-visualization-2026-09-15.html");
  });

  it("downloads through a temporary object URL and revokes it", () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const createObjectURL = vi.fn(() => "blob:local-visualization");
    const revokeObjectURL = vi.fn();
    const scheduleCleanup = vi.fn((callback: () => void) => callback());

    const filename = downloadVisualizationHtml(
      snapshot(),
      new Date("2026-09-15T12:00:00Z"),
      { document, createObjectURL, revokeObjectURL, scheduleCleanup },
    );

    expect(filename).toBe("cusum-visualization-2026-09-15.html");
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(scheduleCleanup).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:local-visualization");
    expect(document.querySelector('a[download]')).toBeNull();
  });
});

function snapshot(overrides: Partial<VisualizationSnapshot> = {}): VisualizationSnapshot {
  return {
    image_data_url: "data:image/png;base64,c2FmZQ==",
    image_width: 1200,
    image_height: 500,
    date_start: "2023-01-01",
    date_end: "2026-01-01",
    series_names: ["Area A"],
    threshold: 3,
    alert_count: 2,
    baseline_window: 36,
    analysis_interval: "monthly",
    ...overrides,
  };
}
