// Gregorian -> Ethiopian calendar, via Julian Day Number. Computed in the browser.
const MONTHS = [
  ["Meskerem", "መስከረም"],
  ["Tikimt", "ጥቅምት"],
  ["Hidar", "ኅዳር"],
  ["Tahsas", "ታኅሣሥ"],
  ["Tir", "ጥር"],
  ["Yekatit", "የካቲት"],
  ["Megabit", "መጋቢት"],
  ["Miyazya", "ሚያዝያ"],
  ["Ginbot", "ግንቦት"],
  ["Sene", "ሰኔ"],
  ["Hamle", "ሐምሌ"],
  ["Nehase", "ነሐሴ"],
  ["Pagume", "ጳጉሜ"],
];

const ETHIOPIC_EPOCH = 1723856; // JDN of the Amete Mihret epoch, minus 365

function gregorianToJdn(y: number, m: number, d: number): number {
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
}

export function toEthiopian(y: number, m: number, d: number) {
  const jdn = gregorianToJdn(y, m, d);
  const r = (jdn - ETHIOPIC_EPOCH) % 1461;
  const n = (r % 365) + 365 * Math.floor(r / 1460);
  const year = 4 * Math.floor((jdn - ETHIOPIC_EPOCH) / 1461) + Math.floor(r / 365) - Math.floor(r / 1460);
  const month = Math.floor(n / 30) + 1;
  const day = (n % 30) + 1;
  return { year, month, day, monthName: MONTHS[month - 1][0], monthAm: MONTHS[month - 1][1] };
}

/** Ethiopian date for "now" in Addis Ababa. */
export function ethiopianToday(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Addis_Ababa",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return toEthiopian(get("year"), get("month"), get("day"));
}
