// Day or night at a place on the Moon, using astronomy-engine (vendor/astronomy.browser.min.js,
// which defines the global `Astronomy`).
// Method: Sun direction as seen from the Moon (J2000 equator frame) is rotated into the
// Moon-fixed frame built from RotationAxis(Body.Moon): pole = z, prime meridian = node
// direction turned by the spin angle W (IAU convention). Tested in tools/test-time.js.

import { dayPhase } from './marsTime.js';

const RAD = Math.PI / 180;
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Point on the Moon where the Sun is straight overhead: { lat, lonEast } in degrees. */
export function moonSubsolar(date = new Date()) {
  const A = globalThis.Astronomy;
  const t = A.MakeTime(date);
  const axis = A.RotationAxis(A.Body.Moon, t);
  const sun = A.GeoVector(A.Body.Sun, t, true);
  const moon = A.GeoMoon(t);
  let s = [sun.x - moon.x, sun.y - moon.y, sun.z - moon.z];
  const len = Math.hypot(...s);
  s = s.map((v) => v / len);

  const z = [axis.north.x, axis.north.y, axis.north.z];
  const a0 = axis.ra * 15 * RAD;
  const node = [-Math.sin(a0), Math.cos(a0), 0];        // where the Moon's equator crosses Earth's
  const y0 = cross(z, node);
  const W = axis.spin * RAD;
  const x = node.map((v, i) => v * Math.cos(W) + y0[i] * Math.sin(W)); // prime meridian
  const y = cross(z, x);
  return { lat: Math.asin(dot(s, z)) / RAD, lonEast: Math.atan2(dot(s, y), dot(s, x)) / RAD };
}

/** Sun height above the horizon at a site, in degrees (negative = below). */
export function elevationFrom(sub, lat, lonEast) {
  const c = Math.sin(lat * RAD) * Math.sin(sub.lat * RAD)
    + Math.cos(lat * RAD) * Math.cos(sub.lat * RAD) * Math.cos((lonEast - sub.lonEast) * RAD);
  return Math.asin(Math.max(-1, Math.min(1, c))) / RAD;
}

export function moonSunElevation(lat, lonEast, date = new Date()) {
  return elevationFrom(moonSubsolar(date), lat, lonEast);
}

/** Next sunrise or sunset at a site: { type: 'sunrise'|'sunset', date } or null. */
export function nextMoonSunEvent(lat, lonEast, date = new Date()) {
  const HOUR = 3600e3;
  const el = (ms) => moonSunElevation(lat, lonEast, new Date(ms));
  let t0 = date.getTime(), e0 = el(t0);
  for (let i = 0; i < 32 * 8; i++) {                    // 3-hour steps, up to 32 days
    const t1 = t0 + 3 * HOUR, e1 = el(t1);
    if ((e0 < 0) !== (e1 < 0)) {
      let a = t0, b = t1;
      for (let k = 0; k < 20; k++) {
        const m = (a + b) / 2;
        if ((el(m) < 0) === (e0 < 0)) a = m; else b = m;
      }
      return { type: e0 < 0 ? 'sunrise' : 'sunset', date: new Date((a + b) / 2) };
    }
    t0 = t1; e0 = e1;
  }
  return null;
}

/** Everything the UI needs for one lunar site. */
export function moonLocal(lat, lonEast, date = new Date()) {
  const elevation = moonSunElevation(lat, lonEast, date);
  const later = moonSunElevation(lat, lonEast, new Date(date.getTime() + 3600e3));
  const next = nextMoonSunEvent(lat, lonEast, date);
  return { elevation, phase: dayPhase(elevation, later > elevation), next };
}
