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

### Interbank money-market rates

The **MARKETS · Interbank** box (`scripts/fetch-esx-rates.ts`) charts the weekly overnight and 7-day interbank rates, volumes and trade counts that ESX publishes on its fixed-income data page, and the Risk panel flags a jump. This is the one price-type dataset ESX publishes openly; equity share prices are not published on its public pages, so none are shown.

### Ethiopian Securities Exchange box

The **MARKETS** panel shows whether ESX is open now (computed in your browser from ESX's published sessions and holiday list, `data/curated/esx-calendar.json`, not a live exchange feed) and the listed companies (`scripts/fetch-esx.ts`, read from ESX's public Listed Companies page). ESX's pages publish no prices, so none are shown. The holiday list on ESX's page ends 27 Sep 2026 and some weekday names there are wrong, so only dates are used and the status says when it cannot account for holidays.

### Radio

The **RADIO** panel lists Ethiopian stations from the [Radio Browser](https://www.radio-browser.info/) community directory (`scripts/fetch-radio.ts`, keyless). Only https streams the directory's own health check found working in the last 14 days are kept, with duplicates removed. Nothing is proxied: pressing play connects the listener's browser to the station's stream host, and nothing loads until then. A small fixed player keeps pause, volume and stop on screen while you scroll. A stream can still fail for an individual listener, in which case the row says so. The dashboard is not affiliated with any station.

### Earth-observation layers (satellite imagery, natural events, air quality)

Inspired by the open-source [earth-live](https://github.com/Utsav92/earth-live) project (no licence file, so none of its code is used): these use the same kinds of public, keyless NASA and Copernicus feeds, called directly from your browser. (1) **Satellite imagery (NASA)** map layer: NASA GIBS true-colour (VIIRS NOAA-21) or daytime land surface temperature (MODIS Terra) with a date picker; it defaults to yesterday (UTC), the latest complete day, because same-day tiles are partly empty. (2) **Natural events (NASA EONET)** map layer: wildfires, volcanoes, floods and storms for the Horn of Africa and Red Sea region, only events observed in the last 30 days (EONET leaves events 'open' long after they end), with an explicit empty state because its African coverage is sparse. (3) **AIR panel**: modelled US AQI, PM2.5 and PM10 for the eight dashboard cities from Copernicus CAMS via Open-Meteo, about 45 km grid, an area estimate and not a ground-sensor reading. Earth-live's optional Palantir Foundry airspace and vessel connector needs private credentials and is not used.

### Ports & shipping (map layer)

The **Ports & shipping** layer (`scripts/fetch-ports.ts`) shows eight ports on Ethiopia's trade routes (Djibouti, Berbera, Port Sudan, Mombasa, Lamu, Massawa, Dar es Salaam, Aden) and the Bab el-Mandeb and Suez chokepoints, from IMF PortWatch (open, keyless). Circle size is port calls in the last 30 days and colour is the change against the prior 30 days; click for calls by vessel type, estimated import/export tonnage and a 60-day chart. PortWatch derives these from satellite AIS and publishes several days behind, so this is **near-live, not live**: every popup shows its as-of date. Tonnage is PortWatch's estimate, not customs data. **Live ship positions** need an AIS feed with an API key (for example AISStream's free tier); a key in a static page would be public, so that would have to run as a scheduled snapshot with the key kept as a GitHub secret. It is not built.

### Investment tab

A top-level **Investment** tab (`?tab=invest`) sits beside the Dashboard. It has: an overview (FDI, ESX, interbank rate, pipeline count), 14 sector guides (agriculture, agro-processing, textile, leather, pharmaceuticals, mining, energy, ICT, tourism, health, transport & logistics, telecom, financial services, privatisation), the World Bank pipeline and active projects for Ethiopia (`scripts/fetch-invest-pipeline.ts`, daily, open API), industrial parks, set-up requirements, and the legal framework as links to official documents. Sector content is curated by hand in `data/curated/invest.json` from the Ethiopian Investment Commission's pages; each point is tagged with its source and EIC's own dating, forward-looking figures are marked as targets or projections, and conflicts with this dashboard's data (for example GERD's capacity) are flagged. Each sector links to related dashboard data (map layers, ESX, power exports, risk). It is information only, not advice. **Not covered:** Ethiopian Investments Holding's privatisation list (site did not respond) and e-GP tenders (the portal's TLS certificate failed verification, so it was not accessed). The investment regulations are scanned PDFs, so which areas are open or reserved is linked, not summarised.

### Soil properties (map layer)

The **Soil properties** layer shades each zone by an [iSDAsoil](https://www.isda-africa.com/isdasoil/) topsoil (0–20 cm) average: pH, organic carbon, extractable phosphorus or clay (CC BY 4.0; Hengl et al. 2021, doi:10.1038/s41598-021-85639-y). `scripts/build-soil.py` reads each Africa-wide 30 m map's coarse overview (about 480 m) over Ethiopia by HTTP range requests, undoes iSDA's stored transforms, and writes zone means with the 10th–90th percentile spread to `data/curated/soil.json` (needs `rasterio`; static data, not part of the daily job). These are machine-learning predictions, not field measurements. **Total nitrogen is left out**: iSDA's published back-transformation gives impossible values (about 10,900 g/kg) and the metadata does not explain why. ISRIC SoilGrids was checked as an alternative: its point API is reachable but returned no value at a test point, and its global tiles need reprojection from the Homolosine grid; iSDAsoil is Africa-specific and finer, so it is used instead.

### Minerals & prospects (map layer)

The **Minerals & prospects** layer plots 88 Ethiopian sites from the USGS data release [Compilation of Geospatial Data for the Mineral Industries of Africa](https://doi.org/10.5066/P97EQWXP) (public domain; `scripts/build-minerals.py`): 61 mines, quarries and processing plants (status and capacity as of the 2018 source year), 13 major deposits, and 14 exploration/development sites (USGS World Minerals Exploration Database, with the year each was last verified active). Click a point for commodities, status, operator and source. These are historical records: positions are approximate, projects lapse, and nothing here is a licence, reserve estimate or ownership record. The older USGS MRDS (40 Ethiopian records, mostly a 1994 article) is superseded by this release and not used.

### Risk section

The **RISK** panel has three parts. (1) A **stress matrix**: each Ethiopia indicator's year ranked against its own 2011-to-latest history (inflation, GDP growth, birr depreciation, reserves, external-debt growth, remittances, FDI); it is relative to history, not an absolute threshold, and it is not a probability of crisis. (2) **Projections quoted from the IMF** WEO (`scripts/fetch-projections.ts`), shown as the IMF's own, with dates. (3) A **statistical outlook** for monthly conflict events (`scripts/build-outlook.ts`): damped-trend smoothing, published only if it beats a plain 3-month average in a rolling backtest; the backtest error is always shown. At the last run it did not beat the baseline (skill +2%), so no outlook is published. The backtest uses revised counts, so real-time accuracy would be lower.

### Conflict heatmap (no account needed)

The map's **Conflict heatmap** layer shades each admin-2 zone by ACLED-coded conflict events over the last 12 complete months, from HDX HAPI (keyless; `scripts/fetch-conflict.ts`). Click a zone for events, fatalities, the change against the previous 12 months, and the breakdown by event type. Zones the source has no rows for are drawn grey as *no data*, never as zero. Counts are reported events: places with little reporting are under-counted, recent months are often revised, and event counts say nothing about the scale of each event. UCDP needs an access token and GDELT's event files were unreachable, so neither is used. Boundaries: OCHA COD-AB Ethiopia (CC BY-IGO), simplified by `scripts/build-admin2.py`.

### Rainfall vs normal (map layer)

The map's **Rainfall vs normal** layer (`scripts/fetch-rainfall.ts`) colours each region by its last 90 days of rain as a percent of the 1991–2020 average for the same days (Open-Meteo ERA5, keyless). Brown is drier, teal is wetter; regions in a dry season (normal under 20 mm) are greyed, not rated. One sample point per region, so it is a coarse screen. A regional food-insecurity layer was not built because HAPI's IPC data for Ethiopia stops at 2021.

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
