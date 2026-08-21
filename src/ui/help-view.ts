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
    href: new URL("../../sample-data/risk-group-example.csv", import.meta.url).href,
    filename: "cusum-risk-group-example.csv",
    label: "Risk-group monthly example",
    description: "A synthetic 1,008-record dataset covering four areas, three risk groups, and seven years of monthly observations.",
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
          <p id="help-dialog-intro">Use this reference for data preparation, settings, interpretation, privacy, and synthetic examples.</p>

          <section>
            <h3>How to use the tool</h3>
            <ol>
              <li>Select or drop one CSV or XLSX file.</li>
              <li>Review local validation feedback.</li>
              <li>Choose a disease preset or custom analysis settings.</li>
              <li>Run the analysis, then explore and export completed results.</li>
            </ol>
          </section>

          <section>
            <h3>Data requirements</h3>
            <p>Files require <code>area</code>, <code>date</code>, and nonnegative numeric <code>count</code> columns. Add <code>risk_group</code> when area and risk-group combinations should be analyzed separately.</p>
            <pre aria-label="Basic CSV format">area,date,count
Area A,2024-01-01,5
Area A,2024-02-01,7</pre>
            <pre aria-label="Risk-group CSV format">area,date,count,risk_group
Area A,2024-01-01,5,Group 1</pre>
          </section>

          <section>
            <h3>Analysis settings</h3>
            <p>HIV is the current default preset for this tool. It selects monthly analysis, smoothing window 3, baseline window 36, K 0.1, threshold 3, and area-only grouping. Custom allows each setting to be edited. Presets populate settings but do not change the CUSUM formula or run analysis automatically.</p>
            <ul>
              <li>Daily analysis uses each calendar date.</li>
              <li>Weekly analysis groups dates into weeks beginning Monday.</li>
              <li>Monthly analysis groups dates to the first day of each month.</li>
            </ul>
          </section>

          <section>
            <h3>CUSUM methodology</h3>
            <p>Duplicate counts in the same analysis group and period are summed. Missing periods between a group's first and last period are filled with zero. Counts use the selected trailing smoothing window.</p>
            <p>The rolling baseline uses the selected window and sample standard deviation. A standard deviation of 1 replaces a zero or unavailable value. Each update subtracts K, and CUSUM cannot fall below zero.</p>
            <p>Each area, or each area and risk-group combination, is analyzed separately.</p>
          </section>

          <section>
            <h3>Results and alerts</h3>
            <p>The chart shows CUSUM values, the dashed alert threshold, and distinct alert points. An alert occurs only when the existing <code>is_alert</code> value is true, corresponding to CUSUM strictly greater than the threshold; equality is not an alert.</p>
            <p>Display filters change what is shown without recalculating CUSUM. The processed table presents key review fields, while local exports retain all calculated fields and analytical precision.</p>
          </section>

          <section>
            <h3>Interpretation caution</h3>
            <p>An alert identifies a statistical pattern that warrants review; it does not independently establish an outbreak or causal explanation. Interpret results alongside epidemiologic, program, data-quality, and operational context. The HIV selection is a tool default, not a universal recommendation for every surveillance context.</p>
          </section>

          <section>
            <h3>Privacy</h3>
            <p>Your file is processed locally in this browser and is not uploaded to a server. Imported and processed records remain in memory and are cleared when you use Clear Data or close the page. The application does not persist surveillance records in browser storage.</p>
          </section>

          <section aria-labelledby="sample-heading">
            <h3 id="sample-heading">Synthetic sample data</h3>
            <p>Download a synthetic file to learn the workflow. These examples contain no real surveillance data.</p>
            <ul class="sample-grid">${downloads}</ul>
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
  const appHeader = requiredElement<HTMLElement>(root, "#application-header");
  const appMain = requiredElement<HTMLElement>(root, "#application-main");

  const close = (): void => {
    if (overlay.hidden) return;
    overlay.hidden = true;
    appHeader.removeAttribute("inert");
    appMain.removeAttribute("inert");
    openButton.focus();
  };

  openButton.addEventListener("click", () => {
    overlay.hidden = false;
    appHeader.setAttribute("inert", "");
    appMain.setAttribute("inert", "");
    closeButton.focus();
  });
  closeButton.addEventListener("click", close);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) close();
  });
  dialog.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    const focusable = [...dialog.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
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
