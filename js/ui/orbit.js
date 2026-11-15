// "Seen from orbit": a real photo of the machine taken from a spacecraft, long after it went quiet.
// It opens wide, like the view through a telescope. Zoom in and the lock-on brackets close around
// the machine. Opportunity's photo is a search: the rover is one faint dot, and the reader looks for it.
import { h, scrambleIn } from './dom.js';
import { t } from '../i18n.js';
import { db } from '../data.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function orbitView(a) {
  const o = a.orbit;
  if (!o || !db.sources.has(o.source_id)) return null;
  const source = db.sources.get(o.source_id);
  const [fx, fy] = o.focus;
  const k = `orbit.${a.id}`;

  const img = h('img', { src: o.src, width: o.width, height: o.height, alt: t(k + '.alt'), loading: 'lazy', decoding: 'async', draggable: 'false' });
  const lock = h('span', { class: 'orbit-lock', 'aria-hidden': 'true' }, h('span', { class: 'orbit-lock-label' }, t(k + '.lock')));
  const miss = h('span', { class: 'orbit-miss', 'aria-hidden': 'true' });
  const zoomRead = h('span', { class: 'orbit-zoom' }, '1×');
  const view = h('div', { class: 'orbit-view', style: `aspect-ratio: ${o.width} / ${o.height}` },
    img, lock, miss,
    h('span', { class: 'orbit-hud', 'aria-hidden': 'true' }, `${o.camera} · ${o.taken}`, zoomRead));
  const button = h('button', { type: 'button', class: 'action small', 'aria-pressed': 'false' });
  const status = h('p', { class: 'orbit-status', role: 'status', 'aria-live': 'polite' });
  const caption = h('div', { class: 'orbit-caption', hidden: true },
    h('p', { class: 'orbit-still' }, t(a.status === 'still-working' ? 'orbit.stillWorking' : 'orbit.still')),
    h('p', {}, t(k + '.caption')));

  let zoomed = false, misses = 0;
  const label = () => { button.textContent = zoomed ? t('orbit.out') : t(o.find ? 'orbit.show' : 'orbit.zoom'); };

  function setZoom(on) {
    zoomed = on;
    const s = on ? o.zoom : 1;
    // Keep the frame filled: the centre of view may not leave the picture, so the target sits off-centre near an edge.
    const cx = clamp(fx, 0.5 / s, 1 - 0.5 / s), cy = clamp(fy, 0.5 / s, 1 - 0.5 / s);
    img.style.transform = on ? `translate(${(0.5 - cx * s) * 100}%, ${(0.5 - cy * s) * 100}%) scale(${s})` : '';
    const lx = on ? 0.5 + (fx - cx) * s : fx;
    lock.style.left = `${lx * 100}%`;
    lock.classList.toggle('flip', lx > 0.6);      // keep the name inside the frame
    lock.style.top = `${(on ? 0.5 + (fy - cy) * s : fy) * 100}%`;
    view.classList.toggle('zoomed', on);
    button.setAttribute('aria-pressed', String(on));
    zoomRead.textContent = `${s}×`;
    if (on) {
      caption.hidden = false;
      scrambleIn([zoomRead]);
      status.textContent = '';
    }
    label();
  }

  // A search: a tap near the dot finds it; anywhere else leaves a small ring where the reader looked.
  function look(ev) {
    if (zoomed) { setZoom(false); return; }
    if (!o.find) { setZoom(true); return; }
    const r = view.getBoundingClientRect();
    const x = (ev.clientX - r.left) / r.width, y = (ev.clientY - r.top) / r.height;
    const near = Math.hypot((x - fx) * r.width, (y - fy) * r.height) < Math.max(28, r.width * 0.05);
    if (near) { setZoom(true); status.textContent = t('orbit.found'); return; }
    misses++;
    miss.style.left = `${x * 100}%`; miss.style.top = `${y * 100}%`;
    miss.classList.remove('ping'); void miss.offsetWidth; miss.classList.add('ping');
    status.textContent = misses >= 3 ? t(k + '.clue') : t('orbit.miss');
    if (misses >= 3) view.classList.add('warm');      // after three looks, the dot's area starts to glow
  }

  view.addEventListener('click', look);
  button.addEventListener('click', () => setZoom(!zoomed));
  label();
  lock.style.left = `${fx * 100}%`; lock.style.top = `${fy * 100}%`;

  const el = h('section', { class: `orbit${o.find ? ' orbit-find' : ''}`, 'aria-labelledby': `orbit-h-${a.id}` },
    h('h2', { class: 'eyebrow', id: `orbit-h-${a.id}` }, t('orbit.title')),
    h('p', { class: 'orbit-intro' }, t(k + '.hint')),
    view,
    h('div', { class: 'orbit-controls' }, button, status),
    caption,
    h('p', { class: 'fine' }, t('orbit.taken', { camera: t('orbit.cam.' + o.camera.toLowerCase()), year: o.taken }), ' ',
      t('media.credit', { credit: o.credit }), ' · ', h('a', { href: source.url, target: '_blank', rel: 'noopener' }, o.nasa_id)));
  return { el };
}
