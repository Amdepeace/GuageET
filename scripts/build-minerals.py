#!/usr/bin/env python3
"""Ethiopian mineral sites from the USGS data release 'Compilation of Geospatial
Data (GIS) for the Mineral Industries and Related Infrastructure of Africa'
(Neustaedter et al., DOI 10.5066/P97EQWXP; US Geological Survey, public domain).
Usage: build-minerals.py <path to Africa_GIS.gdb>
Writes public/geo-detail/minerals.json (point features). Three layers are used:
  facility    AFR_Mineral_Facilities   mines, quarries and processing plants
  deposit     AFR_Mineral_Deposits     major deposits (USGS OFR 2005-1294, PP 1802)
  exploration AFR_Mineral_Exploration  exploration and development sites (USGS WMED)
Only fields present in the source are kept; nothing is inferred."""
import json, sys, warnings
import pyogrio
warnings.filterwarnings("ignore")
gdb = sys.argv[1]

def s(v):
    if v is None: return ""
    t = str(v).strip()
    return "" if t.lower() in ("nan", "none", "<null>", "nat") else t

def eth(layer):
    df = pyogrio.read_dataframe(gdb, layer=layer)
    return df[df["Country"].astype(str).str.contains("Ethiop", case=False, na=False)]

feats = []
def add(kind, row, name, commodities, status, operator, year, detail, source, conf, loc):
    lat, lon = float(row["Latitude"]), float(row["Longitude"])
    feats.append({"type": "Feature", "geometry": {"type": "Point", "coordinates": [round(lon, 5), round(lat, 5)]},
        "properties": {"id": s(row["FeatureUID"]), "k": kind, "n": name, "c": [c for c in commodities if c], "st": status, "op": operator, "yr": year, "d": detail, "src": source, "lc": conf, "loc": loc, "adm1": s(row.get("ADM1"))}})

NOTE = {"c": "capacity combines more than one facility", "e": "capacity estimated", "g": "capacity in gross weight"}
for _, r in eth("AFR_Mineral_Facilities").iterrows():
    cm = [s(r["DsgAttr02"])]
    prod = s(r["DsgAttr03"])
    detail = s(r["FeatureTyp"]) + (f"; product: {prod}" if prod else "")
    try:
        cap = float(r["DsgAttr07"])
    except (TypeError, ValueError):
        cap = -999
    if cap != -999 and cap == cap:
        note = NOTE.get(s(r["DsgAttr09"]).lower(), "")
        detail += f"; annual capacity {cap:g} {s(r['DsgAttr08']).lower()} ({s(r['DsgAttr06'])} source{', ' + note if note else ''})"
    add("facility", r, s(r["FeatureNam"]), cm, s(r["LocOpStat"]), s(r["OperateNam"]), s(r["DsgAttr06"]), detail, s(r["InfSource1"])[:320], s(r["LocConfid"]), s(r["MemoLoc"]))

for _, r in eth("AFR_Mineral_Deposits").iterrows():
    cm = [s(r[f"DsgAttr0{i}"]) for i in range(1, 7)]
    add("deposit", r, s(r["FeatureNam"]), cm, "", "", "", s(r["DsgAttr09"]), s(r["InfSource1"])[:320], "", "")

for _, r in eth("AFR_Mineral_Exploration").iterrows():
    cm = [s(r[f"DsgAttr0{i}"]) for i in range(1, 9)]
    add("exploration", r, s(r["FeatureNam"]), cm, s(r["LocOpStat"]), s(r["OwnerName"]), s(r["DsgAttr11"]), "", s(r["InfSource1"])[:320], "", s(r["MemoLoc"]))

# one point per site: a facility with several commodities appears once per commodity in the source
merged = {}
for f in feats:
    key = (f["properties"]["id"], f["properties"]["k"], tuple(f["geometry"]["coordinates"]))
    if key not in merged:
        merged[key] = f
        continue
    m = merged[key]["properties"]
    m["c"] = m["c"] + [c for c in f["properties"]["c"] if c not in m["c"]]
    if f["properties"]["d"] and f["properties"]["d"] not in m["d"]:
        m["d"] = (m["d"] + " | " + f["properties"]["d"]) if m["d"] else f["properties"]["d"]
feats = list(merged.values())
json.dump({"type": "FeatureCollection", "features": feats}, open("public/geo-detail/minerals.json", "w"), separators=(",", ":"), ensure_ascii=False)
import collections as C
print(len(feats), C.Counter(f["properties"]["k"] for f in feats))
print(C.Counter(c for f in feats for c in f["properties"]["c"]).most_common(25))
print(C.Counter(f["properties"]["st"] for f in feats if f["properties"]["k"] != "deposit"))
