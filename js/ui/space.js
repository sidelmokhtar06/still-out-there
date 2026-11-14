// Ambient space behind the whole app (decoration only, hidden from screen readers):
//   starfield()  twinkling stars that drift very slowly, with the odd shooting star
//   orrery()     a small solar system for the deep-space view: the planets start where
//                they really are today and then circle the Sun, sped up (not to scale)
// Both stop moving under prefers-reduced-motion and pause while the tab is hidden.
import { h } from './dom.js';

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function starfield() {
  const canvas = h('canvas', { class: 'starfield', 'aria-hidden': 'true' });
  const ctx = canvas.getContext('2d');
  let w = 0, hgt = 0, dpr = 1, stars = [], meteor = null, raf = 0, last = 0;

  function seed() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    w = innerWidth; hgt = innerHeight;
    canvas.width = w * dpr; canvas.height = hgt * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.round((w * hgt) / 2600);
    stars = Array.from({ length: count }, () => {
      const depth = Math.random();                       // 0 far … 1 near
      const tint = Math.random();
      return {
        x: Math.random() * w, y: Math.random() * hgt, depth,
        r: 0.3 + depth * depth * 1.3,
        a: 0.25 + depth * 0.65,
        tw: 0.4 + Math.random() * 1.8, ph: Math.random() * Math.PI * 2,
        c: tint < 0.12 ? '255,214,170' : tint < 0.25 ? '178,206,255' : '255,255,255',
      };
    });
    draw(performance.now());
  }

  function draw(now) {
    const dt = last ? Math.min(64, now - last) : 16;
    last = now;
    ctx.clearRect(0, 0, w, hgt);
    const still = reducedMotion();
    for (const s of stars) {
      if (!still) { s.x -= s.depth * dt * 0.004; if (s.x < -2) s.x = w + 2; }
      const twinkle = still ? 1 : 0.65 + 0.35 * Math.sin(now / 1000 * s.tw + s.ph);
      ctx.fillStyle = `rgba(${s.c},${(s.a * twinkle).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
      if (s.r > 1.2) {                                     // a soft halo on the brightest ones
        ctx.fillStyle = `rgba(${s.c},${(0.08 * twinkle).toFixed(3)})`;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 4, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (!still) shootingStar(now);
  }

  function shootingStar(now) {
    if (!meteor && Math.random() < 0.0016) {
      meteor = { x: Math.random() * w * 0.8 + w * 0.2, y: Math.random() * hgt * 0.4, t0: now, len: 90 + Math.random() * 90 };
    }
    if (!meteor) return;
    const k = (now - meteor.t0) / 900;
    if (k >= 1) { meteor = null; return; }
    const x = meteor.x - k * 360, y = meteor.y + k * 150;
    const g = ctx.createLinearGradient(x, y, x + meteor.len, y - meteor.len * 0.42);
    const a = Math.sin(k * Math.PI);
    g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.strokeStyle = g; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + meteor.len, y - meteor.len * 0.42); ctx.stroke();
  }

  function loop(now) {
    if (!document.hidden) draw(now);
    raf = requestAnimationFrame(loop);
  }

  addEventListener('resize', seed);
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', () => { cancelAnimationFrame(raf); if (!reducedMotion()) raf = requestAnimationFrame(loop); else draw(performance.now()); });
  seed();
  if (!reducedMotion()) raf = requestAnimationFrame(loop);
  return canvas;
}

// Orbital periods in Earth days. Radii are squashed (square root of the real distance) so
// Neptune fits on screen; the orrery is a backdrop, the distance line in front carries the data.
const PLANETS = [
  { name: 'Mercury', au: 0.39, days: 88, size: 2.2, color: '#b9b2a6' },
  { name: 'Venus', au: 0.72, days: 225, size: 3.4, color: '#e8cf9a' },
  { name: 'Earth', au: 1, days: 365.25, size: 3.6, color: '#7fb4ff', moon: true },
  { name: 'Mars', au: 1.52, days: 687, size: 3, color: '#e0714a' },
  { name: 'Jupiter', au: 5.2, days: 4333, size: 6.5, color: '#d9b58c' },
  { name: 'Saturn', au: 9.58, days: 10759, size: 5.6, color: '#e6d3a1', ring: true },
  { name: 'Uranus', au: 19.2, days: 30687, size: 4.4, color: '#9fe0e6' },
  { name: 'Neptune', au: 30.1, days: 60190, size: 4.3, color: '#6f8dff' },
];
const DAYS_PER_SECOND = 6;   // one Earth year in about a minute

export function orrery() {
  const canvas = h('canvas', { class: 'orrery', 'aria-hidden': 'true' });
  const ctx = canvas.getContext('2d');
  const A = globalThis.Astronomy;
  // Today's real heliocentric longitude of each planet, so the picture starts true.
  const start = PLANETS.map((p) => {
    try { const v = A.HelioVector(A.Body[p.name], new Date()); return Math.atan2(v.y, v.x); } catch { return Math.random() * Math.PI * 2; }
  });
  let w = 0, hgt = 0, raf = 0, t0 = performance.now();
  const observer = new ResizeObserver(() => {
    const box = canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    w = box.width; hgt = box.height;
    canvas.width = w * dpr; canvas.height = hgt * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(performance.now());
  });
  observer.observe(canvas);

  function draw(now) {
    if (!w) return;
    const days = reducedMotion() ? 0 : ((now - t0) / 1000) * DAYS_PER_SECOND;
    const cx = w / 2, cy = hgt / 2, tilt = 0.42;          // seen from above at a slant
    const scale = (Math.min(w, hgt / tilt) * 0.47) / Math.sqrt(30.1);
    ctx.clearRect(0, 0, w, hgt);
    // the Sun
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 46);
    glow.addColorStop(0, 'rgba(255,240,200,1)'); glow.addColorStop(0.18, 'rgba(255,214,120,.9)');
    glow.addColorStop(0.45, 'rgba(255,170,60,.22)'); glow.addColorStop(1, 'rgba(255,150,40,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, cy, 46, 0, Math.PI * 2); ctx.fill();
    PLANETS.forEach((p, i) => {
      const r = Math.sqrt(p.au) * scale;
      ctx.strokeStyle = 'rgba(160,190,255,.16)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(cx, cy, r, r * tilt, 0, 0, Math.PI * 2); ctx.stroke();
      const ang = start[i] + (days / p.days) * Math.PI * 2;
      const x = cx + Math.cos(ang) * r, y = cy - Math.sin(ang) * r * tilt;
      const halo = ctx.createRadialGradient(x, y, 0, x, y, p.size * 3);
      halo.addColorStop(0, p.color + '66'); halo.addColorStop(1, p.color + '00');
      ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(x, y, p.size * 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(x, y, p.size, 0, Math.PI * 2); ctx.fill();
      if (p.ring) {
        ctx.strokeStyle = 'rgba(230,211,161,.7)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(x, y, p.size * 2.3, p.size * 0.8, -0.35, 0, Math.PI * 2); ctx.stroke();
      }
      if (p.moon) {
        const ma = (days / 27.3) * Math.PI * 2;
        ctx.fillStyle = '#d8d4cc'; ctx.beginPath(); ctx.arc(x + Math.cos(ma) * 9, y - Math.sin(ma) * 9 * tilt, 1.3, 0, Math.PI * 2); ctx.fill();
      }
    });
  }

  function loop(now) {
    if (!document.hidden) draw(now);
    raf = requestAnimationFrame(loop);
  }
  if (!reducedMotion()) raf = requestAnimationFrame(loop);

  return { el: canvas, destroy() { cancelAnimationFrame(raf); observer.disconnect(); } };
}
