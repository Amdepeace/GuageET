# Detailed map data

Static files for the detailed map layers (rivers, roads, rail, towns, facilities,
city streets). They load on demand when a layer is switched on.

## Source and licence

Built from the **Humanitarian OpenStreetMap Team (HOT) country exports** for
Ethiopia, published on the Humanitarian Data Exchange (HDX), which are extracts
of **OpenStreetMap**:

- © OpenStreetMap contributors
- Licence: **Open Database License (ODbL) 1.0** — https://opendatacommons.org/licenses/odbl/1-0/
- Datasets: `hotosm_eth_waterways`, `hotosm_eth_roads`, `hotosm_eth_railways`,
  `hotosm_eth_airports`, `hotosm_eth_populated_places`, `hotosm_eth_health_facilities`,
  `hotosm_eth_education_facilities`, `hotosm_eth_points_of_interest`
  (https://data.humdata.org/organization/hot)

These files are a derived database (filtered, simplified and re-projected to
compact GeoJSON). Under the ODbL they stay under the ODbL: you may copy, adapt
and redistribute them, provided you keep the "© OpenStreetMap contributors"
attribution and share adaptations under the same licence.

OpenStreetMap is mapped by volunteers. Coverage is uneven: an empty area may
simply be unmapped, and positions or details can be out of date. Corrections
are made at https://www.openstreetmap.org.

## Files

See `manifest.json` for feature counts, sizes and the build time.

| File | Contents |
|---|---|
| `rivers.json` | River and canal lines (waterway=river, canal), named where OSM has a name |
| `streams.json` | Streams and small tributaries (waterway=stream) |
| `water.json` | Lakes, reservoirs, wetlands and river areas of 0.1 km² or more |
| `roads-major.json` | Motorway, trunk, primary and secondary roads |
| `roads-tertiary.json` | Tertiary roads |
| `rail.json` | Railway lines and stations |
| `airports.json` | Aerodromes and runways |
| `places.json` | Named cities, towns and villages |
| `facilities.json` | Health, education, banks, fuel, markets, civic, transport, industry |
| `cities/<ID>.json` | Minor streets (residential, unclassified, service) inside 12 city extents (`config/city-extents.json`) |

Properties use short keys: `n` name, `a` Amharic name, `i` OSM id (`way/…`, `node/…`),
`h` road class, `t` type, `k` facility category, `w` woreda, `r` region, `pop` population,
`s` area in km².

## Rebuilding

The data changes slowly, so this is a manual, reproducible step (not part of the
daily workflow). Download the dataset zips from HDX into one folder, one unzipped
subfolder per theme (`waterways/`, `roads/`, `railways/`, `airports/`,
`populated_places/`, `health_facilities/`, `education_facilities/`,
`points_of_interest/`), then:

```bash
pip install shapely pyshp
python3 -I scripts/build-detail-geo.py <input dir>
python3 -I scripts/refine-infra-geometry.py   # real OSM track for the curated rail lines
```
