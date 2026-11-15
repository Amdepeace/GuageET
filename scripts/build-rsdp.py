#!/usr/bin/env python3
"""Derive compact RSDP assets from the World Bank replication package
(https://github.com/worldbank/ethiopia-rsdp-ie, road data originally from the
Ethiopian Roads Authority). Usage: build-rsdp.py <path to RoadNetworkPanelData_1996_2016.geojson>
Writes public/geo-detail/rsdp-roads.json (simplified lines for RSDP-upgraded links)
and data/curated/rsdp.json (km totals by surface type and phase)."""
import json, sys, collections as C
from shapely.geometry import shape, mapping

src = sys.argv[1]
d = json.load(open(src))
F = d["features"]
SURF = {"Asphalt Concrete": "paved", "Cobbled Stone": "cobble", "Gravel": "gravel", "Major Gravel": "gravel", "Earth": "earth", None: None}

def km(p, y):
    # link length for the year the surface was recorded
    return p.get(f"LINKLENGTH_yearshape_{y}") or 0

tot = {y: C.Counter() for y in (1996, 2014)}
phase = C.defaultdict(lambda: {"links": 0, "km": 0.0, "start": None, "paved96": 0.0, "paved14": 0.0})
region = C.defaultdict(lambda: {"km": 0.0, "paved96": 0.0, "paved14": 0.0})
for f in F:
    p = f["properties"]
    for y in (1996, 2014):
        s = SURF.get(p.get(f"SURFACETYP_yearshape_{y}"))
        if s: tot[y][s] += km(p, y)
    r = p.get("REGION") or "Unknown"
    region[r]["km"] += km(p, 2014)
    if SURF.get(p.get("SURFACETYP_yearshape_1996")) == "paved": region[r]["paved96"] += km(p, 1996)
    if SURF.get(p.get("SURFACETYP_yearshape_2014")) == "paved": region[r]["paved14"] += km(p, 2014)
    ph = p.get("rsdp_phase")
    if ph:
        e = phase[int(ph)]
        e["links"] += 1; e["km"] += p["LINKLENGTH"] or 0; e["start"] = int(p["phase_start_year"])
        if SURF.get(p.get("SURFACETYP_yearshape_1996")) == "paved": e["paved96"] += km(p, 1996)
        if SURF.get(p.get("SURFACETYP_yearshape_2014")) == "paved": e["paved14"] += km(p, 2014)

feats = []
for f in F:
    p = f["properties"]
    ph = p.get("rsdp_phase")
    if not ph: continue
    g = shape(f["geometry"]).simplify(0.0012, preserve_topology=False)
    if g.is_empty: continue
    gm = mapping(g)
    gm["coordinates"] = json.loads(json.dumps(gm["coordinates"], default=list))
    def rnd(c):
        return [round(c[0], 4), round(c[1], 4)] if isinstance(c[0], (int, float)) else [rnd(x) for x in c]
    gm["coordinates"] = rnd(gm["coordinates"])
    feats.append({"type": "Feature", "properties": {
        "p": int(ph), "y": int(p["phase_start_year"]), "n": p.get("LINKNAME") or "",
        "s0": SURF.get(p.get("SURFACETYP_yearshape_1996")) or "", "s1": SURF.get(p.get("SURFACETYP_yearshape_2014")) or "",
        "k": round(p["LINKLENGTH"] or 0, 1)}, "geometry": gm})
json.dump({"type": "FeatureCollection", "features": feats}, open("public/geo-detail/rsdp-roads.json", "w"), separators=(",", ":"))

rd = lambda x: round(x)
out = {
    "source": "World Bank replication package: The Impact of Ethiopia's Road Sector Development Program (road network data provided by the Ethiopian Roads Authority)",
    "sourceUrl": "https://github.com/worldbank/ethiopia-rsdp-ie",
    "publicationUrl": "https://documents.worldbank.org/en/publication/documents-reports/documentdetail/099332404062230683/idu073a7158605532046490b712098aed9008539",
    "period": "1996–2016 (surface types recorded for 1996 and 2014)",
    "lastVerified": "2026-11-15",
    "links": len(F),
    "surfaceKm": {str(y): {k: rd(v) for k, v in tot[y].items()} for y in tot},
    "phases": [{"phase": k, "startYear": v["start"], "links": v["links"], "km": rd(v["km"]), "pavedKm1996": rd(v["paved96"]), "pavedKm2014": rd(v["paved14"])} for k, v in sorted(phase.items())],
    "regions": [{"region": k, "km2014": rd(v["km"]), "pavedKm1996": rd(v["paved96"]), "pavedKm2014": rd(v["paved14"])} for k, v in sorted(region.items(), key=lambda kv: -kv[1]["km"])],
}
json.dump(out, open("data/curated/rsdp.json", "w"), indent=2, ensure_ascii=False)
print(len(feats), "features")
print(json.dumps(out["surfaceKm"]), json.dumps(out["phases"]))
