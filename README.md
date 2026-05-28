# Square Reporting UI

A standalone Next.js front end for the [Square Reporting API](https://developer.squareup.com/docs/reporting-api/getting-started). Browse the live schema, build queries by clicking on measures and dimensions, and visualize results as summary cards, sortable tables, and Recharts line/bar/area/pie charts.

## Features

- Dynamic, schema-driven UI — every measure, dimension, segment, and filter operator comes from `/v1/meta`, so the app stays in sync as Square evolves the API
- Searchable multi-select chip pickers with stability badges (`ga` / `beta` / `preview` / `deprecated`)
- Time-dimension editor with date-range presets (today, last 30 days, this month, custom range, etc.) and granularity (hour → year)
- Filter builder with all 14 operators including `inDateRange`, `set`, `notSet`
- Order, limit, offset controls
- Live JSON preview of the request that will be sent to `/v1/load`
- Server-side proxy that handles the `Continue wait` retry loop for slow queries
- Server-side TTL cache for `/v1/meta` (default: 1 hour)
- Summary cards, sortable table (with CSV download), auto-selected chart type, and a request/response JSON inspector
- Dark theme, keyboard-accessible controls, no third-party UI kit

## Stack

- Next.js 15 (App Router) + React 19 + TypeScript
- Tailwind CSS v4
- SWR (client cache for the meta endpoint)
- zod (server-side query validation)
- Recharts (visualizations)
- date-fns (date utilities)

## Prerequisites

- Node.js 18.18+ (Node 20+ recommended)
- A Square access token with at minimum the `REPORTING_READ` scope. Adding the `MERCHANT_PROFILE_READ` scope unlocks the friendly location picker on `*.location_id` filter rows. Either:
  - A **personal access token** generated in the [Developer Console](https://developer.squareup.com/apps) (PATs typically include both scopes by default), or
  - An **OAuth token** obtained via the OAuth flow with the `REPORTING_READ` and (optionally) `MERCHANT_PROFILE_READ` permissions

## Setup

```bash
npm install
cp .env.local.example .env.local
# Then edit .env.local and paste in your access token
npm run dev
```

The app runs at <http://localhost:3000>.

### Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `SQUARE_ACCESS_TOKEN` | _(required)_ | Bearer token sent to the Square Reporting + Locations APIs. Server-only. |
| `SQUARE_REPORTING_BASE` | `https://connect.squareup.com/reporting` | Reporting API base URL. Use `https://connect.squareupsandbox.com/reporting` for sandbox. |
| `SQUARE_CONNECT_BASE` | derived from `SQUARE_REPORTING_BASE` | Optional override for the host used by `/v2/...` endpoints (locations). |
| `SQUARE_API_VERSION` | _(unset)_ | Optional `Square-Version` header for `/v2` calls. |
| `META_CACHE_TTL_SECONDS` | `3600` | How long the schema is cached in-process. |
| `LOCATIONS_CACHE_TTL_SECONDS` | `3600` | How long the location list is cached in-process. |
| `REPORTING_MAX_RETRIES` | `10` | Maximum `Continue wait` retries before returning HTTP 504. |
| `REPORTING_RETRY_MS` | `1500` | Delay between retries (ms). |

### Entegraid main-page SSO (optional)

When Microsoft Entra ID credentials are configured, unauthenticated users are redirected from `/` to `/login` for SSO sign-in. **Only the home page is gated** — `/api/meta`, `/api/query`, `/api/locations`, and all other routes behave exactly as before.

| Variable | Purpose |
| --- | --- |
| `ENTEGRAID_MAIN_PAGE_SSO_ENABLED` | Set to `false` to disable the gate even if Entra credentials exist. Set to `true` to require SSO when `AUTH_SECRET` and Entra vars are set. |
| `AUTH_SECRET` | Session encryption secret (`openssl rand -base64 32`). |
| `AUTH_URL` | Public URL of the app (e.g. `http://localhost:3000` or your production domain). |
| `AUTH_MICROSOFT_ENTRA_ID_ID` | Azure app registration client ID. |
| `AUTH_MICROSOFT_ENTRA_ID_SECRET` | Azure client secret. |
| `AUTH_MICROSOFT_ENTRA_ID_ISSUER` | Tenant issuer URL, e.g. `https://login.microsoftonline.com/<tenant-id>/v2.0`. |

Register a **Web** redirect URI in Entra ID: `https://<your-host>/api/auth/callback/microsoft-entra-id`.

The token is **never** sent to the browser — all calls go through the `/api/meta` and `/api/query` proxy routes.

## Running your first query

1. The app boots into the **Sales** view by default.
2. The starter query selects `Sales.net_sales` over `Sales.local_reporting_timestamp` for the last 30 days, grouped by day.
3. Click **Run query** in the bottom-left.
4. Switch between **Summary**, **Table**, **Chart**, and **JSON** tabs in the right pane.
5. Use **Download CSV** to export the visible table.

To explore other data, pick a different source under **Source**:

- **Sales** view — pre-filtered to closed orders (recommended)
- **ItemSales** view — item-level data
- **Orders** cube — raw order data; remember to add the `Orders.closed_checks` segment to mirror the dashboard
- **OrdersLive** cube — ~1-minute freshness for today's data

## Architecture

```
Browser  ──── SWR ────►  /api/meta       ────►  Square /reporting/v1/meta   (cached server-side)
Browser  ──── fetch ───►  /api/query      ────►  Square /reporting/v1/load   (with Continue-wait retry)
Browser  ──── SWR ────►  /api/locations  ────►  Square /v2/locations         (cached server-side)
```

```
app/
  api/
    meta/route.ts          GET — proxies + caches /v1/meta
    query/route.ts         POST — validates + proxies /v1/load with retry loop
    locations/route.ts     GET — proxies + caches /v2/locations for the location picker
  page.tsx                 single-page builder + results layout
  layout.tsx               dark theme shell
components/
  QueryBuilder.tsx         left rail orchestrator
  CubePicker.tsx
  MeasureSelector.tsx
  DimensionSelector.tsx
  TimeDimensionEditor.tsx
  SegmentSelector.tsx
  FilterBuilder.tsx
  OrderLimitControls.tsx
  QueryJsonPreview.tsx
  ResultsPanel.tsx         right pane tabs
  SummaryCards.tsx
  ResultsTable.tsx
  ResultsChart.tsx
  ui/                      generic primitives (Section, Badge, MultiPicker)
lib/
  squareReporting.ts       Reporting API client + Continue-wait retry
  metaCache.ts             in-memory TTL cache
  queryShape.ts            zod schema + helpers
  format.ts                currency/percent/number formatting
  dateRanges.ts            date-range preset list
  types.ts                 Reporting API TypeScript types
```

## Production notes

- The `/api/query` route is configured with `maxDuration = 60` for Vercel Hobby. Increase or move to a long-running runtime if you expect frequent slow queries that exceed 60 seconds.
- The meta cache lives in process memory, so it's per-instance. Behind multiple instances, each one fetches `/v1/meta` once per TTL window.
- This app uses a single shared access token. If you need to support multiple Square merchants, replace the token with a per-request OAuth flow.

## Troubleshooting

| Symptom | Likely fix |
| --- | --- |
| "Could not connect to Square Reporting" on boot | Confirm `SQUARE_ACCESS_TOKEN` is set in `.env.local` and the dev server has been restarted. |
| HTTP 403 from `/v1/meta` | The token is missing the `REPORTING_READ` scope. Regenerate it. |
| HTTP 504 / "Reporting query timed out" | Either the query is genuinely slow (raise `REPORTING_MAX_RETRIES`) or the request is hitting Vercel's 60s `maxDuration` cap. |
| Empty data array | The date range may have no activity. Try widening to "last 30 days" and removing filters. |

## License

MIT (or whichever license your project uses).
