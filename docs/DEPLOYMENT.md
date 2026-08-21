# Static Deployment

## Build

From the repository root:

```bash
npm install
npm test
npm run typecheck
npm run build
```

For reproducible automated builds, a deployment pipeline may use `npm ci` with the committed `package-lock.json`.

## Production output

Vite writes the production application to `dist/`. The directory contains static HTML, CSS, JavaScript, and synthetic sample assets. Serve the contents of `dist/` as the web root while preserving generated filenames and relative paths.

No application server, writable server storage, upload handler, analysis endpoint, database, or Python runtime is required. Suitable hosting can be an internal static web server, static object storage with web hosting, or a managed static-site service.

## Hosting model

- Use HTTPS.
- Serve HTML, CSS, JavaScript, CSV, and XLSX with correct MIME types.
- Enable JavaScript in supported browsers.
- Apply the recommended Content Security Policy from [Security](SECURITY.md).
- Keep `index.html` cache behavior short enough for releases to become visible promptly.
- Hashed assets can use longer cache lifetimes.

The production bundle contains its runtime dependencies. It does not require an analysis backend and does not submit uploaded files for server-side processing.

## Hosting responsibilities

The selected hosting environment and organization are responsible for:

- User access control and any VPN or internal-network restrictions
- TLS configuration and HTTPS redirection
- HTTP security headers, including CSP
- Cache and release policy
- Hosting and access-log retention
- Availability, backups, incident response, and operational monitoring
- Organizational security, privacy, and regulatory review

Static deployment guidance does not imply approval by any particular institution, public-health organization, or cloud platform.

## Post-deployment acceptance checks

Use synthetic data for acceptance testing:

1. Load the application over HTTPS and confirm static assets return successfully.
2. Import a valid CSV file and review its validation summary.
3. Import a valid XLSX file and confirm the first worksheet is used.
4. Run analysis and inspect KPI values, the CUSUM chart, and threshold line.
5. Exercise area, risk-group when applicable, alert-only, date, and chart-series filters.
6. Check the compact alert view and processed-result pagination.
7. Download all-results, filtered-results, and alerts CSV files.
8. Use Clear Data and confirm file and result state are removed.
9. Open and close Help with pointer and keyboard controls.
10. Review the browser console for application errors.
11. Review browser network activity and confirm that importing, analyzing, filtering, and exporting do not create data-bearing requests.
12. Confirm CSP enforcement does not block required local assets or Chart.js rendering.

Repeat `npm test`, `npm run typecheck`, and `npm run build` for each release candidate.
