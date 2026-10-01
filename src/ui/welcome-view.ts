export function welcomeDialogMarkup(): string {
  return `
    <div id="welcome-overlay" class="help-overlay welcome-overlay">
      <section
        id="welcome-dialog"
        class="help-dialog welcome-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-dialog-title"
        aria-describedby="welcome-dialog-intro"
        tabindex="-1"
      >
        <div class="help-dialog-header welcome-dialog-header">
          <h2 id="welcome-dialog-title">Welcome to the CUSUM Surveillance Tool</h2>
          <button id="close-welcome" class="sample-dialog-close" type="button" aria-label="Close welcome dialog">×</button>
        </div>
        <div class="welcome-dialog-body">
          <p id="welcome-dialog-intro" class="welcome-intro">This browser-based surveillance tool uses CUSUM methods to help identify changes in disease counts over time. Your data stays local in your browser and is not uploaded to or stored on a server.</p>

          <div class="welcome-secondary welcome-contact">
            <p><strong>Developed by:</strong><br />Tiffani Hao, MPH Candidate, Department of Global Health, University of Washington</p>
            <p>For questions, feedback, or technical issues, please contact Steven Erly at <a href="mailto:steven.erly@doh.wa.gov">steven.erly@doh.wa.gov</a>.</p>
          </div>

          <section class="welcome-secondary welcome-special-thanks" aria-labelledby="welcome-special-thanks-title">
            <h3 id="welcome-special-thanks-title">Special Thanks</h3>
            <p>Special thanks to the following organizations, individuals, and teams for their guidance, technical support, review, feedback, and testing:</p>
            <div class="welcome-thanks-list" tabindex="0" aria-label="Special Thanks acknowledgements">
              <ul>
                <li>Steven Erly, Health Equity and Syndemic Epidemiology Section Manager, Washington State Department of Health</li>
                <li>Nicole Adams, Molecular Epidemiology Coordinator, Washington State Department of Health</li>
                <li>Washington State Department of Health</li>
                <li>Cynthia Dong, PhD Candidate, Paul G. Allen School of Computer Science &amp; Engineering, University of Washington</li>
                <li>Kurtis Heimerl, Associate Professor, Paul G. Allen School of Computer Science &amp; Engineering, University of Washington</li>
                <li>Alex McGee, Assistant Director for IT &amp; Learning Technology, Department of Global Health, University of Washington</li>
                <li>Centers for Disease Control and Prevention (CDC) MicrobeTrace Team</li>
                <li>Centers for Disease Control and Prevention (CDC) Detection and Response Branch</li>
                <li>Georgia Department of Public Health</li>
                <li>Oregon Health Authority</li>
                <li>Idaho Department of Health and Welfare</li>
                <li>Los Angeles County Department of Public Health</li>
                <li>Public Health – Seattle &amp; King County</li>
              </ul>
            </div>
          </section>

          <div class="welcome-actions">
            <button id="get-started" class="button button-primary" type="button">Get Started</button>
          </div>
        </div>
      </section>
    </div>
  `;
}

export function initializeWelcomeDialog(root: HTMLElement): void {
  const overlay = requiredElement<HTMLElement>(root, "#welcome-overlay");
  const dialog = requiredElement<HTMLElement>(root, "#welcome-dialog");
  const closeButton = requiredElement<HTMLButtonElement>(root, "#close-welcome");
  const getStartedButton = requiredElement<HTMLButtonElement>(root, "#get-started");
  const appHeader = requiredElement<HTMLElement>(root, "#application-header");
  const appMain = requiredElement<HTMLElement>(root, "#application-main");
  const firstWorkflowControl = requiredElement<HTMLButtonElement>(root, "#drop-zone");

  const close = (): void => {
    if (overlay.hidden) return;
    overlay.hidden = true;
    appHeader.removeAttribute("inert");
    appMain.removeAttribute("inert");
    document.body.classList.remove("welcome-open");
    firstWorkflowControl.focus();
  };

  appHeader.setAttribute("inert", "");
  appMain.setAttribute("inert", "");
  document.body.classList.add("welcome-open");
  dialog.focus();

  closeButton.addEventListener("click", close);
  getStartedButton.addEventListener("click", close);
  dialog.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    const focusable = [...dialog.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex="0"]',
    )];
    const first = focusable[0]!;
    const last = focusable.at(-1)!;
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
  if (element === null) throw new Error(`Missing welcome element: ${selector}`);
  return element;
}
