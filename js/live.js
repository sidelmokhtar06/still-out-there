// Turns the time engines into "right now" readings for one machine.
import { marsLocal, marsSeason, formatHours } from './time/marsTime.js';
import { moonLocal, moonSunElevation } from './time/moonTime.js';
import { distanceAt } from './time/deepSpace.js';
import { db } from './data.js';
import { t, fmtNumber, fmtDate } from './i18n.js';

const nextEventCache = new Map(); // the Moon sunrise/sunset search is slow, so keep the answer

/** "3 d 4 h" / "22 h 47 min" / "12 min" */
export function countdown(ms) {
  const min = Math.max(0, Math.round(ms / 60e3));
  const d = Math.floor(min / 1440), hrs = Math.floor((min % 1440) / 60), m = min % 60;
  if (d > 0) return `${d} ${t('unit.d')} ${hrs} ${t('unit.h')}`;
  if (hrs > 0) return `${hrs} ${t('unit.h')} ${String(m).padStart(2, '0')} ${t('unit.min')}`;
  return `${m} ${t('unit.min')}`;
}

/** Raw live readings, or null when nothing can be calculated (then the UI shows nothing). */
export function liveData(a, now = new Date()) {
  try {
    if (a.body === 'moon') {
      const { lat, lon_east: lon } = a.location;
      let cached = nextEventCache.get(a.id);
      if (!cached || !cached.next || cached.next.date <= now) {
        cached = moonLocal(lat, lon, now);
        nextEventCache.set(a.id, cached);
      }
      const elevation = moonSunElevation(lat, lon, now);
      return { kind: 'moon', elevation, up: elevation > 0, next: cached.next };
    }
    if (a.body === 'mars') {
      const m = marsLocal(a.location.lat, a.location.lon_east, now);
      return { kind: 'mars', ...m, up: m.elevation > 0, season: marsSeason(m.Ls) };
    }
    if (a.body === 'deep') {
      const d = distanceAt(db.ephemeris[a.ephemeris], now);
      return d && { kind: 'deep', ...d };
    }
  } catch (err) {
    console.warn('live data unavailable for', a.id, err);
  }
  return null;
}

export const formatKm = (km) => fmtNumber(km);
export const formatAU = (au) => fmtNumber(au, au >= 10 ? 2 : 3);
export const formatDate = (iso) => fmtDate(new Date(iso + 'T00:00:00Z'));
export const daysSince = (iso, now = new Date()) => Math.floor((now - new Date(iso + 'T00:00:00Z')) / 86400e3);
export { formatHours };

/** Light travel time in the reader's language ("19 h 35 min", "4 min 12 s"). */
export function formatLightTime(seconds) {
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m} ${t('unit.min')} ${Math.floor(seconds % 60)} ${t('unit.s')}`;
  return `${h} ${t('unit.h')} ${String(m).padStart(2, '0')} ${t('unit.min')}`;
}

/** One short line for lists. */
export function liveSummary(a, now = new Date()) {
  const d = liveData(a, now);
  if (!d) return '';
  if (d.kind === 'mars') return t('list.mars', { time: formatHours(d.ltst), phase: t('phase.' + d.phase) });
  if (d.kind === 'moon') return d.next ? t(d.up ? 'list.moon.up' : 'list.moon.down', { when: countdown(d.next.date - now) }) : '';
  return t('live.km', { km: formatKm(d.km) });
}

/** One sentence for the "Right now" line (without the leading "Right now, "). */
export function tickerLine(a, now = new Date()) {
  const d = liveData(a, now);
  if (!d) return null;
  if (d.kind === 'mars') return t('ticker.mars', { phase: t('phase.' + d.phase), name: a.name, time: formatHours(d.ltst) });
  if (d.kind === 'moon') {
    if (a.status === 'still-working') return t('ticker.laser');
    return d.next ? t(d.up ? 'ticker.moon.up' : 'ticker.moon.down', { name: a.name, when: countdown(d.next.date - now) }) : null;
  }
  return t('ticker.deep', { time: formatLightTime(d.lightSeconds), name: a.name });
}
