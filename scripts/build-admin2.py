#!/usr/bin/env python3
"""Simplify OCHA COD-AB Ethiopia admin-2 (zone) boundaries for the risk layers.
Usage: build-admin2.py <eth_admin2.geojson> <eth_admin1.geojson>
Source: OCHA / Ethiopia Subnational Administrative Boundaries (CC BY-IGO),
https://data.humdata.org/dataset/cod-ab-eth . Writes public/geo-detail/admin2.json
and admin1.json (properties: id, n = name, r = parent region)."""
import json, sys
from shapely.geometry import shape, mapping

def rnd(c):
    return [round(c[0], 3), round(c[1], 3)] if isinstance(c[0], (int, float)) else [rnd(x) for x in c]

def run(src, level, tol):
    d = json.load(open(src))
    out = []
    for f in d["features"]:
        p = f["properties"]
        g = shape(f["geometry"]).simplify(tol, preserve_topology=True)
        gm = mapping(g)
        gm = {"type": gm["type"], "coordinates": rnd(json.loads(json.dumps(gm["coordinates"], default=list)))}
        props = {"id": p[f"adm{level}_pcode"], "n": p[f"adm{level}_name"]}
        if level == 2: props["r"] = p["adm1_name"]
        out.append({"type": "Feature", "properties": props, "geometry": gm})
    json.dump({"type": "FeatureCollection", "features": out}, open(f"public/geo-detail/admin{level}.json", "w"), separators=(",", ":"))
    print(level, len(out))

run(sys.argv[1], 2, 0.004)
run(sys.argv[2], 1, 0.006)
