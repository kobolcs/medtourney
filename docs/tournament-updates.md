# Refresh and offline behavior

The daily GitHub workflow queries chess-results.com for a bounded UTC window (today ±180 days). Processing validates start/end dates and retains events overlapping today minus7 days, including events already in progress. Long events remain subject to the frontend's existing opt-in filter.

Both the initial scrape and enriched output must pass publication checks: valid non-empty data, unique source URLs, ordered dates, sidecar row count and parseable generation time, plus the existing abrupt count-drop guard. Metadata-only changes are committed so successful unchanged scrapes still update the published timestamp. Failures leave the last published dataset intact.

Browsers request valid fresh data before falling back to a validated last-good cache, even if its normal TTL expired. Data and generation time are saved together. The header identifies network updates, offline cached snapshots, or bundled fallback dates; missing sidecars never invent a date or invalidate good rows.

Private deployments may set `<meta name="medtourney-data-source" content="https://kobolcs.github.io/medtourney/">`. This uses a source-isolated cache and falls back to bundled data only if the source and its cache are unavailable. The CSP must allow that origin. Public Pages uses its existing same-origin default.
