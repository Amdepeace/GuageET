# Ethiopia Vitals

A single-page, map-centred console for Ethiopia's economy, infrastructure and weather. Every figure shows its source and the period it describes. This is the v1 scope of the product requirements: vitals strip with sparklines, neighbour comparison, what-changed feed, infrastructure map and tracker, live weather.

**Runs at zero cost:** a static Next.js export on GitHub Pages, refreshed by a daily GitHub Actions job in this public repository. No database, no paid API, no keyed map tiles.

## Data sources (verified November 2026)

| Data | Source | Access | Refresh |
|---|---|---|---|
| GDP growth, inflation, FX (official annual avg), reserves, external debt, population | World Bank Indicators API v2 | Open, no key | Daily job (source updates annually) |
| Alternative values for GDP growth and inflation | IMF World Economic Outlook via the IMF SDMX API (`api.imf.org`) | Open, no key | Weekly job, Mondays |
| Current weather and 7-day forecast, 8 cities | Open-Meteo | Open, no key, free for non-commercial use; called from the browser | Every 15 min |
| Country boundaries, lakes, disputed areas | Natural Earth (public domain) | Bundled | Static |
| **Detailed map**: rivers, streams, lakes, roads, rail, towns, facilities, city streets | OpenStreetMap via the HOT exports on HDX (ODbL) | Static files in `public/geo-detail/`, loaded on demand | Snapshot, rebuilt by hand |
| Infrastructure projects | Curated, with source URLs per record | `data/curated/infrastructure.geojson` | Monthly review |
| **v2** Commodity prices (coffee, gold, crude oil) | World Bank Pink Sheet (.xlsx) | Open, no key | Daily job (source monthly) |
| **v2** Daily birr/USD (market) | open.er-api.com | Open, no key | Daily job |
| **v2** Earthquakes (Horn/Rift region) | USGS | Open GeoJSON; called from the browser | Every 10 min |
| **v2** Red Sea transit (Bab el-Mandeb, Suez) | IMF PortWatch (ArcGIS) | Open, no key | Daily job |
| **v2** Headlines | GDELT 2.0 Doc API plus RSS from Capital Ethiopia, The Reporter and Addis Fortune | Open, no key; GDELT rate-limits, so RSS is the fallback | Daily job |
| **v2** Trade partners and balance | UN Comtrade | Free tier, **needs a key** (see below) | Daily job |
| Remittances received, FDI net inflows | World Bank | Open, no key | Daily job |
| External-debt composition, ratios, IMF programme | World Bank IDS + curated IMF timeline | Open, no key (timeline curated) | Daily job |
| People in need, food insecurity (IPC), staple food prices | HDX (HAPI) | Free, **needs an app identifier** (see below) | Daily job |

### v2 features

Pulse row (daily FX + commodity tiles), a live **earthquakes** map layer (toggle "Quakes"), the **Red Sea risk monitor**, a **headlines** feed, an in-page **alerts banner** (FX moves, Red Sea drops, big quakes), **event markers** on the vital charts (birr float, GERD milestones), an **Ethiopian-calendar** axis toggle (E.C./G.C.) on those charts, and a **Trade panel**.

### Enabling the Trade panel (optional)

The Trade panel needs a free UN Comtrade key:

1. Register at [comtradeplus.un.org](https://comtradeplus.un.org/) (free tier, email).
2. In the repo: **Settings → Secrets and variables → Actions → New repository secret**, named `COMTRADE_PRIMARY_KEY`.
3. Re-run **Update data and deploy**. Until then the panel shows an "awaiting key" state and the TRADE desk light is amber; nothing else is affected.

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

## Detailed map

Open the **Detail layers** panel on the map to switch on rivers and lakes, streams and tributaries, main and tertiary roads, rail and runways, towns and villages, facilities, and city streets. Everything is OpenStreetMap data, loaded only when a layer is switched on, so the page itself stays light.

- **Rivers:** about 10,000 river segments, 18,000 streams, and lakes, reservoirs and wetlands (including the GERD reservoir), with river names along the line.
- **Roads:** the national network from motorway to tertiary, with road names, plus full street networks (and street names) for 12 cities: Addis Ababa, Adama, Bishoftu, Dire Dawa, Harar, Jijiga, Mekelle, Dessie, Bahir Dar, Gondar, Hawassa and Jimma. Use **Jump to a city** or just zoom in.
- **Facilities:** about 11,700 points (health, schools and universities, banks, fuel, markets, civic and safety, transport, industry), each category with its own icon shape, so colour is never the only cue.
- **Names:** English or Amharic (አማርኛ), drawn as native map text using self-hosted Noto Sans glyphs.
- **Rail:** the curated Addis–Djibouti and Awash–Weldiya lines use the real OpenStreetMap track. Other curated lines are hand-drawn and are marked `schematic`, so they fade out when you zoom to city scale.

Licence and rebuild steps for the data are in [`public/geo-detail/README.md`](public/geo-detail/README.md). OpenStreetMap is volunteer-mapped: an empty area may simply be unmapped.

## World relations

Zoom the map out and click any country to open its **relations with Ethiopia**:

- **Key indicators** — that country's GDP, population and growth beside Ethiopia's (World Bank, all countries via `data/world-indicators.json`).
- **Shared organizations & blocs** — which of AU, IGAD, COMESA, EAC, BRICS+, Arab League, EU, Nile Basin, OPEC, Commonwealth and G20 it shares with Ethiopia, plus the ones only one of them is in (curated membership in `config/blocs.json`, computed overlap).
- **Bilateral trade** — Ethiopia's exports to / imports from that country (UN Comtrade, keyed by M49; needs the Comtrade key).
- **Curated relations profile** — current relations, history and economic ties for ~14 key partners (China, US, Eritrea, Egypt, Sudan, Djibouti, Kenya, Somalia, Saudi, UAE, Türkiye, Russia, India, Italy), each sourced in `data/curated/relations.json`. Other countries show the structured sourced data only, never invented prose.

The world layer is bundled Natural Earth 110m (`data/geo/world.geojson`); the detailed regional base stays as-is.

### Enabling the Humanitarian panel (optional)

The HUMANITARIAN panel uses HDX HAPI, which needs a free **app identifier** (just an app name + email, no account):

1. Generate one at [hapi.humdata.org/docs](https://hapi.humdata.org/docs) (the "Get started / app identifier" step).
2. Add it as the repo secret `HDX_APP_IDENTIFIER`.
3. Re-run the workflow. People-in-need, food insecurity (IPC) and staple prices populate; the HUMANITARIAN desk goes live.

Each humanitarian figure keeps its own reference period and original provider (IPC, WFP, OCHA) — some series (e.g. national IPC) update infrequently, so they are clearly dated rather than shown as current.

## Still to come

Not yet built: flights near Bole (OpenSky; needs an account), a rainfall/CHIRPS overlay, per-partner commodity breakdowns in the relations panel, and the remaining v3 insight features (corridor dependency gauge, rainfall-to-economy link, electricity-exports tracker, official/parallel FX gap, weekly brief). On the detailed map: power lines and substations and building footprints are not in the HOT exports used, so they would need another source; the curated power lines stay schematic.
