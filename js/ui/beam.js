// Light crossing space, drawn as a pulse on a line between two places.
// laserPanel: fire at the Apollo mirrors and wait the REAL round-trip time.
// signalTrack: a sped-up command from Earth to Mars, labelled with the real one-way time.
import { h } from './dom.js';
import { t, fmtNumber } from '../i18n.js';
import { formatLightTime } from '../live.js';

const C_KM_S = 299792.458;
const EARTH_R = 6371, MOON_R = 1737.4;
const AU_KM = 149597870.7;

/** Earth surface to Moon surface right now, in km (approximate: centre distance minus both radii). */
export function moonSurfaceKm(date = new Date()) {
  const A = globalThis.Astronomy;
  const v = A.GeoMoon(A.MakeTime(date));
  return Math.hypot(v.x, v.y, v.z) * AU_KM - EARTH_R - MOON_R;
}

/** One-way light time from Earth to Mars on a date, in seconds. */
export function marsLightSeconds(date) {
  const A = globalThis.Astronomy;
  const v = A.GeoVector(A.Body.Mars, date, true);
  return (Math.hypot(v.x, v.y, v.z) * AU_KM) / C_KM_S;
}

function track(from, to, extraClass = '') {
  const pulse = h('span', { class: 'beam-pulse', 'aria-hidden': 'true' });
  const el = h('div', { class: `beam ${extraClass}` },
    h('span', { class: 'beam-end' }, from), h('span', { class: 'beam-line', 'aria-hidden': 'true' }, pulse), h('span', { class: 'beam-end' }, to));
  return { el, pulse };
}

function restart(pulse, name, seconds) {
  pulse.style.animation = 'none';
  void pulse.offsetWidth;                       // let the browser forget the old run
  pulse.style.animation = `${name} ${seconds}s linear forwards`;
}

/** "Fire the laser": the pulse goes to the Moon and back in the true round-trip time. */
export function laserPanel() {
  const { el: beam, pulse } = track(t('body.earth'), t('body.moon'), 'beam-laser');
  const clock = h('span', { class: 'beam-clock' }, '0.000 s');
  const result = h('p', { class: 'beam-result', 'aria-live': 'polite' });
  let raf = 0;
  const button = h('button', { type: 'button', class: 'action small', onclick() {
    const km = moonSurfaceKm();
    const rt = (2 * km) / C_KM_S;
    button.disabled = true;
    result.textContent = t('laser.travelling');
    restart(pulse, 'beam-there-back', rt);
    const start = performance.now();
    const step = (now) => {
      const s = Math.min(rt, (now - start) / 1000);
      clock.textContent = `${s.toFixed(3)} s`;
      if (s < rt) { raf = requestAnimationFrame(step); return; }
      result.textContent = t('laser.result', { s: fmtNumber(rt, 2), km: fmtNumber(km) });
      button.disabled = false;
      button.firstChild.textContent = t('laser.again');
    };
    raf = requestAnimationFrame(step);
  } }, h('span', {}, t('laser.button')));

  const el = h('section', { class: 'laser' },
    h('h2', { class: 'eyebrow' }, t('laser.title')),
    h('p', {}, t('laser.lead')),
    beam,
    h('div', { class: 'beam-controls' }, button, clock),
    result,
    h('p', { class: 'fine' }, t('laser.note')));
  return { el, destroy: () => cancelAnimationFrame(raf) };
}

/** A command crossing to Mars. Shown sped up; the real one-way time is printed. Returns { el, send() }. */
export function signalTrack(date, labels) {
  const seconds = marsLightSeconds(new Date(date + 'T12:00:00Z'));
  const { el: beam, pulse } = track(labels.from, labels.to, 'beam-signal');
  const el = h('div', { class: 'signal' },
    beam,
    h('p', { class: 'signal-time' }, labels.time.replace('{time}', formatLightTime(seconds))),
    h('p', { class: 'fine' }, labels.note));
  return { el, send: (shown) => restart(pulse, 'beam-there', shown) };
}
