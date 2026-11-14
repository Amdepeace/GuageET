"""Build the detailed map layers (rivers, roads, rail, facilities, city streets).

Source: Humanitarian OpenStreetMap Team (HOT) country exports published on the
Humanitarian Data Exchange (HDX), datasets hotosm_eth_*. OpenStreetMap data,
(c) OpenStreetMap contributors, ODbL 1.0. See public/geo-detail/README.md.

This is a one-off, reproducible build (the data changes slowly); it is not part
of the daily workflow. Usage:

  python3 -I scripts/build-detail-geo.py <input dir> [<output dir>] [--skip-roads]

<input dir> holds one unzipped folder per HOT dataset, named after the dataset
theme: waterways/, railways/, airports/, populated_places/, health_facilities/,
education_facilities/, points_of_interest/ (each with <name>.geojson) and
roads/ (roads_lines.shp). Download the zips from the dataset pages listed in
README.md, e.g. https://data.humdata.org/dataset/hotosm_eth_waterways

Output files are compact GeoJSON, simplified and rounded, loaded lazily by the
map. Properties use short keys: n name, a Amharic name, i OSM id, h road class,
t type, k category, w woreda, r region.
"""
import json
import math
import re
import sys
import time
from pathlib import Path

from shapely.geometry import box, mapping, shape
from shapely.ops import unary_union  # noqa: F401  (kept for ad-hoc analysis)

args = [a for a in sys.argv[1:] if not a.startswith("--")]
SKIP_ROADS = "--skip-roads" in sys.argv
SRC = Path(args[0])
ROOT = Path(__file__).resolve().parent.parent
OUT = Path(args[1]) if len(args) > 1 else ROOT / "public" / "geo-detail"
OUT.mkdir(parents=True, exist_ok=True)
(OUT / "cities").mkdir(exist_ok=True)

CITIES = json.loads((ROOT / "config" / "city-extents.json").read_text())["cities"]
manifest: dict[str, dict] = {}
T0 = time.time()


def log(msg: str):
    print(f"[{time.time() - T0:6.0f}s] {msg}", flush=True)


# ---- helpers ---------------------------------------------------------------
ETHIOPIC = re.compile(r"[ሀ-፿]")
LATIN = re.compile(r"[A-Za-z]")


def rc(o, nd):
    """Round all coordinates in a GeoJSON coordinate structure."""
    if isinstance(o, (list, tuple)):
        if o and isinstance(o[0], (int, float)):
            return [round(o[0], nd), round(o[1], nd)]
        return [rc(x, nd) for x in o]
    return o


def name_of(p):
    for k in ("name_en", "name_latin", "name"):
        v = (p.get(k) or "").strip()
        if v:
            # "ኦሞ / Omo": prefer the Latin part
            if "/" in v:
                parts = [x.strip() for x in v.split("/")]
                lat = [x for x in parts if LATIN.search(x)]
                if lat:
                    return lat[-1]
            return v
    return ""


def am_of(p):
    v = (p.get("name_am") or "").strip()
    if v:
        return v
    n = (p.get("name") or "").strip()
    return n if ETHIOPIC.search(n) and not LATIN.search(n) else ""


def props(p, **extra):
    out = {}
    n = name_of(p)
    if n:
        out["n"] = n
    a = am_of(p)
    if a and a != n:
        out["a"] = a
    if p.get("id") is not None:
        out["i"] = p["id"]
    out.update({k: v for k, v in extra.items() if v not in (None, "")})
    return out


def admin(p):
    out = {}
    if p.get("adm3_name"):
        out["w"] = p["adm3_name"]
    if p.get("adm1_name"):
        out["r"] = p["adm1_name"]
    return out


def write(name, features, desc, nd, extra=None):
    path = OUT / name
    path.parent.mkdir(parents=True, exist_ok=True)
    fc = {"type": "FeatureCollection", "features": features}
    path.write_text(json.dumps(fc, separators=(",", ":"), ensure_ascii=False))
    size = path.stat().st_size
    manifest[name] = {"features": len(features), "bytes": size, "description": desc, "coordinatePrecision": nd, **(extra or {})}
    log(f"wrote {name}: {len(features):,} features, {size / 1e6:.2f} MB")


def line_feature(geom, p, tol, nd, **extra):
    g = shape(geom)
    if g.is_empty:
        return None
    g = g.simplify(tol, preserve_topology=False)
    if g.is_empty or g.length < tol:
        return None
    return {"type": "Feature", "properties": props(p, **extra), "geometry": {"type": g.geom_type, "coordinates": rc(mapping(g)["coordinates"], nd)}}


def point_of(geom):
    g = shape(geom)
    if g.geom_type == "Point":
        return g
    return g.representative_point()


def load(theme):
    return json.loads((SRC / theme / f"{theme}.geojson").read_text())["features"]


def km2(g):
    return g.area * 111.0 * 111.0 * math.cos(math.radians(9))


def length_km(g):
    return g.length * 111.0


# ---- rivers, streams, water -------------------------------------------------
def build_water():
    fs = load("waterways")
    rivers, streams, water = [], [], []
    for f in fs:
        p = f["properties"]
        gt = f["geometry"]["type"]
        ww = p.get("waterway")
        if gt == "LineString" and ww in ("river", "canal"):
            ft = line_feature(f["geometry"], p, 0.0004, 4, t="canal" if ww == "canal" else None)
            if ft:
                rivers.append(ft)
        elif gt == "LineString" and ww == "stream":
            ft = line_feature(f["geometry"], p, 0.0005, 4)
            if ft:
                streams.append(ft)
        elif gt == "Polygon" and not ww and p.get("natural_class") in ("water", "wetland"):
            g = shape(f["geometry"])
            a = km2(g)
            if a < 0.1:
                continue
            tol = 0.0002 if a < 10 else 0.0006 if a < 200 else 0.001
            gs = g.simplify(tol, preserve_topology=True)
            if gs.is_empty:
                continue
            t = "wetland" if p.get("natural_class") == "wetland" else (p.get("water") or "water")
            water.append({"type": "Feature", "properties": props(p, t=t, s=round(a, 2)), "geometry": {"type": gs.geom_type, "coordinates": rc(mapping(gs)["coordinates"], 4)}})
    write("rivers.json", rivers, "River and canal lines (OSM waterway=river|canal)", 4)
    write("streams.json", streams, "Streams and small tributaries (OSM waterway=stream)", 4)
    write("water.json", water, "Lakes, reservoirs, wetlands and river areas of 0.1 km2 or more", 4)


# ---- rail, airports, places --------------------------------------------------
def build_rail():
    out = []
    for f in load("railways"):
        p, gt = f["properties"], f["geometry"]["type"]
        if gt == "LineString" and p.get("railway") == "rail":
            ft = line_feature(f["geometry"], p, 0.0001, 4)
            if ft:
                out.append(ft)
        elif p.get("railway") == "station":
            pt = point_of(f["geometry"])
            out.append({"type": "Feature", "properties": props(p, t="station", **admin(p)), "geometry": {"type": "Point", "coordinates": [round(pt.x, 5), round(pt.y, 5)]}})
    write("rail.json", out, "Railway lines and stations", 4)


def build_airports():
    out = []
    for f in load("airports"):
        p, gt = f["properties"], f["geometry"]["type"]
        a = p.get("aeroway")
        if a == "aerodrome":
            pt = point_of(f["geometry"])
            out.append({"type": "Feature", "properties": props(p, t="aerodrome", **admin(p)), "geometry": {"type": "Point", "coordinates": [round(pt.x, 5), round(pt.y, 5)]}})
        elif a == "runway" and gt == "LineString":
            ft = line_feature(f["geometry"], p, 0.00005, 5, t="runway")
            if ft:
                out.append(ft)
    write("airports.json", out, "Aerodromes and runways", 5)


def build_places():
    out = []
    for f in load("populated_places"):
        p = f["properties"]
        pl = p.get("place")
        if f["geometry"]["type"] != "Point" or pl not in ("city", "town", "village"):
            continue
        if not name_of(p) and not am_of(p):
            continue
        pt = shape(f["geometry"])
        pop = p.get("population")
        try:
            pop = int(str(pop).replace(",", "")) if pop else None
        except ValueError:
            pop = None
        out.append({"type": "Feature", "properties": props(p, t=pl, pop=pop, **admin(p)), "geometry": {"type": "Point", "coordinates": [round(pt.x, 4), round(pt.y, 4)]}})
    write("places.json", out, "Named cities, towns and villages", 4)


# ---- facilities ---------------------------------------------------------------
HEALTH_T = {"hospital", "clinic", "pharmacy", "dentist", "doctors"}
EDU_T = {"school", "college", "university", "kindergarten", "library"}
CIVIC_T = {"police", "fire_station", "townhall", "courthouse", "post_office"}
TRANSPORT_T = {"bus_station", "ferry_terminal"}
INDUSTRY_T = {"works", "storage_tank", "silo", "water_tower", "water_works", "wastewater_plant"}


def build_facilities():
    out, seen = [], set()

    def add(f, k, t):
        p = f["properties"]
        key = (p.get("id"), k)
        if key in seen:
            return
        seen.add(key)
        pt = point_of(f["geometry"])
        out.append({"type": "Feature", "properties": props(p, k=k, t=t, **admin(p)), "geometry": {"type": "Point", "coordinates": [round(pt.x, 5), round(pt.y, 5)]}})

    for f in load("health_facilities"):
        t = (f["properties"].get("amenity") or "").split(";")[0] or f["properties"].get("healthcare") or "facility"
        add(f, "health", t)
    for f in load("education_facilities"):
        t = f["properties"].get("amenity") or "school"
        if t in EDU_T:
            add(f, "education", t)
    for f in load("points_of_interest"):
        p = f["properties"]
        am, mm = p.get("amenity"), p.get("man_made")
        if am in ("bank", "bureau_de_change"):
            add(f, "finance", am)
        elif am == "fuel":
            add(f, "fuel", "fuel")
        elif am == "marketplace":
            add(f, "market", "marketplace")
        elif am in CIVIC_T:
            add(f, "civic", am)
        elif am in TRANSPORT_T:
            add(f, "transport", am)
        elif mm in INDUSTRY_T:
            add(f, "industry", mm)
    # aerodromes and rail stations count as transport facilities too
    for f in load("airports"):
        if f["properties"].get("aeroway") == "aerodrome":
            add(f, "transport", "aerodrome")
    for f in load("railways"):
        if f["properties"].get("railway") == "station":
            add(f, "transport", "station")
    cats = {}
    for ft in out:
        cats[ft["properties"]["k"]] = cats.get(ft["properties"]["k"], 0) + 1
    log(f"facility categories: {cats}")
    write("facilities.json", out, "Health, education, finance, fuel, market, civic, transport and industry facilities", 5, {"categories": cats})


# ---- roads ----------------------------------------------------------------------
MAJOR = {"motorway", "trunk", "primary", "secondary", "motorway_link", "trunk_link", "primary_link", "secondary_link"}
TERTIARY = {"tertiary", "tertiary_link"}
MINOR = {"residential", "unclassified", "service", "living_street", "road"}


def build_roads():
    import shapefile  # pyshp

    boxes = [(c["id"], box(*c["bbox"])) for c in CITIES]
    sf = shapefile.Reader(str(SRC / "roads" / "roads_lines"), encoding="utf-8", encodingErrors="replace")
    major, tert = [], []
    city = {c["id"]: [] for c in CITIES}
    seen = 0
    for sr in sf.iterShapeRecords(fields=["id", "name", "name_en", "name_am", "name_latin", "highway"]):
        seen += 1
        if seen % 100000 == 0:
            log(f"  roads scanned: {seen:,}")
        rec = sr.record.as_dict()
        h = rec.get("highway")
        if h in MAJOR:
            ft = line_feature(sr.shape.__geo_interface__, rec, 0.0001, 4, h=h.replace("_link", ""))
            if ft:
                major.append(ft)
        elif h in TERTIARY:
            ft = line_feature(sr.shape.__geo_interface__, rec, 0.00015, 4, h="tertiary")
            if ft:
                tert.append(ft)
        elif h in MINOR:
            bb = sr.shape.bbox
            gb = box(*bb)
            for cid, cb in boxes:
                if cb.intersects(gb):
                    ft = line_feature(sr.shape.__geo_interface__, rec, 0.00004, 5, h=h)
                    if ft:
                        city[cid].append(ft)
                    break
    write("roads-major.json", major, "Motorway, trunk, primary and secondary roads", 4)
    write("roads-tertiary.json", tert, "Tertiary roads", 4)
    for cid, feats in city.items():
        write(f"cities/{cid}.json", feats, f"Minor streets (residential, unclassified, service) inside the {cid} extent", 5, {"city": cid})


# ---- run ---------------------------------------------------------------------------
build_water()
build_rail()
build_airports()
build_places()
build_facilities()
if not SKIP_ROADS:
    build_roads()

(OUT / "manifest.json").write_text(
    json.dumps(
        {
            "builtAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "source": "Humanitarian OpenStreetMap Team (HOT) exports on HDX (hotosm_eth_*), derived from OpenStreetMap",
            "sourceUrl": "https://data.humdata.org/organization/hot",
            "license": "Open Database License (ODbL) 1.0",
            "attribution": "© OpenStreetMap contributors",
            "files": manifest,
        },
        indent=1,
        ensure_ascii=False,
    )
)
log("done")
