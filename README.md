# CUSUM-Based Early Detection Tool

This repository contains a browser-based research prototype for detecting unusual increases in infectious-disease counts with standard one-sided CUSUM. Files are parsed, validated, analyzed, visualized, and exported locally in the browser; the application does not require an analysis backend or database.

## Features

- CSV and XLSX input with local validation
- Daily, weekly, and monthly analysis intervals
- Independent analysis by area, with optional risk-group grouping
- Standard one-sided CUSUM with configurable analysis settings
- Interactive CUSUM visualization, threshold line, and alert display
- Display filters and paginated processed results
- Local CSV export of processed results
- Browser-local, in-memory analysis

## Input format

Input files require these columns:

- `area`
- `date`
- `count`

The optional `risk_group` column can define separate series within each area. See [Algorithm](docs/ALGORITHM.md) for data rules and calculation details.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. The application includes synthetic sample files in `sample-data/` and in the Help dialog.

## Testing

```bash
npm test
npm run typecheck
npm run build
```

## Documentation

- [Algorithm](docs/ALGORITHM.md)
- [Development](docs/DEVELOPMENT.md)
- [Security](docs/SECURITY.md)
- [Testing](docs/TESTING.md)
- [Deployment](docs/DEPLOYMENT.md)

## Status

This repository contains a working research prototype intended for further software-engineering review and deployment planning.
