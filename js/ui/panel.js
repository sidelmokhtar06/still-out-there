// The readout beside the globe: an intro for the world, or live telemetry for one machine.
import { h, statusMark, scrambleIn } from './dom.js';
import { t, fmtNumber } from '../i18n.js';
import { db, byBody, placeOf, noteOf } from '../data.js';
import { liveData, liveSummary, tickerLine, countdown, formatKm, formatAU, formatDate, daysSince, formatHours, formatLightTime } from '../live.js';
import { machineArt } from './art.js';
import { laserPanel } from './beam.js';
import { orbitView } from './orbit.js';
import { missionButton, missionStrip } from '../mission.js';


/** List of machines as plain rows; this is also the keyboard and screen-reader way in. */
export function machineRows(list) {
  const rows = list.map((a, i) => {
    const live = h('span', { class: 'row-live' });
    return { a, live, el: h('li', {}, h('a', { class: `row status-${a.status}`, href: `#/m/${a.id}` },
      statusMark(a.status), h('span', { class: 'row-name' }, h('span', { class: 'row-num', 'aria-hidden': 'true' }, `${i + 1} `), a.name), live)) };
  });
  return {
    el: h('ul', { class: 'rows' }, ...rows.map((r) => r.el)),
    update(now) { for (const r of rows) r.live.textContent = liveSummary(r.a, now); },
  };
}

/** The machines as photo cards: what it looks like, how long it has been quiet, and what is happening there now. */
export function machineCards(list) {
  const cards = list.map((a, i) => {
    const live = h('span', { class: 'card-live' });
    const days = h('b', {});
    return { a, live, days, el: h('li', {}, h('a', { class: `card status-${a.status}`, href: `#/m/${a.id}`, 'data-machine': a.id },
      h('span', { class: 'card-photo' },
        h('img', { src: a.card.src, alt: '', width: 480, height: 320, loading: 'lazy', decoding: 'async' }),
        h('span', { class: 'card-num', 'aria-hidden': 'true' }, String(i + 1)),
        h('span', { class: 'card-status' }, statusMark(a.status), t('status.' + a.status))),
      h('span', { class: 'card-name' }, a.name),
      h('span', { class: 'card-days' }, days, ' ', t('card.days.' + a.status)),
      live)) };
  });
  return {
    el: h('ul', { class: `cards cards-${list.length}` }, ...cards.map((c) => c.el)),
    update(now) {
      for (const c of cards) {
        c.live.textContent = liveSummary(c.a, now);
        c.days.textContent = fmtNumber(daysSince(c.a.since.date, now));
      }
    },
  };
}

export function introPanel(world) {
  const line = h('p', { class: 'now-line' });
  const rows = machineCards(byBody(world));
  const el = h('div', { class: 'pane pane-intro' },
    h('p', { class: 'eyebrow' }, t('app.title'), ' · ', t('world.' + world)),
    h('h1', { tabindex: '-1', class: 'wordmark' }, t('intro.headline.' + world)),
    h('p', { class: 'tagline' }, t('app.tagline')),
    h('p', { class: 'lead' }, t('intro.' + world)),
    h('div', { class: 'intro-actions' },
      missionButton(),
      h('a', { class: 'action ghost rollcall-link', href: '#/rollcall' }, t('rollcall.start')),
      world === 'mars' && db.game ? h('a', { class: 'action ghost', href: '#/play/opportunity' }, db.game.ui.title) : null),
    missionStrip(),
    h('div', { class: 'now', role: 'status', 'aria-live': 'polite' },
      h('p', { class: 'eyebrow live-dot' }, t('intro.rightNow')), line),
    h('h2', { class: 'eyebrow' }, t('intro.choose')),
    rows.el,
    world !== 'deep' ? h('p', { class: 'fine' }, t('globe.hint'), ' ', t(`globe.credit.${world}`)) : h('p', { class: 'fine' }, t('deep.planets')),
    h('p', { class: 'fine' }, h('a', { href: '#/myths' }, t('myth.title')), ' · ', h('a', { href: '#/sources' }, t('about.title')), ' · ', t('app.notNasa')));

  // The "right now" line walks through the machines on this world, so it always matches the picture.
  const here = byBody(world);
  let index = Math.floor(Math.random() * here.length), shownAt = 0;
  return {
    el, title: t('world.' + world),
    tick(now) {
      rows.update(now);
      if (now - shownAt < 8000) return;
      shownAt = +now;
      for (let tries = 0; tries < here.length; tries++) {
        index = (index + 1) % here.length;
        const text = tickerLine(here[index], now);
        if (text) { line.textContent = text; break; }
      }
    },
  };
}

function position(a) {
  const { lat, lon_east: lon } = a.location;
  const ns = `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? 'N' : 'S'}`;
  const ew = a.body === 'moon' ? `${Math.abs(lon).toFixed(2)}° ${lon >= 0 ? 'E' : 'W'}` : `${lon.toFixed(2)}° E`;
  return `${ns}, ${ew}`;
}

export function briefPanel(a) {
  const list = byBody(a.body), i = list.indexOf(a);
  const prev = list[(i - 1 + list.length) % list.length], next = list[(i + 1) % list.length];
  const fields = [];
  const field = (key, value) => {
    const dd = h('dd', {}, value ?? '');
    fields.push(h('div', {}, h('dt', {}, t('field.' + key)), dd));
    return dd;
  };

  field('site', placeOf(a));
  let time, sun, nextEvent, season, distance, inAU, light;
  if (a.body !== 'deep') {
    field('position', position(a));
    if (a.body === 'mars') time = field('localTime');
    sun = field('sun');
    if (a.body === 'moon') nextEvent = field('next'); else season = field('season');
  } else {
    distance = field('distance'); inAU = h('span', { class: 'sub' }); distance.after(inAU);
    light = field('light');
  }
  const status = field('status');
  const laser = a.status === 'still-working' ? laserPanel() : null;
  const orbit = orbitView(a);

  const el = h('div', { class: `pane pane-brief status-${a.status}` },
    h('nav', { class: 'pager', 'aria-label': t('machine.all') },
      h('a', { href: `#/${a.body}`, class: 'pager-all' }, h('span', { class: 'arrow', 'aria-hidden': 'true' }, '←'), ' ', t('world.' + a.body)),
      h('span', { class: 'pager-step' },
        h('a', { href: `#/m/${prev.id}`, 'aria-label': t('machine.prev') }, '‹'),
        h('span', {}, `${i + 1} / ${list.length}`),
        h('a', { href: `#/m/${next.id}`, 'aria-label': t('machine.next') }, '›'))),
    machineArt(a.id),
    h('p', { class: 'eyebrow' }, statusMark(a.status), ' ', t('kind.' + a.type)),
    h('h1', { tabindex: '-1' }, a.name),
    h('dl', { class: 'readout' }, ...fields),
    h('a', { class: 'action', href: `#/story/${a.id}/1` }, t('machine.story'), ' ', h('span', { class: 'arrow', 'aria-hidden': 'true' }, '→')),
    a.id === 'opportunity' && db.game ? h('a', { class: 'action ghost game-link', href: '#/play/opportunity' }, db.game.ui.title) : null,
    orbit?.el,
    laser?.el,
    a.body === 'deep' ? h('p', { class: 'fine' }, t('deep.note')) : null,
    noteOf(a) ? h('p', { class: 'fine' }, noteOf(a)) : null);

  return {
    el, title: a.name,
    destroy() { laser?.destroy(); },
    tick(now) {
      const first = !this.started; this.started = true;
      const d = liveData(a, now);
      const days = fmtNumber(daysSince(a.since.date, now));
      status.textContent = `${t('status.' + a.status)}. ${t('since.' + a.since.kind, { date: formatDate(a.since.date) })}, `
        + t(a.since.kind === 'working' ? 'since.counting' : 'since.ago', { n: days }) + '.';
      for (const dd of [time, sun, nextEvent, season, distance, light]) if (dd) dd.parentNode.hidden = !d;
      if (inAU) inAU.hidden = !d;
      if (!d) return;
      if (sun) sun.textContent = t(d.up ? 'sun.above' : 'sun.below', { deg: Math.abs(d.elevation).toFixed(1) })
        + (d.kind === 'mars' ? `, ${t('phase.' + d.phase)}` : '');
      if (time) time.textContent = formatHours(d.ltst, true);
      if (season) season.textContent = t('season.north', { season: t('season.' + d.season) });
      if (nextEvent) {
        nextEvent.parentNode.hidden = !d.next;
        if (d.next) nextEvent.textContent = t('next.' + d.next.type, { when: countdown(d.next.date - now) });
      }
      if (distance) {
        distance.textContent = t('live.km', { km: formatKm(d.km) });
        inAU.textContent = t('live.auLong', { au: formatAU(d.au) });
        light.textContent = t('live.lightLong', { time: formatLightTime(d.lightSeconds) });
      }
      if (first) scrambleIn(el.querySelectorAll('.readout dd, .readout .sub'));
    },
  };
}
