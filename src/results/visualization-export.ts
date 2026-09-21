import type { AnalysisInterval } from "../core";
import type { DownloadEnvironment } from "./csv-download";

export interface VisualizationSnapshot {
  image_data_url: string;
  image_width: number;
  image_height: number;
  date_start: string;
  date_end: string;
  series_names: string[];
  threshold: number;
  alert_count: number;
  baseline_window: number;
  analysis_interval: AnalysisInterval;
}

export interface VisualizationDownloadEnvironment extends DownloadEnvironment {
  scheduleCleanup(callback: () => void): void;
}

export function visualizationFilename(now: Date = new Date()): string {
  return `cusum-visualization-${now.toISOString().slice(0, 10)}.html`;
}

export function serializeVisualizationHtml(snapshot: VisualizationSnapshot): string {
  const seriesItems = snapshot.series_names.length === 0
    ? "<li>No series displayed</li>"
    : snapshot.series_names.map((name) => `<li>${escapeHtml(name)}</li>`).join("");
  const dateRange = snapshot.date_start === "" || snapshot.date_end === ""
    ? "No displayed dates"
    : `${escapeHtml(snapshot.date_start)} to ${escapeHtml(snapshot.date_end)}`;
  const alt = `CUSUM time-series chart for ${snapshot.series_names.length} displayed series from ${dateRange}`;
  const width = safeImageDimension(snapshot.image_width);
  const height = safeImageDimension(snapshot.image_height);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'">
  <title>CUSUM time series</title>
  <style>
    :root { color-scheme: light; font-family: system-ui, sans-serif; color: #231a30; background: #fff; }
    body { max-width: 80rem; margin: 0 auto; padding: 1.5rem; }
    h1 { color: #41206b; }
    dl { display: grid; grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr)); gap: .75rem; }
    dl div { padding: .75rem; border: 1px solid #ddd4e8; border-radius: .4rem; }
    dt { color: #645b70; font-size: .85rem; font-weight: 700; }
    dd { margin: .25rem 0 0; font-weight: 750; }
    button { min-height: 2.5rem; padding: .5rem .8rem; border: 1px solid #6f42a1; border-radius: .35rem; color: #41206b; background: #fff; cursor: pointer; font: inherit; font-weight: 700; }
    button:hover { background: #f7f3fb; }
    button:focus-visible, .chart-scroll:focus-visible { outline: 3px solid #6f42a1; outline-offset: 2px; }
    .zoom-controls { display: flex; flex-wrap: wrap; align-items: center; gap: .55rem; margin: 1rem 0 .5rem; }
    output { min-width: 4rem; color: #645b70; font-variant-numeric: tabular-nums; font-weight: 700; text-align: center; }
    .zoom-help { margin: 0 0 .75rem; color: #645b70; }
    .chart-scroll { max-width: 100%; overflow: auto; border: 1px solid #ddd4e8; border-radius: .4rem; background: #fff; }
    img { display: block; max-width: none; height: auto; transform-origin: left top; }
    .note { padding: .8rem; border-left: 4px solid #6f42a1; background: #f7f3fb; }
  </style>
</head>
<body>
  <main>
    <h1>CUSUM time series</h1>
    <dl aria-label="Exported visualization summary">
      <div><dt>Displayed date range</dt><dd>${dateRange}</dd></div>
      <div><dt>Displayed series</dt><dd>${snapshot.series_names.length}</dd></div>
      <div><dt>Alert threshold</dt><dd>${escapeHtml(String(snapshot.threshold))}</dd></div>
      <div><dt>Displayed alert episodes</dt><dd>${snapshot.alert_count}</dd></div>
    </dl>
    <h2>Series shown</h2>
    <ul>${seriesItems}</ul>
    <div class="zoom-controls" role="group" aria-label="Visualization zoom controls">
      <button id="zoom-out" type="button">Zoom out</button>
      <output id="zoom-value" aria-live="polite">100%</output>
      <button id="zoom-in" type="button">Zoom in</button>
      <button id="reset-zoom" type="button">Reset zoom</button>
    </div>
    <p id="zoom-help" class="zoom-help">Use the zoom controls or Control + mouse wheel, then scroll the chart to pan.</p>
    <div id="chart-scroll" class="chart-scroll" role="region" aria-label="Scrollable and zoomable exported CUSUM chart" aria-describedby="zoom-help" tabindex="0">
      <img id="chart-image" src="${escapeHtml(snapshot.image_data_url)}" width="${width}" height="${height}" alt="${escapeHtml(alt)}" draggable="false">
    </div>
    <p class="note">The shaded region indicates the initial baseline period used by the analysis (${snapshot.baseline_window} ${escapeHtml(snapshot.analysis_interval)} intervals per series). Data remain visible during this period.</p>
    <p>This self-contained visualization is an exported snapshot of the chart state. Its zoom controls work offline and do not send data anywhere.</p>
  </main>
  <script>
    "use strict";
    (function () {
      var image = document.getElementById("chart-image");
      var viewport = document.getElementById("chart-scroll");
      var output = document.getElementById("zoom-value");
      var zoomIn = document.getElementById("zoom-in");
      var zoomOut = document.getElementById("zoom-out");
      var reset = document.getElementById("reset-zoom");
      var baseWidth = ${width};
      var scale = 1;

      function applyZoom(nextScale) {
        scale = Math.max(0.5, Math.min(4, nextScale));
        image.style.width = Math.round(baseWidth * scale) + "px";
        output.textContent = Math.round(scale * 100) + "%";
        zoomOut.disabled = scale <= 0.5;
        zoomIn.disabled = scale >= 4;
      }

      zoomIn.addEventListener("click", function () { applyZoom(scale * 1.25); });
      zoomOut.addEventListener("click", function () { applyZoom(scale / 1.25); });
      reset.addEventListener("click", function () {
        viewport.scrollLeft = 0;
        viewport.scrollTop = 0;
        applyZoom(1);
      });
      viewport.addEventListener("wheel", function (event) {
        if (!event.ctrlKey) return;
        event.preventDefault();
        applyZoom(event.deltaY < 0 ? scale * 1.1 : scale / 1.1);
      }, { passive: false });
      applyZoom(1);
    }());
  </script>
</body>
</html>`;
}

export function downloadVisualizationHtml(
  snapshot: VisualizationSnapshot,
  now: Date = new Date(),
  environment: VisualizationDownloadEnvironment = browserDownloadEnvironment(),
): string {
  const filename = visualizationFilename(now);
  const blob = new Blob([serializeVisualizationHtml(snapshot)], { type: "text/html;charset=utf-8" });
  const objectUrl = environment.createObjectURL(blob);
  const link = environment.document.createElement("a");
  try {
    link.href = objectUrl;
    link.download = filename;
    link.hidden = true;
    environment.document.body.append(link);
    link.click();
  } finally {
    link.remove();
    environment.scheduleCleanup(() => environment.revokeObjectURL(objectUrl));
  }
  return filename;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeImageDimension(value: number): number {
  return Math.max(1, Math.min(MAX_EXPORTED_IMAGE_DIMENSION, Math.round(value)));
}

function browserDownloadEnvironment(): VisualizationDownloadEnvironment {
  return {
    document,
    createObjectURL: (blob) => URL.createObjectURL(blob),
    revokeObjectURL: (url) => URL.revokeObjectURL(url),
    scheduleCleanup: (callback) => window.setTimeout(callback, 0),
  };
}

const MAX_EXPORTED_IMAGE_DIMENSION = 32767;
