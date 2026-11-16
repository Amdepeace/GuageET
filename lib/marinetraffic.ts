// Plain outbound links to MarineTraffic's own live map. This dashboard does not
// fetch, scrape or embed MarineTraffic (its terms and bot protection forbid
// automated access, and its pages cannot be framed); the visitor's browser just
// opens their site. The URL uses their map's centre/zoom form.
export const marineTrafficView = (lat: number, lon: number, zoom = 9) => `https://www.marinetraffic.com/en/ais/home/centerx:${lon.toFixed(3)}/centery:${lat.toFixed(3)}/zoom:${Math.round(zoom)}`;
export const MT_NOTE = "MarineTraffic is a separate commercial service; this link only opens its map in a new tab. Its live vessel data is not stored or shown here.";
