"""Build the clickable world layer from Natural Earth 110m (public domain).

Usage: python3 scripts/build-world-geo.py <dir with ne_110m.geojson>
Output: data/geo/world.geojson with properties {iso3, un (M49), name, continent}.
Somaliland is merged into Somalia so no contested state is drawn separately here
(the detailed regional layer still shows it as a dashed disputed area).
"""
import json
import sys
from pathlib import Path

from shapely.geometry import mapping, shape
from shapely.ops import unary_union

src = Path(sys.argv[1]) / "ne_110m.geojson"
out = Path(__file__).resolve().parent.parent / "data" / "geo" / "world.geojson"
TOL = 0.25


def rnd(o):
    if isinstance(o, float):
        return round(o, 2)
    if isinstance(o, (list, tuple)):
        return [rnd(x) for x in o]
    if isinstance(o, dict):
        return {k: rnd(v) for k, v in o.items()}
    return o


data = json.loads(src.read_text())
geoms: dict[str, list] = {}
meta: dict[str, dict] = {}
for f in data["features"]:
    p = f["properties"]
    iso3 = p["ADM0_A3"]
    if iso3 in ("SOL",):  # merge Somaliland into Somalia
        iso3 = "SOM"
    geoms.setdefault(iso3, []).append(shape(f["geometry"]))
    if iso3 not in meta or iso3 == p["ADM0_A3"]:
        un = str(p.get("UN_A3") or "").lstrip("0") or None
        meta[iso3] = {"iso3": iso3, "un": un, "name": p.get("NAME_EN") or p.get("NAME"), "continent": p.get("CONTINENT")}

features = []
for iso3, gs in sorted(geoms.items()):
    if iso3 in ("ATA",):  # drop Antarctica
        continue
    g = unary_union(gs).simplify(TOL, preserve_topology=True)
    features.append({"type": "Feature", "properties": meta[iso3], "geometry": rnd(mapping(g))})

out.write_text(json.dumps({"type": "FeatureCollection", "features": features}, separators=(",", ":")))
print(f"world: {len(features)} countries, {out.stat().st_size // 1024} KiB")
