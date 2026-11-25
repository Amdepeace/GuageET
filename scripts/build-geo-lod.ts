// Builds small "overview" (level-of-detail) copies of the heavy OSM layers so the map
// can draw the national picture from a few tens of KB and fetch the full-detail
// file only when the viewer zooms in. Run after refreshing public/geo-detail/*.json:
//   npx tsx scripts/build-geo-lod.ts
// LOD files drop the OSM id ("i") and keep 3 decimals (~110 m), which is under a
// pixel below zoom ~6.5, where the full files take over.
import { readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";

const DIR = join(process.cwd(), "public", "geo-detail");
type Pt = [number, number];
type Feature = { type: "Feature"; properties: Record<string, unknown>; geometry: { type: string; coordinates: unknown } };
type FC = { type: "FeatureCollection"; features: Feature[] };

function simplify(pts: Pt[], tol: number): Pt[] {
  if (pts.length < 3) return pts;
  const keep = new Array<boolean>(pts.length).fill(false);
  keep[0] = keep[pts.length - 1] = true;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [ax, ay] = pts[a];
    const dx = pts[b][0] - ax;
    const dy = pts[b][1] - ay;
    const len2 = dx * dx + dy * dy;
    let md = -1;
    let mi = -1;
    for (let i = a + 1; i < b; i++) {
      const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((pts[i][0] - ax) * dx + (pts[i][1] - ay) * dy) / len2));
      const d = (pts[i][0] - ax - t * dx) ** 2 + (pts[i][1] - ay - t * dy) ** 2;
      if (d > md) {
        md = d;
        mi = i;
      }
    }
    if (md > tol * tol) {
      keep[mi] = true;
      stack.push([a, mi], [mi, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}
const r3 = (p: Pt): Pt => [Math.round(p[0] * 1000) / 1000, Math.round(p[1] * 1000) / 1000];
const lines = (g: Feature["geometry"]): Pt[][] => (g.type === "LineString" ? [g.coordinates as Pt[]] : (g.coordinates as Pt[][]));
const length = (ls: Pt[][]) => ls.reduce((s, l) => s + l.slice(1).reduce((a, p, i) => a + Math.hypot(p[0] - l[i][0], p[1] - l[i][1]), 0), 0);

function lineLod(file: string, out: string, tol: number, keep: (p: Record<string, unknown>, len: number) => boolean) {
  const fc = JSON.parse(readFileSync(join(DIR, file), "utf8")) as FC;
  const features: Feature[] = [];
  for (const f of fc.features) {
    if (!["LineString", "MultiLineString"].includes(f.geometry.type)) {
      // keep points (stations) as they are
      if (f.geometry.type === "Point") features.push({ ...f, properties: strip(f.properties) });
      continue;
    }
    const ls = lines(f.geometry);
    if (!keep(f.properties, length(ls))) continue;
    const s = ls.map((l) => simplify(l, tol).map(r3)).filter((l) => l.length >= 2);
    if (!s.length) continue;
    features.push({ type: "Feature", properties: strip(f.properties), geometry: s.length === 1 ? { type: "LineString", coordinates: s[0] } : { type: "MultiLineString", coordinates: s } });
  }
  write(out, features, fc.features.length);
}

function areaLod(file: string, out: string, tol: number, minBox: number) {
  const fc = JSON.parse(readFileSync(join(DIR, file), "utf8")) as FC;
  const features: Feature[] = [];
  const ring = (r: Pt[]) => {
    const s = simplify(r, tol).map(r3);
    return s.length >= 4 ? s : null;
  };
  for (const f of fc.features) {
    const polys = (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.type === "MultiPolygon" ? f.geometry.coordinates : []) as Pt[][][];
    const outer = polys.flatMap((p) => p[0] ?? []);
    if (!outer.length) continue;
    const xs = outer.map((p) => p[0]);
    const ys = outer.map((p) => p[1]);
    if ((Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys)) < minBox) continue;
    const np = polys.map((p) => p.map(ring).filter((r): r is Pt[] => !!r)).filter((p) => p.length);
    if (!np.length) continue;
    features.push({ type: "Feature", properties: strip(f.properties), geometry: np.length === 1 ? { type: "Polygon", coordinates: np[0] } : { type: "MultiPolygon", coordinates: np } });
  }
  write(out, features, fc.features.length);
}

const strip = (p: Record<string, unknown>) => {
  const { i: _i, ...rest } = p;
  void _i;
  return rest;
};

function write(out: string, features: Feature[], from: number) {
  const text = JSON.stringify({ type: "FeatureCollection", features });
  writeFileSync(join(DIR, out), text);
  console.log(`${out}: ${features.length}/${from} features, ${(text.length / 1024).toFixed(0)} KB raw, ${(gzipSync(text).length / 1024).toFixed(0)} KB gzipped`);
}

lineLod("rivers.json", "rivers-lod.json", 0.005, (p, len) => !!p.n || len > 0.25);
lineLod("roads-major.json", "roads-major-lod.json", 0.006, (p) => p.h !== "secondary");
lineLod("rail.json", "rail-lod.json", 0.004, () => true);
areaLod("water.json", "water-lod.json", 0.004, 0.0004);
