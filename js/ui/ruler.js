// Deep space stage: one line, Earth at one end, everything else placed by its real distance
// from Earth right now. The scale is logarithmic (each step is 10x farther) because the
// distances run from the Moon (0.0026 AU) to Pioneer 10 (over 140 AU).
import { h, statusMark } from './dom.js';
import { t } from '../i18n.js';
import { liveData } from '../live.js';
import { orrery } from './space.js';

const MIN = 0.001, MAX = 300; // AU
const place = (au) => (Math.log10(au) - Math.log10(MIN)) / (Math.log10(MAX) - Math.log10(MIN));
const BODIES = ['Moon', 'Sun', 'Mars', 'Jupiter', 'Saturn', 'Neptune'];

function bodyDistance(name, now) {
  const A = globalThis.Astronomy;
  const v = name === 'Moon' ? A.GeoMoon(A.MakeTime(now)) : A.GeoVector(A.Body[name], now, true);
  return Math.hypot(v.x, v.y, v.z);
}

export function createRuler(crafts) {
  const ticks = [0.01, 0.1, 1, 10, 100].map((au) =>
    h('span', { class: 'tick', style: `--p:${place(au)}` }, h('span', { class: 'tick-label' }, `${au} AU`)));
  const bodies = BODIES.map((name) => ({
    name, el: h('span', { class: 'body' }, h('span', { class: 'body-dot' }), h('span', { class: 'body-label' }, t('body.' + name.toLowerCase()))),
  }));
  const craftEls = crafts.map((a) => ({
    a, el: h('a', { class: `craft status-${a.status}`, href: `#/m/${a.id}`, 'aria-label': `${a.name}. ${t('status.' + a.status)}.` },
      statusMark(a.status), h('span', { class: 'craft-label', 'aria-hidden': 'true' }, a.name)),
  }));
  const line = h('div', { class: 'ruler-line' },
    h('span', { class: 'body earth', style: '--p:0' }, h('span', { class: 'body-dot' }), h('span', { class: 'body-label' }, t('body.earth'))),
    ...ticks, ...bodies.map((b) => b.el), ...craftEls.map((c) => c.el));
  const backdrop = orrery();
  const el = h('div', { class: 'ruler', role: 'group', 'aria-label': t('deep.label') },
    backdrop.el, line, h('p', { class: 'ruler-caption' }, t('deep.scale'), ' ', t('deep.au')));

  let last = 0, selected = null;
  return {
    el,
    select(id) { selected = id; for (const c of craftEls) c.el.classList.toggle('selected', c.a.id === id); },
    update(now) {
      if (now - last < 60e3) return;
      last = +now;
      // Bodies sit on one side of the line; nudge labels apart when two are close together.
      const placed = bodies.map((b) => ({ b, p: place(bodyDistance(b.name, now)) })).sort((x, y) => x.p - y.p);
      let prev = -1;
      for (const item of placed) {
        const labelAt = Math.max(item.p, prev + 0.05);
        prev = labelAt;
        item.b.el.style.setProperty('--p', item.p);
        item.b.el.style.setProperty('--shift', labelAt - item.p);
      }
      for (const c of craftEls) {
        const d = liveData(c.a, now);
        c.el.hidden = !d;                       // no table → no marker, never a guess
        if (d) c.el.style.setProperty('--p', place(d.au));
      }
      this.select(selected);
    },
    reveal: async () => {},
    skipReveal() {},
    destroy() { backdrop.destroy(); },
  };
}
