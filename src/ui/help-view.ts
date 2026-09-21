const SAMPLE_DOWNLOADS = [
  {
    href: new URL("../../sample-data/basic-example.csv", import.meta.url).href,
    filename: "cusum-basic-monthly-example.csv",
    label: "Basic monthly example",
    description: "Synthetic area, date, and count columns for monthly analysis.",
  },
  {
    href: new URL("../../sample-data/daily-example.csv", import.meta.url).href,
    filename: "cusum-daily-example.csv",
    label: "Daily example",
    description: "Synthetic area, date, and count columns for daily analysis.",
  },
  {
    href: new URL("../../sample-data/five-year-daily-example.csv", import.meta.url).href,
    filename: "cusum-five-year-daily-example.csv",
    label: "Five-year daily example",
    description: "A larger synthetic daily file for exploring longer results.",
  },
  {
    href: new URL("../../sample-data/strata-example.csv", import.meta.url).href,
    filename: "cusum-strata-example.csv",
    label: "Stratified monthly example",
    description: "A synthetic 1,008-record dataset covering four areas, three strata, and seven years of monthly observations.",
  },
  {
    href: new URL("../../sample-data/synthetic-example.xlsx", import.meta.url).href,
    filename: "cusum-synthetic-monthly-example.xlsx",
    label: "XLSX monthly example",
    description: "A small synthetic workbook with area, date, and count columns.",
  },
] as const;

export function helpDialogMarkup(): string {
  const downloads = SAMPLE_DOWNLOADS.map((sample) => `
    <li class="sample-card">
      <a class="sample-link" href="${sample.href}" download="${sample.filename}">${sample.label}</a>
      <p>${sample.description}</p>
    </li>
  `).join("");

  return `
    <div id="help-overlay" class="help-overlay" hidden>
      <section
        id="help-dialog"
        class="help-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-dialog-title"
        aria-describedby="help-dialog-intro"
        tabindex="-1"
      >
        <div class="help-dialog-header">
          <div>
            <p class="dialog-kicker">Reference</p>
            <h2 id="help-dialog-title">Help and methodology</h2>
          </div>
          <button id="close-help" class="button button-secondary" type="button">Close Help</button>
        </div>
        <div class="help-dialog-body">
          <p id="help-dialog-intro">Practical guidance for preparing data, choosing settings, reviewing results, and protecting your browser session.</p>

          <nav class="help-section-nav" aria-label="Help sections">
            <a href="#help-about">About this tool</a>
            <a href="#help-uploading">Preparing and uploading data</a>
            <a href="#help-settings">Presets and analysis settings</a>
            <a href="#help-baseline">Initial baseline period</a>
            <a href="#help-graph">Understanding the graph and alerts</a>
            <a href="#help-filters">Display filters</a>
            <a href="#help-exporting">Exporting results</a>
            <a href="#help-privacy">Privacy and browser session</a>
            <a href="#help-troubleshooting">Troubleshooting</a>
          </nav>

          <section id="help-about" tabindex="-1">
            <h3>About this tool</h3>
            <p>This tool applies a Cumulative Sum (CUSUM) method to surveillance count data to identify sustained increases over time that may warrant further review.</p>
            <p>All data are processed locally in your browser. Uploaded surveillance data are not sent to or stored on a server.</p>
            <p>An alert indicates that the CUSUM value exceeded the selected threshold. It is a signal for further review, not confirmation of an outbreak or transmission cluster.</p>
          </section>

          <section id="help-uploading" tabindex="-1">
            <h3>Preparing and uploading data</h3>
            <p>Upload one CSV or XLSX file containing:</p>
            <ul>
              <li><code>area</code>: geographic or surveillance unit</li>
              <li><code>date</code>: observation date</li>
              <li><code>count</code>: number of observed events</li>
              <li><code>strata</code> (optional): stratification value within an area</li>
            </ul>
            <p><strong>Basic format:</strong></p>
            <pre aria-label="Basic CSV format">area,date,count
Area A,2024-01-01,5
Area A,2024-02-01,7</pre>
            <p><strong>With strata:</strong></p>
            <pre aria-label="Stratified CSV format">area,date,count,strata
Area A,2024-01-01,5,Group 1
Area A,2024-02-01,7,Group 1</pre>
            <p>When <code>strata</code> is included, each area–strata combination is analyzed as a separate time series.</p>
            <p>The application validates the file before analysis. The original uploaded file is not modified.</p>
            <div class="help-samples" aria-labelledby="sample-heading">
              <h4 id="sample-heading">Synthetic sample files</h4>
              <p>Download a synthetic file to learn the workflow. These examples contain no real surveillance data.</p>
              <ul class="sample-grid">${downloads}</ul>
            </div>
          </section>

          <section id="help-settings" tabindex="-1">
            <h3>Presets and analysis settings</h3>
            <h4>HIV preset</h4>
            <p>The HIV preset automatically applies the predefined HIV surveillance settings used by this tool:</p>
            <ul>
              <li>Time interval: Monthly</li>
              <li>Smoothing window: 3 periods</li>
              <li>Baseline: 36 periods</li>
              <li>K: 0.1</li>
              <li>Alert threshold: 3</li>
            </ul>
            <p>Additional disease-specific presets may be added in the future.</p>
            <h4>Custom</h4>
            <p>Select Custom to specify your own CUSUM settings for another surveillance application.</p>
            <h4>What the settings mean</h4>
            <p><strong>Time interval</strong> determines how observations are grouped for analysis.</p>
            <p><strong>Smoothing</strong> reduces short-term variation.</p>
            <p><strong>Baseline</strong> determines how much historical information is used to establish the expected pattern.</p>
            <p><strong>K</strong> affects how strongly deviations from the expected level contribute to CUSUM.</p>
            <p><strong>Alert threshold</strong> determines how large the CUSUM value must become before an alert is generated. A point is an alert only when CUSUM is strictly greater than the threshold.</p>
          </section>

          <section id="help-baseline" tabindex="-1">
            <h3>Initial baseline period</h3>
            <p>CUSUM requires historical data to establish the baseline used for later surveillance.</p>
            <p>This period is shown as the shaded Initial baseline period on the graph.</p>
            <p>Data remain visible in the shaded region so users can confirm that their data were read correctly, but results during this period should be interpreted cautiously.</p>
            <p>For example, the HIV monthly preset uses a 36-month baseline. If the primary interpretable period should begin in January 2026, the uploaded data should ideally begin around January 2023.</p>
          </section>

          <section id="help-graph" tabindex="-1">
            <h3>Understanding the graph and alerts</h3>
            <p>Each colored line represents one displayed time series, such as an area or an area–strata combination.</p>
            <ul>
              <li>The horizontal axis shows time.</li>
              <li>The vertical axis shows CUSUM.</li>
              <li>The dashed line is the alert threshold.</li>
              <li>Highlighted points indicate alerts.</li>
              <li>The grey area shows the Initial baseline period.</li>
            </ul>
            <p>For long time series, users can scroll horizontally and zoom in for more detail. Reset zoom returns to the full view, and Expand chart opens a larger visualization.</p>
            <p>Scrolling, zooming, and expanding change only the display and do not recalculate the analysis.</p>
            <p>An alert means that the CUSUM statistic exceeded the selected threshold. Multiple alert points may occur during one sustained increase and should not automatically be interpreted as separate outbreaks.</p>
          </section>

          <section id="help-filters" tabindex="-1">
            <h3>Display filters</h3>
            <p>Display filters affect visualization only. They do not recalculate CUSUM or change the analysis settings.</p>
            <p>Users can filter displayed areas, strata, chart series, dates, and alerts.</p>
            <p>For example, if 40 series were analyzed but only 5 are selected for display, all 40 were still analyzed.</p>
            <p>To change the CUSUM calculation itself, users must change the Analysis Settings and rerun the analysis.</p>
          </section>

          <section id="help-exporting" tabindex="-1">
            <h3>Exporting results</h3>
            <h4>Data export</h4>
            <p>Export the numerical analysis results for further review or documentation.</p>
            <h4>Export visualization (HTML)</h4>
            <p>Export visualization (HTML) saves the currently displayed graph as a standalone HTML file.</p>
            <p>The export reflects the currently displayed series, date range, alerts, threshold, and Initial baseline period.</p>
            <p>The HTML file is generated locally, works offline, and can be zoomed after export.</p>
          </section>

          <section id="help-privacy" tabindex="-1">
            <h3>Privacy and browser session</h3>
            <p>Uploaded data and analysis are processed locally within the browser.</p>
            <p>The application does not send uploaded surveillance data to a server or save them in a database.</p>
            <p>Refreshing or closing the page clears the current analysis. Users should export any results they want to keep before leaving the application.</p>
          </section>

          <section id="help-troubleshooting" class="help-troubleshooting" tabindex="-1">
            <h3>Troubleshooting</h3>
            <details>
              <summary>My file will not validate</summary>
              <p>Check that the file is CSV or XLSX and contains <code>area</code>, <code>date</code>, and <code>count</code>.</p>
            </details>
            <details>
              <summary>My analysis produced no alerts</summary>
              <p>This does not necessarily indicate an error. It may mean that none of the analyzed series exceeded the selected alert threshold.</p>
            </details>
            <details>
              <summary>My graph has too many lines</summary>
              <p>Use Display Filters to select specific areas, strata, or chart series. Hidden series remain part of the completed analysis.</p>
            </details>
            <details>
              <summary>My dates look compressed</summary>
              <p>Use horizontal scrolling, zoom, or Expand chart to examine a shorter time period in more detail.</p>
            </details>
            <details>
              <summary>Why is the beginning of the graph grey?</summary>
              <p>The shaded section is the Initial baseline period used to establish the historical reference for the analysis. Data remain visible, but results during this period should be interpreted cautiously.</p>
            </details>
            <details>
              <summary>Why did my results disappear after refreshing?</summary>
              <p>The application intentionally does not persist uploaded surveillance data or analysis results. Refreshing or closing the page clears the current browser session.</p>
            </details>
          </section>

          <section id="help-about-cusum" class="help-methodology-note" tabindex="-1">
            <h3>About CUSUM</h3>
            <p>CUSUM, or Cumulative Sum, is a sequential monitoring method used to detect sustained changes over time. This application uses CUSUM to identify unusual increases in surveillance counts that may warrant further public-health review.</p>
          </section>
        </div>
      </section>
    </div>
  `;
}

export function initializeHelpDialog(root: HTMLElement): void {
  const openButton = requiredElement<HTMLButtonElement>(root, "#help-button");
  const closeButton = requiredElement<HTMLButtonElement>(root, "#close-help");
  const overlay = requiredElement<HTMLElement>(root, "#help-overlay");
  const dialog = requiredElement<HTMLElement>(root, "#help-dialog");
  const dialogBody = requiredElement<HTMLElement>(root, ".help-dialog-body");
  const appHeader = requiredElement<HTMLElement>(root, "#application-header");
  const appMain = requiredElement<HTMLElement>(root, "#application-main");

  const close = (): void => {
    if (overlay.hidden) return;
    overlay.hidden = true;
    appHeader.removeAttribute("inert");
    appMain.removeAttribute("inert");
    document.body.classList.remove("help-open");
    openButton.focus();
  };

  openButton.addEventListener("click", () => {
    overlay.hidden = false;
    appHeader.setAttribute("inert", "");
    appMain.setAttribute("inert", "");
    document.body.classList.add("help-open");
    dialogBody.scrollTop = 0;
    closeButton.focus();
  });
  closeButton.addEventListener("click", close);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) close();
  });
  dialog.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    const focusable = [...dialog.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
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
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !overlay.hidden) close();
  });
}

function requiredElement<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (element === null) throw new Error(`Missing Help element: ${selector}`);
  return element;
}
