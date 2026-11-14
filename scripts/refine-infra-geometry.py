"""Replace schematic curated rail lines with real OpenStreetMap track geometry.

Run after scripts/build-detail-geo.py (it reads public/geo-detail/rail.json):

  python3 -I scripts/refine-infra-geometry.py

For each curated record listed in REFINE the geometry becomes the merged OSM
railway segments whose name matches, and `schematic` is set to false. Every
other line keeps its hand-drawn path and gets `schematic: true`, which the map
uses to fade those lines out when zoomed to city scale (where a schematic
path would visibly cut across real streets).
"""
import json
from pathlib import Path

from shapely.geometry import mapping, shape
from shapely.ops import linemerge

ROOT = Path(__file__).resolve().parent.parent
RAIL = json.loads((ROOT / "public" / "geo-detail" / "rail.json").read_text())["features"]
CURATED = ROOT / "data" / "curated" / "infrastructure.geojson"


def addis_djibouti(n: str) -> bool:
    n = n.lower()
    return ("addis" in n and "djibouti" in n) or n.startswith("chemin de fer addis")


def awash_weldiya(n: str) -> bool:
    n = n.lower()
    return "awash" in n and ("weldiya" in n or "woldia" in n)


REFINE = {
    "add-dji-rail": addis_djibouti,
    "awash-weldiya-rail": awash_weldiya,
}


def rnd(o, nd=4):
    if isinstance(o, (list, tuple)):
        return [round(o[0], nd), round(o[1], nd)] if o and isinstance(o[0], (int, float)) else [rnd(x, nd) for x in o]
    return o


def merged(pred):
    lines = [shape(f["geometry"]) for f in RAIL if f["geometry"]["type"] == "LineString" and pred(f["properties"].get("n") or "")]
    if not lines:
        raise SystemExit("no matching OSM rail segments")
    m = linemerge(lines)
    return m, len(lines)


data = json.loads(CURATED.read_text())
for f in data["features"]:
    p = f["properties"]
    pred = REFINE.get(p["id"])
    if pred:
        geom, n = merged(pred)
        km = geom.length * 111
        f["geometry"] = {"type": geom.geom_type, "coordinates": rnd(mapping(geom)["coordinates"])}
        p["schematic"] = False
        p["geometryNote"] = f"Track geometry from OpenStreetMap ({n} mapped segments, about {km:.0f} km, simplified). Status comes from the cited sources, not from the map."
        print(f"{p['id']}: {n} segments -> {geom.geom_type}, ~{km:.0f} km")
    elif f["geometry"]["type"] != "Point":
        p["schematic"] = True

CURATED.write_text(json.dumps(data, indent=1, ensure_ascii=False))
