# Ethiopia Vitals

A single-page, map-centred console for Ethiopia's economy, infrastructure and weather. Every figure shows its source and the period it describes. This is the v1 scope of the product requirements: vitals strip with sparklines, neighbour comparison, what-changed feed, infrastructure map and tracker, live weather.

**Runs at zero cost:** a static Next.js export on GitHub Pages, refreshed by a daily GitHub Actions job in this public repository. No database, no paid API, no keyed map tiles.

## Data sources (verified November 2026)

| Data | Source | Access | Refresh |
|---|---|---|---|
| GDP growth, inflation, FX (official annual avg), reserves, external debt, population | World Bank Indicators API v2 | Open, no key | Daily job (source updates annually) |
| Alternative values for GDP growth and inflation | IMF DataMapper (WEO) | Open, no key | Weekly job, Mondays |
| Current weather and 7-day forecast, 8 cities | Open-Meteo | Open, no key, free for non-commercial use; called from the browser | Every 15 min |
| Country boundaries, lakes, disputed areas | Natural Earth (public domain) | Bundled | Static |
| Infrastructure projects | Curated, with source URLs per record | `data/curated/infrastructure.geojson` | Monthly review |

The IMF DataMapper refused requests from the build sandbox (HTTP 403). The fetcher records this in `data/health.json`, and the System Health panel shows the source as OFFLINE. The dashboard works without it, since the World Bank is the primary source.

## Freshness rules

- **Stale** is about the source, not the period. A source is NOMINAL if its last successful fetch is within its expected interval, DELAYED if the latest fetch failed but the last success is still within twice the interval, and OFFLINE (tiles marked STALE) beyond that.
- **Period** is shown on every figure (`2024`, `2025`). Annual statistics lag; the label says so instead of a stale flag that would never clear.
- A failed fetch never blanks or estimates a value. The last good value stays with its original date.

## Layout

```
app/                 Next.js App Router page (static export)
components/          shell (status bar, drawer, event log, health), vitals, map, weather, infra
config/              indicators.json, cities.json, thresholds.json (status-light rules)
data/series/*.json   dated history per country (data contract: value, unit, asOf, period, source, sourceUrl, fetchedAt)
data/changes.json    computed what-changed feed
data/events.json     new periods, revisions, source failures
data/health.json     per-source last attempt / last success / error
data/curated/        hand-maintained infrastructure GeoJSON + monthly checklist
data/geo/            Natural Earth base (built by scripts/build-geo.py)
lib/                 schema, freshness, formatting, Ethiopian calendar, URL state, Open-Meteo client
scripts/             one fetcher per source, change builder, validator
```

## Run locally

```bash
npm ci
npm run fetch:all   # World Bank + IMF + what-changed feed
npm run validate
npm run dev
```

## One-time GitHub setup

1. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
2. **Settings → Actions → General → Workflow permissions: Read and write.** The daily job commits refreshed `/data`.
3. Run **Actions → Update data and deploy → Run workflow** once. The site is published at `https://<owner>.github.io/<repo>/`.

## Not in v1

Trade panel, FX/commodity tiles, news, earthquakes, flights, rainfall overlay, event timeline, Ethiopian-calendar toggle for charts, alerts, Red Sea monitor (v2); insight features (v3). The TRADE, HUMANITARIAN and COMMS desks arrive with those phases.
