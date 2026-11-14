// Tiny DOM builder. Text children are always inserted as text, never as HTML.
const SVG_NS = 'http://www.w3.org/2000/svg';

export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  return fill(el, attrs, kids);
}

/** Same as h(), for SVG elements. */
export function s(tag, attrs = {}, ...kids) {
  return fill(document.createElementNS(SVG_NS, tag), attrs, kids);
}

function fill(el, attrs, kids) {
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : String(kid));
  }
  return el;
}

/** Marker shape per status, so status never depends on colour alone. */
export function statusMark(status) {
  const shape = {
    silent: s('circle', { cx: 8, cy: 8, r: 5 }),                       // hollow ring
    'still-working': s('path', { d: 'M8 1.5 14.5 8 8 14.5 1.5 8Z', class: 'solid' }), // filled diamond
    drifting: s('path', { d: 'M3 13 8 2.5 13 13 8 10.5Z' }),            // arrowhead
  }[status];
  return s('svg', { viewBox: '0 0 16 16', class: `mark mark-${status}`, 'aria-hidden': 'true' }, shape);
}

/** Numbers "arrive" like telemetry: digits scramble, then settle left to right (~0.5 s).
 *  Only the visible text animates; it ends on the real value. Skipped when motion is reduced. */
export function scrambleIn(elements, ms = 520) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const start = performance.now();
  const targets = [...elements].map((el) => ({ el, text: el.textContent }));
  const step = (now) => {
    const k = Math.min(1, (now - start) / ms);
    for (const { el, text } of targets) {
      if (el.textContent !== text && !el.dataset.scrambling) continue;   // a live update replaced it: leave it
      const settled = Math.floor(text.length * k);
      el.dataset.scrambling = '1';
      el.textContent = text.slice(0, settled) + text.slice(settled).replace(/\d/g, () => String((Math.random() * 10) | 0));
      if (k === 1) { el.textContent = text; delete el.dataset.scrambling; }
    }
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
