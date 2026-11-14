// A globe of the Moon or Mars, lit by the Sun's real position right now.
// The surface map is projected per pixel (orthographic view), so the day/night line is exact.
import { h, statusMark } from './dom.js';
import { t } from '../i18n.js';
import { marsState } from '../time/marsTime.js';
import { moonSubsolar } from '../time/moonTime.js';
import { moonCanvas } from './moonTexture.js';

const RAD = Math.PI / 180;
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const unit = (lat, lon) => [Math.cos(lat * RAD) * Math.cos(lon * RAD), Math.cos(lat * RAD) * Math.sin(lon * RAD), Math.sin(lat * RAD)];
const wrap = (lon) => ((((lon + 180) % 360) + 360) % 360) - 180;
const SPIN = 0.005;   // degrees per millisecond (5°/s) while nobody is touching the globe
const HAZE = { mars: [255, 150, 105], moon: [0, 0, 0] };
// How bright the night side stays. On the Moon, sunlight reflected by the Earth (earthshine)
// really does light the dark side faintly; it is boosted here so the far craters stay readable.
const NIGHT = { moon: 0.3, mars: 0.1 };

/** Types a label in, letter by letter, like a readout acquiring a target. */
function typeIn(el, text) {
  let i = 0;
  const step = () => { el.textContent = text.slice(0, ++i) + (i < text.length ? '▌' : ''); if (i < text.length) setTimeout(step, 28); };
  step();
}

export function createGlobe(body, sites) {
  const canvas = h('canvas', { class: 'globe-canvas', 'aria-hidden': 'true' });
  const ctx = canvas.getContext('2d');
  const off = document.createElement('canvas');
  const octx = off.getContext('2d');
  const markers = sites.map((a, i) => ({
    a, v: unit(a.location.lat, a.location.lon_east),
    el: h('a', { class: `marker status-${a.status}`, href: `#/m/${a.id}`,
      'aria-label': `${a.name}, ${a.location.label}. ${t('status.' + a.status)}.` },
      statusMark(a.status), h('span', { class: 'marker-num', 'aria-hidden': 'true' }, String(i + 1)),
      h('span', { class: 'marker-label', 'aria-hidden': 'true' }, a.name)),
  }));
  // Decoration around the disc: a glowing atmosphere behind it and a tilted orbit with a satellite.
  const orbit = h('div', { class: 'orbit', 'aria-hidden': 'true' }, h('span', { class: 'orbit-sat' }));
  const disc = h('div', { class: 'globe-disc' }, h('div', { class: 'atmo', 'aria-hidden': 'true' }), orbit, canvas, ...markers.map((m) => m.el));
  const el = h('div', { class: `globe globe-${body}`, tabindex: '0', role: 'group', 'aria-label': t(`globe.label.${body}`) }, disc);

  let size = 0, css = 0;                 // canvas pixels, CSS pixels
  let lon0 = 0, lat0 = 0;                // the point facing the viewer
  let sun = [1, 0, 0];
  let tex = null, selected = null, anim = 0, lastSun = 0, settle = 0;
  let edge = -0.1;                       // where daylight starts; the first-visit reveal sweeps it from 1 down to -0.1
  let texReady = null, revealRun = 0;
  let spinRaf = 0, sway = 1, lastSpin = 0, pausedUntil = 0, animating = false, revealing = false, hovering = false;
  const texLoaded = new Promise((r) => { texReady = r; });
  const frames = new Map();              // reused pixel buffers per render size

  // Full-resolution map (2048 × 1024). The Moon's pale mosaic gets contrast and crater relief.
  const useCanvas = (c) => {
    tex = { d: c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height };
    texReady();
    render();
  };
  if (body === 'moon') moonCanvas().then(useCanvas);
  else {
    const image = new Image();
    image.onload = () => {
      const c = document.createElement('canvas');
      c.width = image.naturalWidth; c.height = image.naturalHeight;
      c.getContext('2d', { willReadFrequently: true }).drawImage(image, 0, 0);
      useCanvas(c);
    };
    image.src = `assets/maps/${body}.jpg`;
  }

  function render(fast = false) {
    if (!size) return;
    placeMarkers();
    if (!tex) return;
    const N = fast ? Math.ceil(size / 2) : size;
    if (off.width !== N) { off.width = N; off.height = N; }
    let frame = frames.get(N);
    if (!frame) { frame = octx.createImageData(N, N); frames.set(N, frame); }
    const d = frame.data, R = N / 2 - 1, c = N / 2;
    const cl = Math.cos(lat0 * RAD), sl = Math.sin(lat0 * RAD), co = Math.cos(lon0 * RAD), so = Math.sin(lon0 * RAD);
    const [sx, sy, sz] = sun, { d: td, w: tw, h: th } = tex, haze = HAZE[body], night = NIGHT[body], limbBase = body === 'moon' ? 0.8 : 0.58;   // the airless Moon barely darkens at its edge
    for (let py = 0; py < N; py++) {
      const y = (c - py - 0.5) / R;
      for (let px = 0; px < N; px++) {
        const i = (py * N + px) * 4;
        const x = (px + 0.5 - c) / R, r2 = x * x + y * y;
        if (r2 > 1) { d[i + 3] = 0; continue; }
        const z = Math.sqrt(1 - r2);
        // view → body frame: east, north and centre axes of the viewpoint
        const X = -x * so - y * sl * co + z * cl * co;
        const Y = x * co - y * sl * so + z * cl * so;
        const Z = y * cl + z * sl;
        let u = ((Math.atan2(Y, X) / (2 * Math.PI) + 0.5) * tw) | 0;
        let v = ((0.5 - Math.asin(Z) / Math.PI) * th) | 0;
        if (u >= tw) u = tw - 1; if (v >= th) v = th - 1;
        const ti = (v * tw + u) * 4;
        const s = X * sx + Y * sy + Z * sz;            // cosine of the Sun's distance from overhead
        const day = s > edge + 0.2 ? 1 : s < edge ? 0 : (s - edge) / 0.2;
        // limb darkening makes the disc read as a ball; Mars gets a thin dusty haze at the edge
        const limb = limbBase + (1 - limbBase) * Math.sqrt(z);
        const light = (night + (1 - night) * day * (0.6 + 0.4 * Math.sqrt(s > 0 ? s : 0))) * limb;
        const glow = haze[0] ? Math.pow(1 - z, 3) * (0.2 + 0.8 * day) * 0.85 : 0;
        d[i] = td[ti] * light + haze[0] * glow; d[i + 1] = td[ti + 1] * light + haze[1] * glow; d[i + 2] = td[ti + 2] * light + haze[2] * glow;
        const rim = (1 - Math.sqrt(r2)) * R;      // anti-aliased outline
        d[i + 3] = rim >= 1 ? 255 : rim * 255;
      }
    }
    octx.putImageData(frame, 0, 0);
    ctx.clearRect(0, 0, size, size);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(off, 0, 0, size, size);
  }

  function placeMarkers() {
    const cl = Math.cos(lat0 * RAD), sl = Math.sin(lat0 * RAD), co = Math.cos(lon0 * RAD), so = Math.sin(lon0 * RAD);
    const R = css / 2 - css / size;
    const pos = markers.map((m) => {
      const [X, Y, Z] = m.v;
      return { m, depth: X * cl * co + Y * cl * so + Z * sl, x: -X * so + Y * co, y: -X * sl * co - Y * sl * so + Z * cl };
    });
    for (const p of pos) {
      const visible = p.depth > 0.08;
      p.m.el.hidden = !visible;
      if (!visible) continue;
      p.m.el.style.transform = `translate(${css / 2 + p.x * R}px, ${css / 2 - p.y * R}px)`;
      // put the label on the side away from a close neighbour
      const crowded = pos.some((q) => q !== p && q.depth > 0.08 && Math.abs(q.x - p.x) < 0.3 && Math.abs(q.y - p.y) < 0.12 && q.x > p.x);
      p.m.el.classList.toggle('label-left', crowded || p.x > 0.55);
      p.m.el.classList.toggle('selected', p.m.a.id === selected);
    }
  }

  // Fast draws while moving, one sharp draw when it stops.
  function moving() {
    render(true);
    clearTimeout(settle);
    settle = setTimeout(() => render(false), 140);
  }

  function lookAt(lon, lat, animate = true) {
    cancelAnimationFrame(anim);
    lat = Math.max(-60, Math.min(60, lat));
    animating = false;
    if (!animate || reducedMotion() || !size) { lon0 = wrap(lon); lat0 = lat; render(); return; }
    const fromLon = lon0, fromLat = lat0, dLon = wrap(lon - lon0), dLat = lat - lat0, start = performance.now();
    if (Math.abs(dLon) < 0.5 && Math.abs(dLat) < 0.5) { render(); return; }
    const step = (now) => {
      const k = Math.min(1, (now - start) / 700), e = 1 - Math.pow(1 - k, 3);
      lon0 = wrap(fromLon + dLon * e); lat0 = fromLat + dLat * e;
      if (k < 1) { render(true); anim = requestAnimationFrame(step); } else { animating = false; render(false); }
    };
    animating = true;
    anim = requestAnimationFrame(step);
  }

  /** Idle rotation: the globe turns slowly eastward, like the real thing, until someone interacts. */
  function spin(now) {
    spinRaf = requestAnimationFrame(spin);
    const idle = !document.hidden && !selected && !drag && !animating && !revealing && !hovering && now > pausedUntil && tex && size;
    if (!idle) { lastSpin = 0; return; }
    if (!lastSpin) { lastSpin = now; return; }
    if (now - lastSpin < 33) return;           // ~30 fps is smooth at this speed and spares the battery
    const dt = Math.min(80, now - lastSpin);
    lastSpin = now;
    if (body === 'moon') {
      // The Moon keeps one face to Earth: rock gently around it (±25°) instead of spinning round.
      if (lon0 > 25) sway = -1; else if (lon0 < -25) sway = 1;
      lon0 = wrap(lon0 + sway * dt * SPIN * 0.6);
    } else lon0 = wrap(lon0 - dt * SPIN);
    render(false);
  }
  const pause = (ms) => { pausedUntil = performance.now() + ms; };

  // Drag with mouse or finger. Finger drags turn the globe sideways only, so the page still scrolls.
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    cancelAnimationFrame(anim);
    drag = { x: e.clientX, y: e.clientY, lon: lon0, lat: lat0, touch: e.pointerType === 'touch' };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const k = 115 / css;
    lon0 = wrap(drag.lon - (e.clientX - drag.x) * k);
    if (!drag.touch) lat0 = Math.max(-75, Math.min(75, drag.lat + (e.clientY - drag.y) * k));
    moving();
  });
  const endDrag = () => { drag = null; pause(3000); };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  el.addEventListener('keydown', (e) => {
    const move = { ArrowLeft: [-12, 0], ArrowRight: [12, 0], ArrowUp: [0, 10], ArrowDown: [0, -10] }[e.key];
    if (!move || e.target !== el) return;
    e.preventDefault();
    pause(4000);
    lon0 = wrap(lon0 + move[0]); lat0 = Math.max(-75, Math.min(75, lat0 + move[1]));
    moving();
  });

  const observer = new ResizeObserver(() => {
    // clientWidth/Height ignore CSS transforms (the arrival animation scales the globe)
    const next = Math.floor(Math.min(el.clientWidth, el.clientHeight));
    if (next < 40 || next === css) return;
    css = next;
    size = Math.min(640, Math.round(css * Math.min(devicePixelRatio || 1, 2)));
    canvas.width = size; canvas.height = size;
    disc.style.width = disc.style.height = css + 'px';
    render();
  });
  observer.observe(el);
  // Hovering (to aim at a marker) holds the globe still.
  el.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') hovering = true; });
  el.addEventListener('pointerleave', () => { hovering = false; pause(1200); });
  el.addEventListener('focusin', () => { hovering = true; });
  el.addEventListener('focusout', () => { hovering = false; });
  if (!reducedMotion()) spinRaf = requestAnimationFrame(spin);

  return {
    el,
    /** Turn to a machine (or to the default view when id is null). */
    select(id, animate = true) {
      const changed = id !== selected;
      selected = id;
      el.classList.toggle('locked', !!id);
      if (changed && id && animate && !reducedMotion()) {
        const label = markers.find((x) => x.a.id === id)?.el.querySelector('.marker-label');
        if (label) typeIn(label, label.textContent);
      }
      const m = markers.find((x) => x.a.id === id);
      if (m) lookAt(m.a.location.lon_east, m.a.location.lat * 0.6, animate);
      else placeMarkers();
    },
    lookAt,
    /** First visit: daylight spreads from the point under the Sun out to the real terminator. */
    async reveal(ms = 1400, delay = 0) {
      if (reducedMotion()) return;
      const id = ++revealRun;
      revealing = true;
      edge = 1; render();
      await texLoaded;
      await new Promise((r) => setTimeout(r, delay));
      const start = performance.now();
      await new Promise((done) => {
        const step = (now) => {
          if (id !== revealRun) { revealing = false; done(); return; }
          const k = Math.min(1, (now - start) / ms), e = 1 - Math.pow(1 - k, 2.2);
          edge = 1 - 1.1 * e;
          if (k < 1) { render(true); requestAnimationFrame(step); } else { edge = -0.1; revealing = false; render(false); done(); }
        };
        requestAnimationFrame(step);
      });
    },
    skipReveal() { revealRun++; revealing = false; edge = -0.1; render(); },
    update(now) {
      if (now - lastSun < 30e3) return;
      lastSun = +now;
      const sub = body === 'mars' ? marsState(now).subsolar : moonSubsolar(now);
      sun = unit(sub.lat, sub.lonEast);
      render();
    },
    /** Longitude where the Sun is overhead: a good default view for Mars. */
    subsolarLon: (now) => (body === 'mars' ? marsState(now).subsolar : moonSubsolar(now)).lonEast,
    destroy() { observer.disconnect(); cancelAnimationFrame(anim); cancelAnimationFrame(spinRaf); clearTimeout(settle); },
  };
}
