const SAMPLE_DOWNLOADS = [
  {
    href: new URL("../../sample-data/basic-example.csv", import.meta.url).href,
    filename: "basic-example.csv",
    label: "Basic monthly example",
    description: "Monthly area, date, and count data in CSV format.",
  },
  {
    href: new URL("../../sample-data/daily-example.csv", import.meta.url).href,
    filename: "daily-example.csv",
    label: "Daily example",
    description: "Daily area, date, and count data in CSV format.",
  },
  {
    href: new URL("../../sample-data/five-year-daily-example.csv", import.meta.url).href,
    filename: "five-year-daily-example.csv",
    label: "Five-year daily example",
    description: "A larger CSV example covering five years of daily observations.",
  },
  {
    href: new URL("../../sample-data/risk-group-example.csv", import.meta.url).href,
    filename: "stratified-monthly-example.csv",
    label: "Stratified monthly example",
    description: "Monthly CSV data containing a stratification variable and multiple strata.",
  },
  {
    href: new URL("../../sample-data/synthetic-example.xlsx", import.meta.url).href,
    filename: "synthetic-example.xlsx",
    label: "XLSX monthly example",
    description: "Monthly area, date, and count data in XLSX format.",
  },
] as const;

export function sampleDataDialogMarkup(): string {
  const downloads = SAMPLE_DOWNLOADS.map((sample) => `
    <li class="sample-card">
      <a class="sample-download-link" href="${sample.href}" download="${sample.filename}">${sample.label}</a>
      <p>${sample.description}</p>
    </li>
  `).join("");
  return `
    <div id="sample-data-overlay" class="help-overlay sample-data-overlay" hidden>
      <section
        id="sample-data-dialog"
        class="help-dialog sample-data-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sample-data-dialog-title"
        aria-describedby="sample-data-dialog-intro"
        tabindex="-1"
      >
        <div class="help-dialog-header">
          <div>
            <p class="dialog-kicker">Examples</p>
            <h2 id="sample-data-dialog-title">Download Sample Data</h2>
          </div>
          <button id="close-sample-data" class="sample-dialog-close" type="button" aria-label="Close sample data dialog">×</button>
        </div>
        <div class="help-dialog-body sample-data-dialog-body">
          <p id="sample-data-dialog-intro">Choose a synthetic sample file to download locally.</p>
          <ul class="sample-grid sample-dialog-grid">${downloads}</ul>
        </div>
      </section>
    </div>
  `;
}

export function initializeSampleDataDialog(root: HTMLElement): void {
  const openButton = requiredElement<HTMLButtonElement>(root, "#open-sample-data");
  const closeButton = requiredElement<HTMLButtonElement>(root, "#close-sample-data");
  const overlay = requiredElement<HTMLElement>(root, "#sample-data-overlay");
  const dialog = requiredElement<HTMLElement>(root, "#sample-data-dialog");
  const appHeader = requiredElement<HTMLElement>(root, "#application-header");
  const appMain = requiredElement<HTMLElement>(root, "#application-main");

  const close = (): void => {
    if (overlay.hidden) return;
    overlay.hidden = true;
    appHeader.removeAttribute("inert");
    appMain.removeAttribute("inert");
    document.body.classList.remove("sample-data-open");
    openButton.focus();
  };

  openButton.addEventListener("click", () => {
    overlay.hidden = false;
    appHeader.setAttribute("inert", "");
    appMain.setAttribute("inert", "");
    document.body.classList.add("sample-data-open");
    closeButton.focus();
  });
  closeButton.addEventListener("click", close);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) close();
  });
  dialog.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    const focusable = [...dialog.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')];
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
  if (element === null) throw new Error(`Missing sample-data element: ${selector}`);
  return element;
}
