// Mars local solar time, after NASA GISS "Mars24 Sunclock: Algorithm and Worked Examples"
// https://www.giss.nasa.gov/tools/mars24/help/algorithm.html
// Equation labels (A-1 ... D-5) match that page. Tested in tools/test-time.js.

const RAD = Math.PI / 180;
const sin = (deg) => Math.sin(deg * RAD);
const cos = (deg) => Math.cos(deg * RAD);
const mod = (x, n) => ((x % n) + n) % n;

// TAI-UTC in seconds, from the date each value took effect (A-4).
const LEAP_SECONDS = [
  ['1972-01-01', 10], ['1972-07-01', 11], ['1973-01-01', 12], ['1974-01-01', 13],
  ['1975-01-01', 14], ['1976-01-01', 15], ['1977-01-01', 16], ['1978-01-01', 17],
  ['1979-01-01', 18], ['1980-01-01', 19], ['1981-07-01', 20], ['1982-07-01', 21],
  ['1983-07-01', 22], ['1985-07-01', 23], ['1988-01-01', 24], ['1990-01-01', 25],
  ['1991-01-01', 26], ['1992-07-01', 27], ['1993-07-01', 28], ['1994-07-01', 29],
  ['1996-01-01', 30], ['1997-07-01', 31], ['1999-01-01', 32], ['2006-01-01', 33],
  ['2009-01-01', 34], ['2012-07-01', 35], ['2015-07-01', 36], ['2017-01-01', 37],
].map(([d, s]) => [Date.parse(d + 'T00:00:00Z'), s]);

function ttMinusUtc(millis) {
  let tai = 10;
  for (const [from, s] of LEAP_SECONDS) if (millis >= from) tai = s;
  return tai + 32.184;
}

const PERTURBERS = [
  [0.0071, 2.2353, 49.409], [0.0057, 2.7543, 168.173], [0.0039, 1.1177, 191.837],
  [0.0037, 15.7866, 21.736], [0.0021, 2.1354, 15.704], [0.0020, 2.4694, 95.528],
  [0.0018, 32.8493, 49.095],
];

/** Planet-wide values for a moment in time. Angles in degrees, times in hours. */
export function marsState(date = new Date()) {
  const millis = date.getTime();
  const jdUT = 2440587.5 + millis / 8.64e7;                     // A-2
  const jdTT = jdUT + ttMinusUtc(millis) / 86400;               // A-5
  const dt = jdTT - 2451545.0;                                  // A-6
  const M = 19.3871 + 0.52402073 * dt;                          // B-1
  const alphaFMS = 270.3871 + 0.524038496 * dt;                 // B-2
  let pbs = 0;                                                  // B-3
  for (const [A, tau, phi] of PERTURBERS) pbs += A * cos((0.985626 * dt) / tau + phi);
  const nuM = (10.691 + 3.0e-7 * dt) * sin(M) + 0.623 * sin(2 * M) + 0.050 * sin(3 * M)
    + 0.005 * sin(4 * M) + 0.0005 * sin(5 * M) + pbs;           // B-4
  const Ls = mod(alphaFMS + nuM, 360);                          // B-5
  const eot = 2.861 * sin(2 * Ls) - 0.071 * sin(4 * Ls) + 0.002 * sin(6 * Ls) - nuM; // C-1
  const mst = mod(24 * ((jdTT - 2451549.5) / 1.0274912517 + 44796.0 - 0.0009626), 24); // C-2
  const subsolarLonW = mod(15 * mst + eot + 180, 360);          // C-5
  const declination = Math.asin(0.42565 * sin(Ls)) / RAD + 0.25 * sin(Ls); // D-1
  return { jdTT, dt, M: mod(M, 360), alphaFMS: mod(alphaFMS, 360), pbs, nuM, Ls, eot, mst,
    subsolarLonW, declination,
    subsolar: { lat: declination, lonEast: mod(360 - subsolarLonW, 360) } };
}

/** Local time and Sun height at a site. lonEast in degrees east (0-360 or -180..180). */
export function marsLocal(lat, lonEast, date = new Date()) {
  const s = marsState(date);
  const lonW = mod(360 - lonEast, 360);
  const lmst = mod(s.mst - lonW / 15, 24);                      // C-3
  const ltst = mod(lmst + s.eot / 15, 24);                      // C-4
  const H = lonW - s.subsolarLonW;
  const cosZ = sin(s.declination) * sin(lat) + cos(s.declination) * cos(lat) * cos(H); // D-5
  const elevation = 90 - Math.acos(Math.max(-1, Math.min(1, cosZ))) / RAD;
  return { lmst, ltst, elevation, phase: dayPhase(elevation, ltst < 12), Ls: s.Ls };
}

/** 'day' | 'dawn' | 'dusk' | 'night' from the Sun's height above the horizon. */
export function dayPhase(elevation, rising) {
  if (elevation >= 6) return 'day';
  if (elevation > -6) return rising ? 'dawn' : 'dusk';
  return 'night';
}

/** Northern-hemisphere season from solar longitude Ls. */
export function marsSeason(Ls) {
  return ['spring', 'summer', 'autumn', 'winter'][Math.floor(mod(Ls, 360) / 90)];
}

export function formatHours(h, withSeconds = false) {
  const total = Math.round(mod(h, 24) * 3600) % 86400;
  const p = (n) => String(n).padStart(2, '0');
  const hh = Math.floor(total / 3600), mm = Math.floor((total % 3600) / 60), ss = total % 60;
  return withSeconds ? `${p(hh)}:${p(mm)}:${p(ss)}` : `${p(hh)}:${p(mm)}`;
}
