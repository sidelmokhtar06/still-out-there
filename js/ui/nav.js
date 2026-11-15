// Phone header: the worlds sit on a line from Earth, placed by their real distance right now
// (log scale), and the top row says how long light takes from the world on screen.
// Roll call, Myths, Sources and the language picker live behind one menu button.
// Desktop keeps the plain header; CSS decides which one shows.
import { h } from './dom.js';
import { t, fmtNumber, LANGUAGES, lang, chooseLanguage } from '../i18n.js';
import { artifact } from '../data.js';
import { liveData, formatLightTime } from '../live.js';

const MIN = 0.0003, MAX = 300; // AU
const place = (au) => Math.min(1, Math.max(0, (Math.log10(au) - Math.log10(MIN)) / (Math.log10(MAX) - Math.log10(MIN))));
const LIGHT_SECONDS_PER_AU = 499.004784;
const DEEP = 'pioneer10';      // the farthest machine in the data

function distanceAU(world, now) {
  const A = globalThis.Astronomy;
  if (world === 'deep') return liveData(artifact(DEEP), now)?.au ?? null;
  const v = world === 'moon' ? A.GeoMoon(A.MakeTime(now)) : A.GeoVector(A.Body.Mars, now, true);
  return Math.hypot(v.x, v.y, v.z);
}

const lightTime = (s) => (s < 60 ? `${fmtNumber(s, 2)} ${t('unit.s')}` : formatLightTime(s));

export function createNav(shell) {
  const bar = shell.querySelector('.bar');
  const stops = ['moon', 'mars', 'deep'].map((w) => h('a', { class: 'stop', href: `#/${w}`, 'data-nav': w, 'data-w': w },
    h('i', { 'aria-hidden': 'true' }), h('span', {}, t('nav.' + w))));
  const pulse = h('span', { class: 'line-pulse', 'aria-hidden': 'true' });
  const line = h('nav', { class: 'line', 'aria-label': t('nav.worlds') },
    h('span', { class: 'line-track', 'aria-hidden': 'true' }), h('span', { class: 'line-earth', title: t('body.earth') }), pulse, ...stops);

  const time = h('b', {}), full = h('span', { class: 'sr' });
  const delay = h('span', { class: 'delay' }, h('span', { class: 'delay-dot', 'aria-hidden': 'true' }),
    h('span', { class: 'delay-label', 'aria-hidden': 'true' }, t('nav.light')), ' ', h('span', { 'aria-hidden': 'true' }, time), full);

  const menu = h('button', { type: 'button', class: 'menu-btn', 'aria-expanded': 'false', 'aria-controls': 'menu-sheet', 'aria-label': t('nav.menu') }, h('span', {}));
  const sheet = h('div', { class: 'menu-sheet', id: 'menu-sheet', hidden: true },
    ...['rollcall', 'myths', 'sources'].map((n) => h('a', { href: `#/${n}`, 'data-nav': n }, t('nav.' + n), h('span', { class: 'arrow', 'aria-hidden': 'true' }, '→'))),
    h('p', { class: 'eyebrow' }, t('nav.language')),
    h('div', { class: 'menu-langs', role: 'group', 'aria-label': t('nav.language') },
      ...LANGUAGES.map(([code, name]) => h('button', { type: 'button', lang: code, 'aria-pressed': String(code === lang),
        onclick: () => { if (code !== lang) chooseLanguage(code); } }, name))));

  const setOpen = (open) => { menu.setAttribute('aria-expanded', String(open)); sheet.hidden = !open; };
  menu.addEventListener('click', () => setOpen(sheet.hidden));
  window.addEventListener('hashchange', () => setOpen(false));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !sheet.hidden) { setOpen(false); menu.focus(); } });

  bar.append(delay, menu, line, sheet);

  // A dot of light runs from the new world back to Earth: farther worlds, longer trip.
  let shown = shell.dataset.world;
  new MutationObserver(() => {
    const w = shell.dataset.world;
    if (w === shown) return;
    shown = w;
    update(new Date(), true);
    const p = parseFloat(stops.find((s) => s.dataset.w === w)?.style.getPropertyValue('--p'));
    if (!(p >= 0) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    pulse.getAnimations().forEach((a) => a.cancel());
    pulse.animate([{ left: `${p * 100}%`, opacity: 1 }, { left: '0%', opacity: 1, offset: 0.92 }, { left: '0%', opacity: 0 }],
      { duration: 500 + p * 1400, easing: 'cubic-bezier(.4, 0, .6, 1)' });
  }).observe(shell, { attributes: true, attributeFilter: ['data-world'] });

  let placed = 0;
  function update(now, force) {
    if (force || now - placed > 60e3) {          // worlds drift slowly; re-place them once a minute
      placed = +now;
      for (const s of stops) { const au = distanceAU(s.dataset.w, now); if (au) s.style.setProperty('--p', place(au)); }
    }
    const w = shell.dataset.world, au = w && distanceAU(w, now);
    delay.hidden = !au;
    if (!au) return;
    time.textContent = lightTime(au * LIGHT_SECONDS_PER_AU);
    delay.title = full.textContent = `${t('nav.light.' + w, { name: artifact(DEEP)?.name ?? '' })}: ${time.textContent}`;
  }
  update(new Date(), true);
  return { update };
}
