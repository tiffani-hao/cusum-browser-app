import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function productionTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? productionTypeScriptFiles(path) : path.endsWith(".ts") ? [path] : [];
  });
}

describe("local-only production safeguards", () => {
  it("contains no transmission or persistence APIs", () => {
    const files = productionTypeScriptFiles(new URL("../src/", import.meta.url).pathname);
    const prohibited = /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|localStorage|sessionStorage|indexedDB)\b|document\.cookie|serviceWorker\.register/;
    for (const file of files) expect(readFileSync(file, "utf8"), file).not.toMatch(prohibited);
  });

  it("contains no data-bearing form submission", () => {
    const files = productionTypeScriptFiles(new URL("../src/", import.meta.url).pathname);
    for (const file of files) expect(readFileSync(file, "utf8"), file).not.toMatch(/\.submit\s*\(|requestSubmit\s*\(/);
  });

  it("contains no production console logging", () => {
    const files = productionTypeScriptFiles(new URL("../src/", import.meta.url).pathname);
    for (const file of files) expect(readFileSync(file, "utf8"), file).not.toMatch(/\bconsole\s*\./);
  });

  it("contains no remote executable script URLs", () => {
    const files = productionTypeScriptFiles(new URL("../src/", import.meta.url).pathname);
    for (const file of files) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(/https?:\/\/[^"'`\s]+(?:\.js|\/script)/i);
    }
  });
});
