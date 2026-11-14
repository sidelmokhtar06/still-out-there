// Live distance to a silent spacecraft, interpolated from a table pre-downloaded from
// NASA JPL Horizons (see tools/fetch-ephemeris.sh). The spacecraft no longer talks to us,
// so this is a calculated prediction of where it is, not a measurement.
// If the table is missing or "now" is outside it, callers get null and must hide the widget.

export const AU_KM = 149597870.7;
export const LIGHT_SECONDS_PER_AU = 499.004784;

/** table = { start: 'YYYY-MM-DD', stepDays: 1, au: [..] } → { au, km, lightSeconds } or null */
export function distanceAt(table, date = new Date()) {
  if (!table || !Array.isArray(table.au)) return null;
  const start = Date.parse(table.start + 'T00:00:00Z');
  const pos = (date.getTime() - start) / (table.stepDays * 86400e3);
  const i = Math.floor(pos);
  if (!(pos >= 0) || i >= table.au.length - 1) return null;
  const au = table.au[i] + (table.au[i + 1] - table.au[i]) * (pos - i);
  return { au, km: au * AU_KM, lightSeconds: au * LIGHT_SECONDS_PER_AU };
}

export function formatLightTime(seconds) {
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m} min ${Math.floor(seconds % 60)} s`;
  return `${h} h ${String(m).padStart(2, '0')} min`;
}
