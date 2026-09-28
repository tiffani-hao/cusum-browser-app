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
            <a href="#help-detailed-results">Detailed results</a>
            <a href="#help-privacy">Privacy and security</a>
            <a href="#help-troubleshooting">Troubleshooting</a>
            <a href="#help-about-cusum">About CUSUM</a>
            <a href="#help-contact">Contact information</a>
          </nav>

          <section id="help-about" tabindex="-1">
            <h3>About this tool</h3>
            <p>This tool applies a Cumulative Sum (CUSUM) method to surveillance count data to identify sustained increases over time that may warrant further public health review.</p>
            <p>All data are processed locally in your browser. Uploaded data are not sent to or stored on a server.</p>
            <p>An alert indicates that the CUSUM value exceeded the selected threshold. It is a signal for further review, not confirmation of an outbreak or transmission cluster.</p>
          </section>

          <section id="help-uploading" tabindex="-1">
            <h3>Preparing and uploading data</h3>
            <h4>Entering your data</h4>
            <p>Upload one CSV or XLSX file containing surveillance count data.</p>
            <p>The file must contain three required columns:</p>
            <ul>
              <li><code>area</code> — geographic or surveillance unit, such as county, district, or ZIP code</li>
              <li><code>date</code> — observation date</li>
              <li><code>count</code> — number of observed events</li>
            </ul>
            <p>An optional fourth column may be included:</p>
            <ul>
              <li><code>strata</code> — subgroup or stratification category within an area</li>
            </ul>
            <p>If a valid <code>strata</code> column is detected, stratified analysis is enabled automatically. Each Area–Strata combination is analyzed as a separate time series.</p>
            <p>The application validates the file before analysis. The original uploaded file is not modified.</p>
            <p>The tool also supports Excel serial dates that may appear when dates are exported from Excel.</p>
            <h4>Basic format</h4>
            <pre aria-label="Basic CSV format">area,date,count
Area A,2024-01-01,5
Area A,2024-02-01,7</pre>
            <h4>With stratification</h4>
            <pre aria-label="Stratified CSV format">area,date,count,strata
Area A,2024-01-01,5,Group 1
Area A,2024-02-01,7,Group 1</pre>
            <div class="help-samples" aria-labelledby="sample-heading">
              <h4 id="sample-heading">Synthetic sample files</h4>
              <p>Select “Download Sample Data” on the upload page to download synthetic datasets and explore the workflow. Sample files contain no real surveillance data.</p>
              <p>Examples are available for monthly, daily, longer daily, stratified, and XLSX data.</p>
              <ul class="sample-grid">${downloads}</ul>
            </div>
          </section>

          <section id="help-settings" tabindex="-1">
            <h3>Presets and analysis settings</h3>
            <h4>Assigning analysis interval</h4>
            <p>The tool can analyze counts by:</p>
            <ul>
              <li>Monthly</li>
              <li>Weekly</li>
              <li>Daily</li>
            </ul>
            <p>Select the desired interval before running the analysis.</p>
            <p>Data may be analyzed at a broader interval than the uploaded observations. For example, daily data can be aggregated into monthly counts. However, data cannot be analyzed at a finer interval than the information provided.</p>
            <p><strong>Examples:</strong></p>
            <ul>
              <li>Monthly: 1/1/2021, 2/1/2021, 3/1/2021</li>
              <li>Weekly: 1/4/2021, 1/11/2021, 1/18/2021</li>
              <li>Daily: 1/1/2021, 1/2/2021, 1/3/2021</li>
            </ul>
            <p>The tool was initially developed for detection of time-space clusters of HIV using monthly surveillance data, but it is intended to support analysis of other public health conditions as well.</p>
            <p>If you are unsure where to begin, use <strong>Default (HIV)</strong>.</p>
            <h4>Smoothing window</h4>
            <p>The tool uses a moving average to reduce short-term variation and avoid generating alerts based only on isolated changes.</p>
            <p>A larger smoothing window places greater emphasis on sustained changes.</p>
            <p class="help-setting-default"><strong>Default:</strong> 3 periods</p>
            <p>For monthly analysis, this represents 3 months.</p>
            <h4>Baseline</h4>
            <p>The baseline determines how much historical information is used to estimate the expected pattern for comparison with the current period.</p>
            <p>A longer baseline can provide more stable estimates but may be less appropriate when older data do not represent current conditions.</p>
            <p class="help-setting-default"><strong>Default:</strong> 36 periods</p>
            <p>For monthly analysis, this represents 36 months.</p>
            <p>The uploaded dataset must cover a longer period than the selected baseline.</p>
            <h4>K</h4>
            <p>K is the decay parameter used in the CUSUM calculation. It controls how deviations from the expected level accumulate over time.</p>
            <p class="help-setting-default"><strong>Default:</strong> 0.1</p>
            <h4>Alert threshold</h4>
            <p>The alert threshold determines how large the CUSUM statistic must become before an alert is generated.</p>
            <p>A higher threshold generally requires a larger or more sustained increase before an alert occurs.</p>
            <p class="help-setting-default"><strong>Default:</strong> 4</p>
            <p>Changing any of these analysis parameters from the Default (HIV) values will switch the preset to Custom.</p>
            <p>Additional disease-specific presets may be added in the future.</p>
          </section>

          <section id="help-baseline" tabindex="-1">
            <h3>Initial baseline period</h3>
            <p>CUSUM requires historical data before later surveillance periods can be interpreted.</p>
            <p>The beginning of the time series is therefore shown as a shaded “Initial baseline period” on the graph.</p>
            <p>Data remain visible in this region so users can confirm that the file was read correctly, but alerts are not interpreted during this initial period.</p>
            <p>For example, with a 36-month monthly baseline, approximately three years of historical data are needed before the primary surveillance period begins.</p>
          </section>

          <section id="help-graph" tabindex="-1">
            <h3>Understanding the graph and alerts</h3>
            <p>Each colored line represents one displayed time series.</p>
            <ul>
              <li>Without stratification, each series represents an Area.</li>
              <li>With stratification, each series represents an Area–Strata combination.</li>
            </ul>
            <p>On the graph:</p>
            <ul>
              <li>The horizontal axis shows time.</li>
              <li>The vertical axis shows the CUSUM statistic.</li>
              <li>The dashed line shows the alert threshold.</li>
              <li>Highlighted points indicate periods where CUSUM is above the threshold.</li>
              <li>The grey region shows the Initial baseline period.</li>
            </ul>
            <p>For long time series, users can scroll horizontally and zoom in for more detail. Reset zoom returns to the full view, and Expand chart opens a larger visualization.</p>
            <p>Scrolling, zooming, expanding, and changing display filters affect visualization only and do not recalculate the analysis.</p>
            <p>CUSUM values shown in the graph tooltip and summary display are rounded for readability. Full-precision values remain available internally for analysis.</p>
            <h4>Alert episodes</h4>
            <p>A continuous period where CUSUM remains above the alert threshold is counted as one alert episode.</p>
            <p>For example, if CUSUM remains above the threshold for 10 consecutive months, that is one alert episode rather than 10 separate alerts.</p>
            <p>An alert episode ends when CUSUM returns to or below the threshold. If CUSUM later rises above the threshold again, a new alert episode begins.</p>
            <p>The Alerts table summarizes each episode using:</p>
            <ul>
              <li>Area</li>
              <li>Strata</li>
              <li>Start Date</li>
              <li>End Date</li>
              <li>Periods</li>
              <li>Total Cases</li>
            </ul>
            <p>Periods is the number of consecutive analysis intervals included in the alert episode.</p>
            <p>The alert summary also reports:</p>
            <ul>
              <li>Total alert episodes</li>
              <li>Currently active</li>
              <li>Inactive</li>
              <li>Series with alerts</li>
            </ul>
            <p>An alert is currently active when the series remains above the threshold at its most recent available observation.</p>
            <p>By default, the Alerts table shows currently active alerts. Select “Show inactive alerts” to include past alert episodes.</p>
            <p>This control affects only which rows are displayed in the table. It does not change the alert summary counts or rerun the analysis.</p>
          </section>

          <section id="help-filters" tabindex="-1">
            <h3>Display filters</h3>
            <p>Display filters affect visualization only. They do not recalculate CUSUM or change the analysis settings.</p>
            <h4>Areas</h4>
            <p>Select the geographic or surveillance units to display.</p>
            <h4>Strata</h4>
            <p>When stratified data are used, select which strata values to display.</p>
            <h4>Displayed Series</h4>
            <p>For stratified analyses, individual Area–Strata combinations can also be selected.</p>
            <p>Checkboxes make the current selection explicit, and “Select all” and “Clear all” can be used to quickly change the displayed options.</p>
            <p>For non-stratified analyses, only the Areas filter is needed.</p>
            <p>For analyses with more than 20 series, the first 20 series are selected for display by default. All series are still analyzed and remain available for selection.</p>
            <h4>Show Only Series with Alerts</h4>
            <p>When enabled, the graph displays only selected series that have at least one alert episode.</p>
            <p>The entire time series remains visible, not just the periods during which an alert occurred.</p>
            <h4>Display date range</h4>
            <p>The start and end date controls determine which portion of the analyzed time series is displayed.</p>
            <p>Only dates available in the processed analysis data can be selected.</p>
            <p>Changing any Display Filter affects only the visualization and does not rerun the analysis.</p>
          </section>

          <section id="help-exporting" tabindex="-1">
            <h3>Exporting results</h3>
            <p>The application does not permanently save surveillance data or analysis results. Refreshing or closing the page clears the current browser session.</p>
            <p>Export any results you want to retain before leaving the application.</p>
            <h4>Data export</h4>
            <p>Export numerical analysis results for additional review or documentation.</p>
            <h4>Export visualization (HTML)</h4>
            <p>“Export visualization (HTML)” saves the currently displayed graph as a standalone HTML file.</p>
            <p>The exported visualization reflects the current:</p>
            <ul>
              <li>displayed series</li>
              <li>date range</li>
              <li>alerts</li>
              <li>threshold</li>
              <li>Initial baseline period</li>
            </ul>
            <p>The HTML file is generated locally and can be opened and explored offline.</p>
          </section>

          <section id="help-detailed-results" tabindex="-1">
            <h3>Detailed results</h3>
            <p>Detailed processing and analysis information is available under “Show detailed results” and is collapsed by default.</p>
            <p><strong>Input rows:</strong> Validated input records passed into analysis before interval standardization, duplicate aggregation, and missing-period filling.</p>
            <p><strong>Processed rows:</strong> Analysis records after interval standardization, duplicate aggregation, missing-period filling, and CUSUM calculation.</p>
            <p>The detailed results section does not change the analysis and can be expanded or collapsed at any time.</p>
          </section>

          <section id="help-privacy" tabindex="-1">
            <h3>Privacy and security</h3>
            <p>This tool was designed with confidentiality and data security as a priority. All uploaded data and analysis are processed locally on your device. After the application has loaded, it can continue to operate without sending surveillance data to a server.</p>
            <p>The browser-only architecture was informed by CDC’s <a href="https://github.com/CDCgov/MicrobeTrace" target="_blank" rel="noopener noreferrer">MicrobeTrace application</a>. The source code for this tool is also available through the open-source GitHub repository: <a href="https://github.com/tiffani-hao/cusum-browser-app" target="_blank" rel="noopener noreferrer">tiffani-hao/cusum-browser-app</a>.</p>
          </section>

          <section id="help-troubleshooting" class="help-troubleshooting" tabindex="-1">
            <h3>Troubleshooting</h3>
            <details>
              <summary>My file will not validate</summary>
              <p>Confirm that the file is CSV or XLSX and contains the required columns: <code>area</code>, <code>date</code>, and <code>count</code>. For stratified analysis, the optional fourth column should be <code>strata</code>.</p>
            </details>
            <details>
              <summary>My analysis produced no alerts</summary>
              <p>This does not necessarily indicate an error. It may mean that none of the analyzed series exceeded the selected alert threshold.</p>
            </details>
            <details>
              <summary>My graph has too many lines</summary>
              <p>Use Display Filters to select specific Areas, Strata, or Displayed Series. Hidden series remain part of the completed analysis.</p>
            </details>
            <details>
              <summary>Why do I only see 20 series?</summary>
              <p>When more than 20 series are analyzed, the first 20 are selected for display by default. Additional series can be selected under Display Filters.</p>
            </details>
            <details>
              <summary>My dates look compressed</summary>
              <p>Use horizontal scrolling, zoom, the display date range, or Expand chart to examine a shorter period in more detail.</p>
            </details>
            <details>
              <summary>Why is the beginning of the graph grey?</summary>
              <p>The shaded section represents the Initial baseline period used to establish the historical reference for the analysis.</p>
            </details>
            <details>
              <summary>Why are some alerts not shown in the table?</summary>
              <p>The Alerts table shows currently active alerts by default. Select “Show inactive alerts” to display previous alert episodes as well.</p>
            </details>
            <details>
              <summary>Why did my results disappear after refreshing?</summary>
              <p>The application intentionally does not persist uploaded surveillance data or analysis results. Refreshing or closing the page clears the current browser session.</p>
            </details>
          </section>

          <section id="help-about-cusum" class="help-methodology-note" tabindex="-1">
            <h3>About CUSUM</h3>
            <p>CUSUM, or Cumulative Sum, is a sequential monitoring method used to detect sustained changes over time.</p>
            <p>The method keeps a running measure of how much observed counts exceed an expected level. When observations fall sufficiently below the expected level, the running statistic decreases or resets, allowing sustained increases to be distinguished from isolated fluctuations.</p>
            <p>In this application, surveillance counts are normalized and smoothed before the one-sided upper CUSUM statistic is calculated. An alert is generated when the statistic exceeds the selected alert threshold.</p>
            <p>To learn more about the development and evaluation of this approach, see <a href="https://pubmed.ncbi.nlm.nih.gov/42156236/" target="_blank" rel="noopener noreferrer">“Evaluating Time-Space Methodologies to Detect Clusters of HIV Transmission: a Comparison of Advanced Methods in Washington State, 2010–2022.”</a></p>
          </section>

          <section id="help-contact" tabindex="-1">
            <h3>Contact information</h3>
            <p>For questions, bug reports, or collaboration opportunities please contact:</p>
            <address>Steven Erly<br /><a href="mailto:steven.erly@doh.wa.gov">steven.erly@doh.wa.gov</a></address>
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
