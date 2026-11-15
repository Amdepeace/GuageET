#!/usr/bin/env python3
"""Zone averages of iSDAsoil topsoil properties for Ethiopia's admin-2 zones.
iSDAsoil (Hengl et al. 2021, Scientific Reports 11:6130; CC BY 4.0) gives Africa-wide
predictions at 30 m as cloud-optimised GeoTIFFs. We read each file's coarse overview
over Ethiopia (about 480 m) through HTTP range requests, undo iSDA's storage transforms,
and summarise per zone (mean, 10th and 90th percentile). Band 1 = predicted mean at
0-20 cm. Needs: rasterio, numpy, shapely (not part of the daily job: the data is static).
Usage: build-soil.py <public/geo-detail/admin2.json>  -> data/curated/soil.json"""
import json, sys, time
import numpy as np
import rasterio
from rasterio.features import rasterize
from rasterio.transform import from_bounds
from rasterio.warp import transform_bounds, transform_geom
from rasterio.windows import from_bounds as win_from_bounds
from shapely.geometry import shape, mapping

BASE = "https://isdasoil.s3.amazonaws.com/soil_data"
PROPS = [
    # id, file, label, unit, back-transformation (as stated in the iSDA STAC items)
    ("ph", "ph", "Soil pH", "pH", lambda x: x / 10.0, "x/10"),
    ("carbon_organic", "carbon_organic", "Organic carbon", "g/kg", lambda x: np.expm1(x / 10.0), "expm1(x/10)"),
    # total nitrogen is deliberately left out: iSDA's published back-transformation (expm1(x/10), g/kg) gives ~10,900 g/kg
    # at the median over central Ethiopia, which is impossible, and the metadata does not explain the discrepancy.
    ("phosphorous_extractable", "phosphorous_extractable", "Extractable phosphorus", "ppm", lambda x: np.expm1(x / 10.0), "expm1(x/10)"),
    ("clay_content", "clay_content", "Clay content", "%", lambda x: x.astype("float64"), "none (stored as %)"),
]
LON0, LAT0, LON1, LAT1 = 32.9, 3.3, 48.1, 15.0

zones = json.load(open(sys.argv[1]))["features"]
out_props = []
t0 = time.time()
with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".tif", GDAL_HTTP_MAX_RETRY="4", GDAL_HTTP_TIMEOUT="120"):
    for pid, fname, label, unit, back, btxt in PROPS:
        with rasterio.open(f"{BASE}/{fname}/{fname}.tif") as ds:
            b = transform_bounds("EPSG:4326", ds.crs, LON0, LAT0, LON1, LAT1)
            w = win_from_bounds(*b, transform=ds.transform)
            H, W = int(w.height // 16), int(w.width // 16)  # about the 480 m overview
            raw = ds.read(1, window=w, out_shape=(H, W), masked=True)
            tr = from_bounds(*b, W, H)
            shapes = []
            for i, f in enumerate(zones, start=1):
                g = transform_geom("EPSG:4326", ds.crs, f["geometry"])
                shapes.append((g, i))
            lab = rasterize(shapes, out_shape=(H, W), transform=tr, fill=0, dtype="int32")
            vals = back(np.ma.filled(raw.astype("float64"), np.nan))
            res = {}
            for i, f in enumerate(zones, start=1):
                v = vals[(lab == i) & np.isfinite(vals)]
                if v.size < 20:
                    continue
                res[f["properties"]["id"]] = {"mean": round(float(v.mean()), 2), "p10": round(float(np.percentile(v, 10)), 2), "p90": round(float(np.percentile(v, 90)), 2), "n": int(v.size)}
            allv = vals[(lab > 0) & np.isfinite(vals)]
            out_props.append({"id": pid, "label": label, "unit": unit, "backTransform": btxt, "national": {"mean": round(float(allv.mean()), 2), "p10": round(float(np.percentile(allv, 10)), 2), "p90": round(float(np.percentile(allv, 90)), 2)}, "zones": res})
            print(pid, "zones", len(res), "grid", (H, W), "national mean", round(float(allv.mean()), 2), f"{time.time()-t0:.0f}s")

json.dump({
    "source": "iSDAsoil (Innovative Solutions for Decision Agriculture)",
    "sourceUrl": "https://www.isda-africa.com/isdasoil/",
    "dataUrl": "https://registry.opendata.aws/isdasoil/",
    "citation": "Hengl, T., Miller, M.A.E., Križan, J. et al. African soil properties and nutrients mapped at 30 m spatial resolution using two-scale ensemble machine learning. Sci Rep 11, 6130 (2021). https://doi.org/10.1038/s41598-021-85639-y",
    "license": "CC BY 4.0",
    "depth": "0-20 cm",
    "period": "Predictions from covariates spanning 2001-2017",
    "lastBuilt": time.strftime("%Y-%m-%d"),
    "note": "Machine-learning predictions at 30 m, summarised here from a coarse (about 480 m) overview of each map; they are not field measurements, and local values can differ a lot from the zone average. The 10th to 90th percentile shows how much the pixels within a zone vary.",
    "properties": out_props,
}, open("data/curated/soil.json", "w"), separators=(",", ":"))
