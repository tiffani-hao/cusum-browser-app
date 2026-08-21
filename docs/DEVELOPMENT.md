# Development Guide

## Application architecture

The application is framework-free TypeScript built with Vite. Its runtime flow is:

```text
index.html
  -> src/main.ts
  -> UI workflow
  -> local file parsing and validation
  -> in-memory application state
  -> analyzeCusum
  -> chart, alerts, processed tables, and local export
```

`src/main.ts` loads the stylesheet and mounts the workflow application. UI modules coordinate browser controls and state, while the analytical engine remains independent of the DOM and file APIs.

## Source structure

- `src/core/` contains record and option validation, date and period handling, grouping, aggregation, missing-period completion, rolling statistics, CUSUM calculation, and the public `analyzeCusum` pipeline. These modules are pure browser-compatible TypeScript.
- `src/import/` contains CSV and XLSX parsers, header and table validation, file safeguards, metadata construction, and the bridge from parsed rows to analytical validation.
- `src/config/` contains the extensible disease-preset definitions. Presets supply ordinary analysis options and do not create a separate calculation path.
- `src/state/` contains the framework-free in-memory store for file, validation, analysis, and result-view state.
- `src/results/` contains deterministic selectors, display filters, Chart.js data and lifecycle management, table pagination, CSV serialization, and download handling.
- `src/ui/` renders and coordinates the workflow, Help dialog, result summary, chart, alert view, processed table, and export controls.

Supporting assets include synthetic examples in `sample-data/`, replayable analytical fixtures in `test-fixtures/expected/`, and automated tests in `tests/`.

## File import and validation

The browser accepts UTF-8 `.csv` files and `.xlsx` workbooks. Legacy binary `.xls` files are not supported.

Import safeguards are defined as constants:

- Maximum file size: 10 MiB
- Maximum parsed data rows: 100,000
- One active file at a time
- At least one header row and one data row

Papa Parse reads CSV text, including quoted commas and embedded newlines. A UTF-8 byte-order mark is removed from the first header. `read-excel-file` reads an XLSX `ArrayBuffer`; the first worksheet is selected. Formula expressions are not evaluated, and stored cell values are treated as data. Macro-enabled file extensions are not accepted.

Both parsers preserve source headers, reject empty or duplicate names, ignore completely blank trailing rows, and retain partially populated rows for validation. Import then recognizes the required `area`, `date`, and `count` columns and the optional `risk_group` column. Numeric text is converted only for the known `count` field before records enter the analytical validator.

Validation feedback distinguishes file, header, row, and option issues. Row-level messages expose only a row number, field name, and general reason. Analysis remains unavailable while blocking issues exist.

## Application state

The store distinguishes initial, parsing, parse-failed, parsed, validation-failed, valid-input, analysis-running, analysis-completed, and analysis-failed states. It can hold the active browser `File`, neutral metadata, parsed records, validation issues, analysis options, processed records, and non-sensitive UI messages in JavaScript memory.

Selecting a new file removes the preceding file and result state before parsing starts. A sequence guard prevents an older, slower parse from replacing a newer selection. `clearData()` releases the file reference, parsed and processed records, validation state, chart, filters, pagination, export state, displayed metadata, and file-input value, then returns the application to its initial defaults.

Analysis settings and display filters have separate behavior:

- Changing interval, smoothing window, baseline window, K, threshold, risk-group grouping, or preset marks a completed result stale. The user must run analysis again before viewing current results or exporting them.
- Area, risk-group, alert-only, date-range, series, and pagination controls operate on the existing completed result. They never call `analyzeCusum` or change analytical values.

Restore Defaults returns the settings to the HIV preset without clearing the selected file or running analysis.

## Results and export

Completed analysis provides four summary metrics: input rows, processed rows, alerts, and maximum CUSUM. Chart.js draws one line per independent series, using area names or `Area — Risk group` labels, plus one dashed threshold line. Alert point styling uses the engine's existing `is_alert` value.

Display filters are derived from the completed result and apply immediately to the chart, alert view, and processed table. Chart-series selection is separate from record filtering. If more than 20 series are selected, the chart pauses and asks for a smaller explicit selection; records are never sampled or silently hidden.

The alert view is ordered by date descending and starts with a compact summary and five-row preview. The processed table displays area, optional risk group, date, count, normalized count, CUSUM, threshold, and text alert status. Smoothing and baseline fields remain in processed records and exports. Pagination supports 25, 50, or 100 rows per page, and filter changes return tables to page 1.

Local CSV export supports all processed results, the current filtered results, and alerts in the current filtered result. It preserves full analytical precision and does not export raw uploaded rows. Download handling uses a temporary `Blob` URL and revokes it after use.

## User interface and accessibility

The interface follows a compact vertical workflow: Upload data, File validation, Analysis settings, and Results. A dark-purple application bar contains the product title and Help button. The Help dialog provides workflow, input, methodology, privacy, and synthetic-sample guidance.

The UI uses native controls, semantic headings and tables, visible focus indicators, live status messages, textual alert states, a chart summary, and a complete tabular alternative to the canvas. Controls reflow on narrow screens, while table overflow remains contained within each table region.

## Development conventions

The browser application is self-contained and does not depend on files outside this repository. Production modules remain browser-compatible and contain no Node-only imports; tests may use Node APIs for committed synthetic fixtures and tooling.

Changes to the analytical engine should include the relevant unit tests and all golden-fixture regression tests. Expected fixture values should change only as part of an intentional, reviewed methodology change. Standard one-sided CUSUM is the supported analytical method.

Only synthetic data belongs in the repository. Real surveillance records, personal or protected health information, credentials, logs, temporary uploads, and derived sensitive outputs belong outside source control.

## Local commands

```bash
npm install
npm run dev
npm test
npm run typecheck
npm run build
```
