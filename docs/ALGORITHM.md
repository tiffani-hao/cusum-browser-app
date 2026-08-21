# CUSUM Algorithm

## Purpose

The application analyzes surveillance counts over time and uses a standard one-sided cumulative sum (CUSUM) to identify sustained increases relative to a trailing baseline. Each reporting area is analyzed independently, optionally subdivided by risk group.

## Required data

The application accepts UTF-8 CSV and XLSX files. Required columns are:

- `area`: a nonempty reporting-area name
- `date`: a valid ISO calendar date in `YYYY-MM-DD` form
- `count`: a finite, nonnegative number

The optional `risk_group` column can define separate CUSUM series within each area. Column names must match exactly. Empty or duplicate headers are rejected, while additional columns are retained during import but are not used by the analytical pipeline.

Completely blank trailing rows are ignored. Partially populated rows remain in the imported table so validation can report their row numbers and affected fields without displaying complete records.

## Supported intervals

The selected analysis interval determines how input dates are standardized:

- **Daily:** each date remains on its calendar day.
- **Weekly:** each date is assigned to the Monday of its week.
- **Monthly:** each date is assigned to the first day of its month.

Date operations use UTC calendar logic. Processed records are ordered by area, risk group when enabled, and standardized date.

## Preprocessing

Rows that share an independent series and standardized period are aggregated by summing their counts. Missing periods between the earliest and latest period in each series are then inserted with a count of zero.

By default, each area is an independent series. When risk-group grouping is enabled, each area and risk-group combination is independent. CUSUM state never carries from one series into another.

The order of operations is:

1. Validate records and analysis options.
2. Standardize dates to the selected interval.
3. Aggregate duplicate periods within each series.
4. Fill missing periods with zero counts.
5. Sort records within each series.
6. Calculate rolling statistics and CUSUM.

## CUSUM calculation

### Smoothing

The smoothed count is the trailing mean of period counts, including the current period:

```text
smoothed_count[t] = mean(counts in the trailing smoothing window)
```

Before the full smoothing window is available, the calculation uses all available observations.

### Baseline

The baseline mean and standard deviation are calculated from the trailing window of period counts, including the current period. The baseline is not calculated from the smoothed values.

```text
baseline_mean[t] = mean(counts in the trailing baseline window)
```

For values `x1 ... xn`, the baseline standard deviation is the sample standard deviation:

```text
baseline_std = sqrt(sum((xi - mean)^2) / (n - 1))
```

This is equivalent to `ddof=1`. If the standard deviation is unavailable because fewer than two values exist, or if it is zero, the implementation uses `1`.

### Normalization and accumulation

```text
normalized_count[t] =
  (smoothed_count[t] - baseline_mean[t]) / baseline_std[t]
```

Each independent series starts with a previous CUSUM of zero. For each period:

```text
cusum[t] = max(0, cusum[t - 1] + normalized_count[t] - K)
```

The `max(0, ...)` term resets negative accumulation to zero. Alert status uses a strict comparison:

```text
is_alert = cusum > threshold
```

A CUSUM exactly equal to the threshold is not an alert. Analytical output retains full JavaScript floating-point precision; display formatting does not change stored values.

## Analysis settings and defaults

Users can configure the analysis interval, smoothing window, baseline window, K, threshold, and risk-group grouping.

The current default preset is **HIV**:

| Setting | Value |
|---|---:|
| Analysis interval | Monthly |
| Smoothing window | 3 |
| Baseline window | 36 |
| K | 0.1 |
| Alert threshold | 3 |
| Group by risk group | Disabled |

These are application defaults, not universal recommendations for every HIV surveillance context. **Custom** preserves the current values and allows them to be edited. A preset populates analysis settings; it does not alter the CUSUM formula or run analysis automatically.

Additional disease presets can be added through the preset configuration after their names and complete parameter definitions have been established. Standard one-sided CUSUM remains the only analytical method.
