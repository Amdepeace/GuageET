"""Build the bundled map base from Natural Earth (public domain).

One-off; re-run only to change the base map. Usage:
  python3 scripts/build-geo.py <dir containing the Natural Earth geojson files>

Inputs (from github.com/nvkelso/natural-earth-vector/geojson):
  ne_50m_admin_0_countries.geojson
  ne_50m_admin_0_breakaway_disputed_areas.geojson
  ne_50m_lakes.geojson

Boundary policy (PRD risk: "Map boundaries are sensitive"): countries are
drawn with thin neutral lines; every Natural Earth breakaway or disputed area
in the region is drawn as a dashed overlay and labelled as disputed in its
card. Somaliland is merged into Somalia for the base fill and shown only as a
dashed disputed area, so no contested line is drawn as a settled border.
"""
import json
import sys
from pathlib import Path

from shapely.geometry import box, mapping, shape
from shapely.ops import unary_union

src = Path(sys.argv[1])
out = Path(__file__).resolve().parent.parent / "data" / "geo"
out.mkdir(parents=True, exist_ok=True)
REGION = box(20, -12, 60, 34)
TOL = 0.015


def rnd(obj):
    if isinstance(obj, float):
        return round(obj, 3)
    if isinstance(obj, (list, tuple)):
        return [rnd(x) for x in obj]
    if isinstance(obj, dict):
        return {k: rnd(v) for k, v in obj.items()}
    return obj


def feat(geom, props):
    return {"type": "Feature", "properties": props, "geometry": rnd(mapping(geom.simplify(TOL, preserve_topology=True)))}


countries = json.loads((src / "ne_50m_admin_0_countries.geojson").read_text())
geoms = {}
names = {}
for f in countries["features"]:
    p = f["properties"]
    g = shape(f["geometry"])
    if not g.intersects(REGION):
        continue
    code = p["ADM0_A3"]
    if code == "SOL":
        code = "SOM"
    geoms.setdefault(code, []).append(g)
    if code == p["ADM0_A3"]:
        names[code] = p["NAME_EN"] or p["NAME"]

base = [
    feat(unary_union(gs), {"iso3": c, "name": names.get(c, c), "focus": c == "ETH"})
    for c, gs in sorted(geoms.items())
]
(out / "countries.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": base}, separators=(",", ":")))

disputed = json.loads((src / "ne_50m_admin_0_breakaway_disputed_areas.geojson").read_text())
dfeats = []
for f in disputed["features"]:
    g = shape(f["geometry"])
    if not g.intersects(REGION):
        continue
    p = f["properties"]
    dfeats.append(feat(g, {"name": p.get("NAME_EN") or p.get("NAME"), "note": p.get("NOTE_BRK") or "Disputed area"}))
(out / "disputed.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": dfeats}, separators=(",", ":")))

lakes = json.loads((src / "ne_50m_lakes.geojson").read_text())
lfeats = [
    feat(shape(f["geometry"]), {"name": f["properties"].get("name")})
    for f in lakes["features"]
    if shape(f["geometry"]).intersects(REGION)
]
(out / "lakes.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": lfeats}, separators=(",", ":")))

print(f"countries={len(base)} disputed={len(dfeats)} lakes={len(lfeats)}")
for d in dfeats:
    print("  disputed:", d["properties"]["name"], "-", d["properties"]["note"])
