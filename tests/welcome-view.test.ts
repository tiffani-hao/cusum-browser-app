// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import { createWorkflowApp } from "../src/ui/workflow-app";

describe("welcome dialog", () => {
  beforeEach(() => {
    document.body.className = "";
    document.body.innerHTML = '<div id="app"></div>';
  });

  it("appears on application entry with the approved content and accessible structure", () => {
    const root = createApp();
    const overlay = required<HTMLElement>(root, "#welcome-overlay");
    const dialog = required<HTMLElement>(root, "#welcome-dialog");

    expect(overlay.hidden).toBe(false);
    expect(dialog.getAttribute("role")).toBe("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-labelledby")).toBe("welcome-dialog-title");
    expect(root.querySelector("#welcome-dialog-title")?.textContent)
      .toBe("Welcome to the CUSUM Surveillance Tool");
    expect(root.querySelector("#welcome-dialog-intro")?.textContent).toContain(
      "Your data stays local in your browser and is not uploaded to or stored on a server.",
    );
    expect(root.querySelector(".welcome-contact")?.textContent).toContain(
      "Developed by:Tiffani Hao, MPH Candidate, Department of Global Health, University of Washington",
    );
    expect(root.querySelector(".welcome-contact")?.textContent).toContain(
      "For questions, feedback, or technical issues, please contact Steven Erly at steven.erly@doh.wa.gov.",
    );
    const emailLink = root.querySelector<HTMLAnchorElement>(
      '.welcome-contact a[href="mailto:steven.erly@doh.wa.gov"]',
    );
    expect(emailLink?.textContent).toBe("steven.erly@doh.wa.gov");
    expect(emailLink?.querySelector("strong")).toBeNull();
    expect(root.querySelector("#welcome-special-thanks-title")?.textContent).toBe("Special Thanks");
    expect(root.querySelector(".welcome-special-thanks > p")?.textContent).toBe(
      "Special thanks to the following organizations, individuals, and teams for their guidance, technical support, review, feedback, and testing:",
    );
    expect(root.querySelectorAll(".welcome-thanks-list li")).toHaveLength(13);
    expect(root.querySelector(".welcome-thanks-list")?.textContent).toContain(
      "Centers for Disease Control and Prevention (CDC) MicrobeTrace Team",
    );
    expect(root.querySelector(".welcome-thanks-list")?.textContent).toContain(
      "Public Health – Seattle & King County",
    );
    const acknowledgements = required<HTMLElement>(root, ".welcome-thanks-list");
    expect(acknowledgements.getAttribute("tabindex")).toBe("0");
    expect(acknowledgements.contains(required(root, "#get-started"))).toBe(false);
    expect(acknowledgements.contains(required(root, "#welcome-special-thanks-title"))).toBe(false);
    expect(required(root, "#application-header").hasAttribute("inert")).toBe(true);
    expect(required(root, "#application-main").hasAttribute("inert")).toBe(true);
    expect(document.body.classList.contains("welcome-open")).toBe(true);
    expect(document.activeElement).toBe(dialog);
  });

  it("closes with Get Started and reveals the normal workflow", () => {
    const root = createApp();
    required<HTMLButtonElement>(root, "#get-started").click();

    expect(required<HTMLElement>(root, "#welcome-overlay").hidden).toBe(true);
    expect(required(root, "#application-header").hasAttribute("inert")).toBe(false);
    expect(required(root, "#application-main").hasAttribute("inert")).toBe(false);
    expect(document.body.classList.contains("welcome-open")).toBe(false);
    expect(document.activeElement).toBe(root.querySelector("#drop-zone"));
  });

  it("also closes with the accessible X button or Escape", () => {
    let root = createApp();
    const close = required<HTMLButtonElement>(root, "#close-welcome");
    expect(close.getAttribute("aria-label")).toBe("Close welcome dialog");
    close.click();
    expect(required<HTMLElement>(root, "#welcome-overlay").hidden).toBe(true);

    document.body.className = "";
    document.body.innerHTML = '<div id="app"></div>';
    root = createApp();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(required<HTMLElement>(root, "#welcome-overlay").hidden).toBe(true);
  });

  it("keeps keyboard focus within the welcome dialog while open", () => {
    const root = createApp();
    const close = required<HTMLButtonElement>(root, "#close-welcome");
    const start = required<HTMLButtonElement>(root, "#get-started");

    start.focus();
    start.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(close);
    close.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Tab",
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    }));
    expect(document.activeElement).toBe(start);
  });

  it("appears again when the application is initialized again", () => {
    let root = createApp();
    required<HTMLButtonElement>(root, "#get-started").click();
    expect(required<HTMLElement>(root, "#welcome-overlay").hidden).toBe(true);

    document.body.innerHTML = '<div id="app"></div>';
    root = createApp();
    expect(required<HTMLElement>(root, "#welcome-overlay").hidden).toBe(false);
  });
});

function createApp(): HTMLElement {
  const root = document.querySelector<HTMLElement>("#app");
  if (root === null) throw new Error("Missing test root.");
  createWorkflowApp(root);
  return root;
}

function required<T extends Element = HTMLElement>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (element === null) throw new Error(`Missing test element: ${selector}`);
  return element;
}
