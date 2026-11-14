// Home pane: featured cards over the 3D solar system, one per place where machines rest,
// plus the roll call and the game. Each card shows a live number computed for this second.
import { h } from './dom.js';
import { t } from '../i18n.js';
import { db, byBody, artifact } from '../data.js';
import { liveData, formatKm, tickerLine } from '../live.js';

const KM_PER_AU = 149597870.7;

function distanceKm(world, now) {
  const A = globalThis.Astronomy;
  if (world === 'moon') { const v = A.GeoMoon(A.MakeTime(now)); return Math.hypot(v.x, v.y, v.z) * KM_PER_AU; }
  if (world === 'mars') { const v = A.GeoVector(A.Body.Mars, now, true); return Math.hypot(v.x, v.y, v.z) * KM_PER_AU; }
  return liveData(artifact('pioneer10'), now)?.km ?? null;
}

/** A small turning world: the real map scrolls behind a round, shaded window. */
const sphere = (world) => h('span', { class: `card-art sphere sphere-${world}`, 'aria-hidden': 'true' });

export function homePanel(go) {
  const shell = document.getElementById('shell');
  const live = {};
  const card = (world) => {
    live[world] = h('span', { class: 'card-live' });
    const a = h('a', { class: `card card-${world}`, href: `#/${world}` },
      h('span', { class: 'card-text' },
        h('span', { class: 'card-title' }, t('world.' + world)),
        h('span', { class: 'card-meta' }, t('home.machines', { n: byBody(world).length })),
        live[world]),
      world === 'deep' ? h('span', { class: 'card-art orbit-art', 'aria-hidden': 'true' }, h('span'), h('span')) : sphere(world));
    // From the home page the camera flies to the world first, then the page changes.
    if (world !== 'deep') a.addEventListener('click', (e) => { if (go) { e.preventDefault(); go(world); } });
    return a;
  };

  const ticker = h('p', { class: 'home-now' });
  const toggle = h('button', { type: 'button', class: 'home-toggle', 'aria-expanded': 'true', 'aria-label': t('home.collapse') }, '«');
  toggle.addEventListener('click', () => {
    const closed = shell.dataset.panel !== 'closed';
    if (closed) shell.dataset.panel = 'closed'; else delete shell.dataset.panel;
    toggle.setAttribute('aria-expanded', String(!closed));
    toggle.textContent = closed ? '»' : '«';
  });
  delete shell.dataset.panel;

  const el = h('div', { class: 'pane pane-home' },
    h('div', { class: 'home-head' }, h('h2', { class: 'home-label' }, t('home.featured')), toggle),
    h('div', { class: 'home-body' },
      h('h1', { tabindex: '-1', class: 'home-title' }, t('app.title')),
      h('p', { class: 'home-tagline' }, t('app.tagline')),
      h('div', { class: 'cards' },
        card('moon'), card('mars'), card('deep'),
        h('a', { class: 'card card-rollcall', href: '#/rollcall' },
          h('span', { class: 'card-text' }, h('span', { class: 'card-title' }, t('rollcall.start')), h('span', { class: 'card-meta' }, t('home.rollcallMeta', { n: db.artifacts.length }))),
          h('span', { class: 'card-art pulse-art', 'aria-hidden': 'true' })),
        db.game ? h('a', { class: 'card card-game', href: '#/play/opportunity' },
          h('span', { class: 'card-text' }, h('span', { class: 'card-title' }, db.game.ui.title), h('span', { class: 'card-meta' }, t('home.gameMeta'))),
          h('span', { class: 'card-art photo-art', 'aria-hidden': 'true' })) : null),
      h('div', { class: 'now', role: 'status', 'aria-live': 'polite' }, h('p', { class: 'eyebrow live-dot' }, t('intro.rightNow')), ticker),
      h('p', { class: 'fine' }, t('home.hint')),
      h('p', { class: 'fine' }, h('a', { href: '#/sources' }, t('about.title')), ' · ', t('app.notNasa'))));

  let index = Math.floor(Math.random() * db.artifacts.length), shownAt = 0;
  return {
    el, title: t('home.title'),
    tick(now) {
      for (const world of ['moon', 'mars', 'deep']) {
        const km = distanceKm(world, now);
        live[world].textContent = km == null ? '' : t('home.fromEarth', { km: formatKm(Math.round(km)) });
      }
      if (now - shownAt < 8000) return;
      shownAt = +now;
      for (let tries = 0; tries < db.artifacts.length; tries++) {
        index = (index + 1) % db.artifacts.length;
        const text = tickerLine(db.artifacts[index], now);
        if (text) { ticker.textContent = text; break; }
      }
    },
    destroy() { delete shell.dataset.panel; },
  };
}
