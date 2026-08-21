# Security and Privacy

## Local-processing model

The production application reads selected files through browser file APIs and passes their contents directly to locally bundled parsers. Validation, CUSUM analysis, visualization, filtering, tables, and export run in the browser. No analysis backend, file-upload endpoint, remote database, analytics integration, or telemetry integration is part of the application.

Uploaded and processed records are held in the current page's JavaScript memory. Selecting another file replaces the preceding state, Clear Data releases the current file and result state, and reloading or closing the page ends the in-memory session.

This model describes the application code. The hosting environment still serves static assets and may maintain ordinary access logs according to its own configuration.

## Browser storage

Production application logic does not store surveillance records in:

- `localStorage`
- `sessionStorage`
- IndexedDB
- cookies
- service-worker caches

The application has no service worker and does not intentionally persist uploaded filenames, parsed rows, calculated results, or display filters between page loads.

## Network behavior

Production application logic does not send uploaded surveillance records or calculated results to an analysis service. Parsers receive local text or `ArrayBuffer` values rather than URLs, and exports use browser download APIs. No upload, analysis, analytics, telemetry, WebSocket, or remote error-reporting endpoint is configured.

Development behavior differs from production: Vite's local development server uses a WebSocket for hot module replacement. That connection is development tooling and is not included in the static production application.

## Rendering and export safety

Imported strings are treated as untrusted text and are inserted through DOM text APIs rather than executable markup. The application does not render uploaded HTML.

CSV export protects spreadsheet users from formula injection. A string beginning with optional whitespace followed by `=`, `+`, `-`, or `@` is prefixed with a single quote. The original string is otherwise preserved. Numeric analytical values, including negative numbers, are serialized as numbers and are not changed by this rule.

Downloads use a UTF-8 `Blob`, a temporary object URL, and a temporary link. The link is removed and the object URL is revoked after the download attempt.

## File safeguards

- Supported formats: UTF-8 CSV and XLSX
- Maximum file size: 10 MiB
- Maximum parsed data rows: 100,000
- XLSX worksheet selection: first worksheet
- Empty files, unsupported extensions, malformed tables, empty or duplicate headers, and header-only files are rejected

These limits reduce accidental main-thread and memory pressure; they are not a substitute for deployment access controls or organizational data-handling policy.

## Production dependencies

All production dependencies are installed from npm and bundled into the static JavaScript by Vite.

| Dependency | Purpose |
|---|---|
| Chart.js | Renders the local CUSUM canvas chart |
| Papa Parse | Parses local CSV text |
| read-excel-file | Parses local XLSX buffers |

The application uses no CDN scripts. These libraries do not require an application backend for the configured browser-local paths.

## Content Security Policy

The following policy matches the current static production build:

```text
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:;
font-src 'self';
connect-src 'none';
object-src 'none';
base-uri 'self';
form-action 'none';
frame-ancestors 'none';
worker-src 'none';
manifest-src 'self';
media-src 'none';
```

`script-src 'self'` limits executable JavaScript to the hosted bundle. `connect-src 'none'` reflects the production application's no-network design. `style-src 'unsafe-inline'` is currently required because Chart.js applies responsive canvas style properties at runtime; it does not permit inline scripts. `form-action`, `object-src`, `worker-src`, and `frame-ancestors` disable capabilities the application does not use.

The hosting operator should apply CSP as an HTTP response header where possible and test the deployed build before enforcement. Vite development-server exceptions, especially its local WebSocket connection, should not be copied into the production policy.

## Deployment boundary

HTTPS, user access control, VPN or internal-network restrictions, HTTP security headers, cache policy, server logs, backup policy, incident response, and regulatory review are responsibilities of the selected hosting environment and organization. The application's local-processing design does not by itself establish compliance with a regulatory framework.
