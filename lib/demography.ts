// Small helpers for age-structure figures. Median age is COMPUTED from published
// 5-year age bands by linear interpolation inside the band that holds the median;
// it is an approximation of the official median, and labelled that way in the UI.
export const NATIONAL_WIDTHS = [...new Array(16).fill(5), 20]; // 0-4 ... 75-79, 80+
export const ZONE_WIDTHS = [...new Array(13).fill(5), 35]; // 0-4 ... 60-64, 65+

export function medianAge(m: number[], f: number[], widths: number[]): number | null {
  const total = [...m, ...f].reduce((a, b) => a + b, 0);
  if (!total) return null;
  let cum = 0;
  let lo = 0;
  for (let i = 0; i < widths.length; i++) {
    const band = (m[i] ?? 0) + (f[i] ?? 0);
    if (cum + band >= total / 2) return Math.round((lo + ((total / 2 - cum) / band) * widths[i]) * 10) / 10;
    cum += band;
    lo += widths[i];
  }
  return null;
}

/** shares of the population aged 0-14, 15-64 and 65+, in percent (bands start at 0, in steps of 5; 65+ starts at band index `oldFrom`) */
export function ageGroups(m: number[], f: number[], oldFrom: number) {
  const band = (i: number) => (m[i] ?? 0) + (f[i] ?? 0);
  const total = m.reduce((a, b) => a + b, 0) + f.reduce((a, b) => a + b, 0);
  if (!total) return { young: 0, working: 0, old: 0 };
  let young = 0;
  let old = 0;
  for (let i = 0; i < 3; i++) young += band(i);
  for (let i = oldFrom; i < Math.max(m.length, f.length); i++) old += band(i);
  return { young: (young / total) * 100, working: ((total - young - old) / total) * 100, old: (old / total) * 100 };
}
