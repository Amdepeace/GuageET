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
| **v2** Headlines | GDELT 2.0 Doc API plus RSS from Capital Ethiopia, The Reporter and Addis Fortune, plus headline links (title and link only, no article text) read from the Ethiopian News Agency's public homepage | Open, no key; GDELT rate-limits, so RSS is the fallback | Daily job |
| **v2** Trade partners and balance | UN Comtrade | Free tier, **needs a key** (see below) | Daily job |
| Remittances received, FDI net inflows | World Bank | Open, no key | Daily job |
| External-debt composition, ratios, IMF programme | World Bank IDS + curated IMF timeline | Open, no key (timeline curated) | Daily job |
| People in need, food insecurity (IPC), staple food prices | HDX (HAPI) | Free, no key (generic usage tag) | Daily job |

### v2 features

Pulse row (daily FX + commodity tiles), a live **earthquakes** map layer (toggle "Quakes"), the **Red Sea risk monitor**, a **headlines** feed, an in-page **alerts banner** (FX moves, Red Sea drops, big quakes), **event markers** on the vital charts (birr float, GERD milestones), an **Ethiopian-calendar** axis toggle (E.C./G.C.) on those charts, and a **Trade panel**.

### Interactive explorer, command palette and section nav

Three open-source libraries improve the UI: **[Apache ECharts](https://github.com/apache/echarts)** (Apache-2.0) powers the **EXPLORER** panel, where you pick an indicator and countries and view Values, Indexed (rebased to 100; disabled for rates and ratios) or Scatter (one indicator against another) with zoom, pan, legend toggles and save-as-image. ECharts is loaded on demand. **[cmdk](https://github.com/pacocoursey/cmdk)** (MIT) adds a **⌘K / Ctrl+K** palette to jump to any vital, infrastructure record or section. A sticky section bar highlights where you are. The Explorer uses only the sourced World Bank series already in `data/series`.

### Climate vs normal

The **CLIMATE** panel (`scripts/fetch-climate.ts`) compares each city's last 12 complete months of rainfall and temperature with its 1991–2020 normal, from the Open-Meteo Historical Weather API (ERA5 reanalysis, free, no key). It is reanalysis on a ~10 km grid, not station data. The idea comes from [pooja97/ethio_hydro](https://github.com/pooja97/ethio_hydro); none of its code or data is used.

### RSDP road programme (World Bank study data)

The **ROADS · RSDP** panel and the map's **RSDP road upgrades** layer come from the replication package [worldbank/ethiopia-rsdp-ie](https://github.com/worldbank/ethiopia-rsdp-ie) (road network from the Ethiopian Roads Authority, 1996–2016). `scripts/build-rsdp.py` derives a simplified line layer (`public/geo-detail/rsdp-roads.json`, links assigned to RSDP phases I–IV) and summary totals (`data/curated/rsdp.json`). It is historical, not current road status. The repository states no data licence, so only simplified geometry and totals are shipped, with attribution; remove them if the owners object.

### Electricity exports (curated)

The **POWER** panel (`data/curated/power-exports.json`) lists Ethiopia's electricity export earnings by partner (Kenya, Djibouti, Sudan, Tanzania) for FY2024/25, with capacity notes, source links and a verified flag. Each row links to its interconnector record in the infrastructure tracker. Figures come from news reports of EEP data; conflicts are flagged, not resolved, and values are USD earnings, not MWh.

### Trade panel (no key needed)

Trade data comes from UN Comtrade's public **preview** endpoint, which needs no account or key (responses cap at 500 rows, enough for annual totals by partner and HS-2 groups). Optionally, for the full data API, register a free key at [comtradeplus.un.org](https://comtradeplus.un.org/) and add it as a repo secret named `COMTRADE_PRIMARY_KEY` (**Settings → Secrets and variables → Actions**); the fetcher uses it automatically.

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

### Visual layers (deck.gl)

Two optional layers use [deck.gl](https://github.com/visgl/deck.gl) (MIT) as an overlay on the map. deck.gl is loaded only when one of them is switched on, so it adds about 1 kB to the first page load.

- **Trade corridors & flows:** curated arcs from Addis Ababa to the Djibouti, Berbera and Lamu corridors, using the status and sources already recorded in the infrastructure tracker (`data/curated/corridors.json`; arcs show the route, not trade volume). Once the UN Comtrade key is set, arcs also appear for Ethiopia's top 15 trade partners: width = trade value, cyan exports, violet imports. They fade out as you zoom in, because they belong to a world view. Click an arc for its card (a partner arc opens that country's relations panel).
- **Facility density:** hexagons of the mapped facilities, coloured by rank so rural districts stay visible next to Addis Ababa. It respects the facility category chips. It shows where facilities are *mapped*, which depends on volunteer effort, so it is not a measure of need.

Licence and rebuild steps for the data are in [`public/geo-detail/README.md`](public/geo-detail/README.md). OpenStreetMap is volunteer-mapped: an empty area may simply be unmapped.

## World relations

Zoom the map out and click any country to open its **relations with Ethiopia**:

- **Key indicators** — that country's GDP, population and growth beside Ethiopia's (World Bank, all countries via `data/world-indicators.json`).
- **Shared organizations & blocs** — which of AU, IGAD, COMESA, EAC, BRICS+, Arab League, EU, Nile Basin, OPEC, Commonwealth and G20 it shares with Ethiopia, plus the ones only one of them is in (curated membership in `config/blocs.json`, computed overlap).
- **Bilateral trade** — Ethiopia's exports to / imports from that country (UN Comtrade, keyed by M49).
- **Curated relations profile** — current relations, history and economic ties for ~14 key partners (China, US, Eritrea, Egypt, Sudan, Djibouti, Kenya, Somalia, Saudi, UAE, Türkiye, Russia, India, Italy), each sourced in `data/curated/relations.json`. Other countries show the structured sourced data only, never invented prose.

The world layer is bundled Natural Earth 110m (`data/geo/world.geojson`); the detailed regional base stays as-is.

### Humanitarian panel (no key needed)

The HUMANITARIAN panel uses HDX HAPI. Its "app identifier" is only a usage tag (base64 of `appname:email`), not a registered key, so the fetcher uses a generic built-in one. Optionally set your own as the repo secret `HDX_APP_IDENTIFIER`.

Each humanitarian figure keeps its own reference period and original provider (IPC, WFP, OCHA) — some series (e.g. national IPC) update infrequently, so they are clearly dated rather than shown as current.

## Still to come

Not yet built: flights near Bole (OpenSky; needs an account), a rainfall/CHIRPS overlay, per-partner commodity breakdowns in the relations panel, and the remaining v3 insight features (corridor dependency gauge, rainfall-to-economy link, electricity-exports tracker, official/parallel FX gap, weekly brief). On the detailed map: power lines and substations and building footprints are not in the HOT exports used, so they would need another source; the curated power lines stay schematic.
