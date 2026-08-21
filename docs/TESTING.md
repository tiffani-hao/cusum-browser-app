# Testing

## Running tests

Install dependencies and run the automated checks from the repository root:

```bash
npm install
npm test
npm run typecheck
npm run build
```

`npm test` runs Vitest once. `npm run typecheck` checks TypeScript without emitting files, and `npm run build` creates the static production bundle.

## Test categories

The suite covers:

- Record and analysis-option validation
- Strict ISO dates, UTC date arithmetic, and interval anchoring
- Duplicate aggregation and missing-period completion
- Rolling smoothing, baseline mean, and sample standard deviation
- Normalization, CUSUM accumulation, series resets, and alerts
- CSV and XLSX parsing, headers, malformed inputs, and import limits
- In-memory state transitions, stale results, Clear Data, and new-file replacement
- Display filters and deterministic result selection
- Chart data, threshold and alert styling, and Chart.js lifecycle
- Alert and processed-result tables, formatting, and pagination
- Full-precision CSV serialization, formula-injection protection, and local downloads
- UI workflow, Help behavior, keyboard interaction, semantic markup, and responsive states
- Source-level safeguards against data transmission and browser persistence
- Large synthetic workloads through the supported row limit

## Golden fixtures

The repository includes 26 self-contained expected fixtures in `test-fixtures/expected/`. Each fixture contains exact raw replay input, explicit analysis options, expected processed records, and an expected summary. The parity suite passes each fixture through the public `analyzeCusum` pipeline without an external data source.

Together, the fixtures protect established behavior for:

- Daily, weekly, and monthly analysis
- Monday weekly anchoring and first-of-month monthly anchoring
- Configurable smoothing, baseline, K, and threshold values
- Duplicate-period aggregation
- Missing daily, weekly, and monthly periods
- Early smoothing and baseline windows
- First-period and zero-standard-deviation behavior
- Multiple areas and optional risk-group grouping
- Independent CUSUM resets between series
- Threshold equality as a non-alert and greater-than-threshold alerts

Strings, dates, booleans, counts, and grouping fields use exact comparisons. Floating-point analytical fields use an absolute tolerance of `1e-10`.

## Current verification

The latest repository run contains 20 test files and 181 passing tests, with no failures or skipped tests. All 26 golden fixtures pass. Type checking and the static production build also pass.

## Performance observations

Performance tests generate synthetic counts and exercise CSV parsing, validation, analysis, filtering, chart-data construction, pagination, and CSV serialization. The following approximate timings were observed with Node 24.14.0 on macOS:

| Rows | CSV parse | Validation | Analysis | Filtering | Chart data | CSV serialization |
|---:|---:|---:|---:|---:|---:|---:|
| 1,000 | 1.4 ms | 1.3 ms | 10.6 ms | 0.3 ms | 0.7 ms | 0.9 ms |
| 10,000 | 3.5 ms | 6.0 ms | 30.5 ms | 1.2 ms | 2.8 ms | 9.5 ms |
| 50,000 | 17.2 ms | 28.6 ms | 103.5 ms | 3.9 ms | 12.8 ms | 29.9 ms |
| 100,000 | 34.4 ms | 50.8 ms | 176.6 ms | 8.2 ms | 21.5 ms | 61.3 ms |

These are machine-specific observations, not browser performance guarantees. The generated workload uses as many as 100 independent series and 1,000 daily periods per series. Tests also check that analysis retains records, processed tables render no more than the selected 100-row page size, and chart construction does not sample data.

Parsing and analysis currently run on the browser's main thread. The chart pauses when more than 20 series are selected and asks the user to reduce the explicit selection; tables and exports remain available. Representative deployment hardware should be included in acceptance testing if large files are expected.
