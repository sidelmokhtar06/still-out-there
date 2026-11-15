// Home stage: the solar system in 3D (Three.js). The planets and the Moon are placed where they
// really are on the date in the time bar (Astronomy Engine). Sizes and distances are squashed so
// everything fits: the picture is true in direction, not in scale.
// Drag to turn, scroll or pinch to zoom, click the Moon or Mars to fly there.
import * as THREE from 'three';
import { OrbitControls } from '../../vendor/three-addons/OrbitControls.js';
import { h } from './dom.js';
import { t } from '../i18n.js';
import { byBody } from '../data.js';
import { orrery } from './space.js';
import { moonCanvas } from './moonTexture.js';

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const RAD = Math.PI / 180;
const DAY = 86400e3;
// Distance squash: real AU → scene units. Keeps Mercury off the Sun and Neptune on screen.
const orbitR = (au) => 14 * Math.pow(au, 0.5);

const PLANETS = [
  { id: 'mercury', body: 'Mercury', au: 0.387, r: 0.32, tex: 'mercury', spin: 0.05 },
  { id: 'venus', body: 'Venus', au: 0.723, r: 0.55, tex: 'venus', spin: -0.03 },
  { id: 'earth', body: 'Earth', au: 1, r: 0.72, map: 'assets/maps/earth.jpg', spin: 0.25 },
  { id: 'mars', body: 'Mars', au: 1.524, r: 0.5, map: 'assets/maps/mars.jpg', spin: 0.24, world: 'mars', glow: 0xff8a5c },
  { id: 'jupiter', body: 'Jupiter', au: 5.2, r: 1.7, tex: 'jupiter', spin: 0.6 },
  { id: 'saturn', body: 'Saturn', au: 9.58, r: 1.45, tex: 'saturn', spin: 0.55, ring: true },
  { id: 'uranus', body: 'Uranus', au: 19.2, r: 0.95, tex: 'uranus', spin: 0.35 },
  { id: 'neptune', body: 'Neptune', au: 30.1, r: 0.92, tex: 'neptune', spin: 0.36 },
];
export const RATES = [
  { ms: 1, key: 'timebar.rate' },             // real time
  { ms: 3600, key: 'timebar.rate.hour' },     // 1 hour per second
  { ms: 86400, key: 'timebar.rate.day' },     // 1 day per second
  { ms: 604800, key: 'timebar.rate.week' },   // 1 week per second
];

// ---- planet surfaces drawn in code (the repo has real maps only for the Earth, Moon and Mars) ----
// Smooth value noise, summed over octaves, gives turbulent cloud belts and cratered plains.
function noise2(seed) {
  const perm = new Uint8Array(512);
  let s = seed;
  for (let i = 0; i < 256; i++) perm[i] = i;
  for (let i = 255; i > 0; i--) { s = (s * 16807) % 2147483647; const j = s % (i + 1); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];
  const val = (x, y) => perm[(perm[x & 255] + y) & 511] / 255;
  const smooth = (t) => t * t * (3 - 2 * t);
  const noise = (x, y, wrap) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = smooth(x - xi), yf = smooth(y - yi);
    const x0 = ((xi % wrap) + wrap) % wrap, x1 = (x0 + 1) % wrap;          // wraps east–west, no seam
    const a = val(x0, yi), b = val(x1, yi), c = val(x0, yi + 1), d = val(x1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
  return (x, y, octaves = 5, base = 8) => {
    let sum = 0, amp = 0.5, f = 1;
    for (let o = 0; o < octaves; o++) { sum += amp * noise(x * base * f, y * base * f, base * f); amp *= 0.5; f *= 2; }
    return sum;
  };
}
const mix = (a, b, t) => a + (b - a) * t;
const hex = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
function ramp(colors, t) {
  const cs = colors.map(hex), x = Math.min(0.999, Math.max(0, t)) * (cs.length - 1), i = Math.floor(x), k = x - i;
  return [mix(cs[i][0], cs[i + 1][0], k), mix(cs[i][1], cs[i + 1][1], k), mix(cs[i][2], cs[i + 1][2], k)];
}
const STYLES = {
  // gas giants: belts that wobble with turbulence
  jupiter: { kind: 'gas', colors: ['#7a5236', '#b98a62', '#e9d6b4', '#c99c6e', '#f3e7cf', '#a8744c'], bands: 14, turb: 0.06, spot: true },
  saturn: { kind: 'gas', colors: ['#b8975e', '#d8c08a', '#efe2bf', '#cdb27c', '#e8d7a8'], bands: 11, turb: 0.035 },
  uranus: { kind: 'gas', colors: ['#7fc9d3', '#9fdde4', '#b7ecef', '#93d6de'], bands: 5, turb: 0.012 },
  neptune: { kind: 'gas', colors: ['#2f4fb8', '#3f63d6', '#5b80ef', '#3a5ccc', '#7a9bff'], bands: 7, turb: 0.03 },
  venus: { kind: 'haze', colors: ['#b98d4f', '#d9b77a', '#ecd29c', '#f6e5bd'] },
  mercury: { kind: 'rock', colors: ['#4d4844', '#77706a', '#9d958c', '#c2bab0'] },
  sun: { kind: 'sun', colors: ['#ff9a2e', '#ffc24f', '#ffe08a', '#fff2c8'] },
};

function paintTexture(name) {
  const st = STYLES[name], W = 1024, H = 512;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const img = g.createImageData(W, H), d = img.data;
  const n = noise2(name.length * 977 + name.charCodeAt(0) * 31);
  for (let y = 0; y < H; y++) {
    const v = y / H, lat = (v - 0.5) * Math.PI;
    for (let x = 0; x < W; x++) {
      const u = x / W;
      let t;
      if (st.kind === 'gas') {
        const warp = (n(u, v * 2, 4, 6) - 0.5) * st.turb * 6;
        const band = Math.sin((v + warp) * Math.PI * st.bands) * 0.5 + 0.5;
        t = band * 0.75 + n(u * 2, v * 8, 4, 8) * 0.25;
        t = mix(t, 0.55, Math.pow(Math.abs(Math.sin(lat)), 6) * 0.6);          // calmer, greyer poles
      } else if (st.kind === 'haze') {
        t = n(u + n(u, v, 3, 4) * 0.3, v * 1.5, 5, 4);
      } else if (st.kind === 'sun') {
        t = 0.35 + n(u, v, 6, 24) * 0.9;
      } else {
        t = n(u, v, 6, 10) * 1.1 - 0.05;
      }
      const [r, gg, b] = ramp(st.colors, t);
      const i = (y * W + x) * 4;
      d[i] = r; d[i + 1] = gg; d[i + 2] = b; d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  if (st.spot) {                                                                // Jupiter's Great Red Spot
    g.fillStyle = 'rgba(176,82,52,.75)'; g.beginPath(); g.ellipse(W * 0.62, H * 0.64, 42, 20, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(240,220,190,.6)'; g.lineWidth = 3; g.stroke();
  }
  if (st.kind === 'rock') {                                                      // craters: dark floor, bright rim
    let s = 12345;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 260; i++) {
      const x = rnd() * W, y = H * 0.08 + rnd() * H * 0.84, r = 2 + Math.pow(rnd(), 3) * 26;
      g.fillStyle = 'rgba(30,26,24,.35)'; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(235,228,215,.35)'; g.lineWidth = Math.max(1, r * 0.18); g.beginPath(); g.arc(x - r * 0.12, y - r * 0.12, r, Math.PI * 0.9, Math.PI * 1.9); g.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function glowTexture(inner, outer) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, inner); grad.addColorStop(0.25, outer); grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Ecliptic longitude/latitude (degrees) and distance (AU) of a planet around the Sun. */
function helio(A, body, date) {
  const v = A.HelioVector(A.Body[body], date);
  const e = A.Ecliptic(v);
  return { lon: e.elon, lat: e.elat, au: Math.hypot(v.x, v.y, v.z) };
}
const toScene = (lon, lat, r) => new THREE.Vector3(r * Math.cos(lat * RAD) * Math.cos(lon * RAD), r * Math.sin(lat * RAD) * 0.6, -r * Math.cos(lat * RAD) * Math.sin(lon * RAD));

export function createSystem() {
  const A = globalThis.Astronomy;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch {
    // No WebGL: keep the flat animated solar system so the home page still moves.
    const flat = orrery();
    const el = h('div', { class: 'system system-flat', role: 'img', 'aria-label': t('system.label') }, flat.el);
    return { el, select() {}, lookAt() {}, update() {}, reveal: async () => {}, skipReveal() {}, destroy: flat.destroy, flyToWorld: async () => {} };
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  const canvas = renderer.domElement;
  canvas.classList.add('system-canvas');
  canvas.setAttribute('aria-hidden', 'true');

  const labels = h('div', { class: 'sys-labels' });
  const zoomIn = h('button', { type: 'button', class: 'sys-btn', 'aria-label': t('system.zoomIn') }, '+');
  const zoomOut = h('button', { type: 'button', class: 'sys-btn', 'aria-label': t('system.zoomOut') }, '−');
  const home = h('button', { type: 'button', class: 'sys-btn', 'aria-label': t('system.reset') }, '⟲');
  const scaleNote = h('p', { class: 'sys-note' }, t('system.notToScale'));
  const el = h('div', { class: 'system', role: 'group', 'aria-label': t('system.label') },
    canvas, labels, h('div', { class: 'sys-controls' }, zoomIn, zoomOut, home), scaleNote);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 2000);
  const HOME_POS = new THREE.Vector3(0, 17, 31);    // the inner system, where the Moon and Mars are
  camera.position.set(0, 140, 240);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan = false;
  controls.minDistance = 1.2;
  controls.maxDistance = 260;
  controls.rotateSpeed = 0.6;
  controls.autoRotate = !reducedMotion();
  controls.autoRotateSpeed = 0.18;

  scene.add(new THREE.AmbientLight(0x6070a0, 0.32));
  const sunLight = new THREE.PointLight(0xfff1dc, 3.2, 0, 0);
  scene.add(sunLight);

  // the Sun: a hot core and two layers of glow that breathe
  const loader = new THREE.TextureLoader();
  const sun = new THREE.Mesh(new THREE.SphereGeometry(2.1, 48, 32),
    new THREE.MeshBasicMaterial({ map: paintTexture('sun'), toneMapped: false }));
  scene.add(sun);
  const corona = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,244,214,1)', 'rgba(255,190,90,.6)'), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  corona.scale.setScalar(13);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,200,120,.55)', 'rgba(255,140,60,.14)'), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  halo.scale.setScalar(34);
  scene.add(corona, halo);

  // planets, their orbits and labels
  const items = PLANETS.map((p) => {
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0 });
    if (p.map) loader.load(p.map, (tex) => { tex.colorSpace = THREE.SRGBColorSpace; mat.map = tex; mat.needsUpdate = true; });
    else mat.map = paintTexture(p.tex);
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(p.r, 48, 32), mat);
    mesh.rotation.z = 0.35;
    const group = new THREE.Group();
    group.add(mesh);
    if (p.glow || p.id === 'earth') {        // thin atmosphere shell
      const atmo = new THREE.Mesh(new THREE.SphereGeometry(p.r * 1.12, 48, 32),
        new THREE.MeshBasicMaterial({ color: p.glow ?? 0x6fb4ff, transparent: true, opacity: 0.16, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false }));
      group.add(atmo);
    }
    if (p.ring) {
      const inner = p.r * 1.35, outer = p.r * 2.4;
      const ringGeo = new THREE.RingGeometry(inner, outer, 96);
      const pos = ringGeo.attributes.position, uv = ringGeo.attributes.uv;
      for (let i = 0; i < pos.count; i++) uv.setXY(i, (Math.hypot(pos.getX(i), pos.getY(i)) - inner) / (outer - inner), 0.5);   // texture runs outward
      const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ map: ringTexture(), side: THREE.DoubleSide, transparent: true, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2 + 0.45;
      group.add(ring);
    }
    scene.add(group);
    // orbit: sampled from the real path over one period, then squashed like the positions
    const pts = [];
    for (let i = 0; i <= 180; i++) pts.push(toScene(i * 2, 0, orbitR(p.au)));
    const orbit = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: p.world ? 0xff9a70 : 0x8fb4ff, transparent: true, opacity: p.world ? 0.4 : 0.18 }));
    scene.add(orbit);
    const count = p.world ? byBody(p.world).length : 0;
    const label = h(p.world ? 'a' : 'span', { class: `sys-label${p.world ? ' sys-world' : ''}`, href: p.world ? `#/${p.world}` : null, 'aria-hidden': p.world ? null : 'true' },
      h('span', { class: 'sys-name' }, t('body.' + p.id)),
      count ? h('span', { class: 'sys-sub' }, t('home.machines', { n: count })) : null);
    labels.append(label);
    return { ...p, mesh, group, label, orbit };
  });
  const earth = items.find((p) => p.id === 'earth');

  // the Moon, around the Earth (its distance from Earth is enlarged ~1000× to be visible)
  const moonMat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 });
  moonCanvas().then((c) => { const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; moonMat.map = tex; moonMat.needsUpdate = true; });
  const moon = new THREE.Mesh(new THREE.SphereGeometry(0.22, 40, 24), moonMat);
  scene.add(moon);
  const moonOrbitPts = [];
  for (let i = 0; i <= 90; i++) moonOrbitPts.push(new THREE.Vector3(Math.cos(i * 4 * RAD) * 1.6, 0, -Math.sin(i * 4 * RAD) * 1.6));
  const moonOrbit = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(moonOrbitPts),
    new THREE.LineBasicMaterial({ color: 0xd8d4cc, transparent: true, opacity: 0.35 }));
  scene.add(moonOrbit);
  const moonLabel = h('a', { class: 'sys-label sys-world', href: '#/moon' },
    h('span', { class: 'sys-name' }, t('body.moon')), h('span', { class: 'sys-sub' }, t('home.machines', { n: byBody('moon').length })));
  labels.append(moonLabel);
  const worlds = { mars: items.find((p) => p.id === 'mars').mesh, moon };

  // ---- time ----
  let rateIndex = 0, simMs = Date.now(), lastPlace = 0;
  function place(force = false) {
    if (!force && Math.abs(simMs - lastPlace) < 30e3) return;    // at real rate, nothing moves faster than this
    lastPlace = simMs;
    const date = new Date(simMs);
    for (const p of items) {
      const { lon, lat } = helio(A, p.body, date);
      p.group.position.copy(toScene(lon, lat, orbitR(p.au)));
    }
    const m = A.EclipticGeoMoon(date);
    moonOrbit.position.copy(earth.group.position);
    moon.position.copy(earth.group.position).add(new THREE.Vector3(Math.cos(m.lon * RAD) * 1.6, Math.sin(m.lat * RAD) * 0.4, -Math.sin(m.lon * RAD) * 1.6));
  }
  place(true);

  // ---- labels follow their bodies on screen ----
  const v = new THREE.Vector3();
  function placeLabels(w, hgt) {
    const pxPerUnit = (hgt / 2) / Math.tan((camera.fov / 2) * RAD);
    const show = (label, obj, side, radius) => {
      obj.getWorldPosition(v);
      // labels sit just outside the body's disc, however close the camera is
      label.style.setProperty('--off', `${Math.min(140, (radius / v.distanceTo(camera.position)) * pxPerUnit).toFixed(1)}px`);
      v.project(camera);
      const visible = v.z < 1 && Math.abs(v.x) < 1.2 && Math.abs(v.y) < 1.2;
      label.hidden = !visible;
      if (!visible) return;
      label.style.transform = `translate(${(v.x * 0.5 + 0.5) * w}px, ${(-v.y * 0.5 + 0.5) * hgt}px)`;
      label.classList.toggle('left', side || (v.x * 0.5 + 0.5) * w > w - 170);   // never run off the right edge
    };
    for (const p of items) show(p.label, p.group, false, p.r);
    // keep the Moon's label on the far side of the Earth's (decided before the overlap check below)
    earth.group.getWorldPosition(v); v.project(camera);
    const ex = v.x;
    moon.getWorldPosition(v); v.project(camera);
    const moonLeft = v.x < ex;
    show(moonLabel, moon, moonLeft, 0.22);
    earth.label.classList.toggle('left', !moonLeft);
    // a planet's name gives way when it would sit on top of a world we can open
    // (and among the others, the first in this list wins: Earth before its neighbours)
    const box = (l) => { const r = [...l.children].map((c) => c.getBoundingClientRect()); return { left: Math.min(...r.map((x) => x.left)), right: Math.max(...r.map((x) => x.right)), top: Math.min(...r.map((x) => x.top)), bottom: Math.max(...r.map((x) => x.bottom)) }; };
    const boxes = [moonLabel, ...items.filter((p) => p.world).map((p) => p.label)].filter((l) => !l.hidden).map(box);
    // Earth's name comes next; on a narrow screen it may still have to give way to the Moon's
    if (!earth.label.hidden) {
      const r = box(earth.label);
      const hit = boxes.some((b) => r.left < b.right + 8 && r.right > b.left - 8 && r.top < b.bottom + 4 && r.bottom > b.top - 4);
      earth.label.classList.toggle('crowded', hit);
      if (!hit) boxes.push(r);
    }
    for (const p of items.filter((q) => !q.world && q !== earth)) {
      if (p.label.hidden) continue;
      const r = box(p.label);
      const hit = boxes.some((b) => r.left < b.right + 8 && r.right > b.left - 8 && r.top < b.bottom + 4 && r.bottom > b.top - 4);
      p.label.classList.toggle('crowded', hit);
      if (!hit) boxes.push(r);
    }
  }

  // ---- camera flights ----
  let flight = null;
  const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
  function fly(getTarget, distance, ms, homeView = false) {
    return new Promise((done) => {
      const fromPos = camera.position.clone(), fromTarget = controls.target.clone();
      const dir = camera.position.clone().sub(getTarget()).normalize();
      if (homeView) dir.copy(HOME_POS).normalize();
      if (reducedMotion()) ms = 1;
      flight = { start: performance.now(), ms, done, step(k) {
        const target = getTarget();
        const endPos = target.clone().add(dir.clone().multiplyScalar(distance));
        controls.target.lerpVectors(fromTarget, target, k);
        camera.position.lerpVectors(fromPos, endPos, k);
      } };
      controls.enabled = false;
    });
  }
  const worldPos = (obj) => () => obj.getWorldPosition(new THREE.Vector3());
  // portrait screens step back so the Moon and Mars orbits still fit across
  const homeDistance = () => HOME_POS.length() * (camera.aspect < 1 ? Math.pow(Math.min(2.2, 1 / camera.aspect), 0.75) : 1);
  const flyHome = (ms = 2200) => fly(() => new THREE.Vector3(), homeDistance(), ms, true);
  /** Fly to the Moon or Mars, then let the caller change page. */
  function flyToWorld(world) {
    const obj = worlds[world];
    if (!obj) return Promise.resolve();
    controls.autoRotate = false;
    el.classList.add('flying');
    return fly(worldPos(obj), obj.geometry.parameters.radius * 7, 1700);
  }

  for (const [label, world] of [[moonLabel, 'moon'], [items.find((p) => p.world).label, 'mars']]) {
    // hold the sky still while someone aims at a world
    label.addEventListener('pointerenter', () => { controls.autoRotate = false; clearTimeout(autoTimer); });
    label.addEventListener('pointerleave', () => pauseAuto());
    label.addEventListener('focus', () => { controls.autoRotate = false; clearTimeout(autoTimer); });
    label.addEventListener('click', (e) => {
      e.preventDefault();
      flyToWorld(world).then(() => { location.hash = `#/${world}`; });
    });
  }

  // click on a planet: fly to it (the Moon and Mars open their page)
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let down = null;
  canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; pauseAuto(); });
  canvas.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) { down = null; return; }
    down = null;
    const box = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - box.left) / box.width) * 2 - 1, -((e.clientY - box.top) / box.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const targets = [moon, ...items.map((p) => p.mesh)];
    const hit = ray.intersectObjects(targets, false)[0]?.object;
    if (!hit) return;
    const world = Object.entries(worlds).find(([, o]) => o === hit)?.[0];
    if (world) { flyToWorld(world).then(() => { location.hash = `#/${world}`; }); return; }
    fly(worldPos(hit), hit.geometry.parameters.radius * 9, 1500);
  });
  canvas.addEventListener('pointermove', (e) => {
    const box = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - box.left) / box.width) * 2 - 1, -((e.clientY - box.top) / box.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    canvas.style.cursor = ray.intersectObjects([moon, ...items.map((p) => p.mesh)], false).length ? 'pointer' : '';
  });
  let autoTimer = 0;
  function pauseAuto() {
    controls.autoRotate = false;
    clearTimeout(autoTimer);
    if (!reducedMotion()) autoTimer = setTimeout(() => { controls.autoRotate = true; }, 8000);
  }
  controls.addEventListener('start', pauseAuto);
  const zoomBy = (f) => {
    pauseAuto();
    const offset = camera.position.clone().sub(controls.target).multiplyScalar(f);
    const len = Math.min(controls.maxDistance, Math.max(controls.minDistance, offset.length()));
    fly(() => controls.target.clone(), len, 500);
  };
  zoomIn.addEventListener('click', () => zoomBy(0.6));
  zoomOut.addEventListener('click', () => zoomBy(1.6));
  home.addEventListener('click', () => { pauseAuto(); flyHome(1600); });

  // ---- render loop ----
  let w = 0, hgt = 0, raf = 0, last = performance.now(), clockAt = 0;
  const observer = new ResizeObserver(() => {
    w = el.clientWidth; hgt = el.clientHeight;
    if (!w || !hgt) return;
    renderer.setSize(w, hgt, false);
    camera.aspect = w / hgt;
    camera.setViewOffset(w, hgt, shift, 0, w, hgt);
    camera.updateProjectionMatrix();
  });
  observer.observe(el);

  const api = {
    el,
    drivesClock: true,
    onTime: null,
    flyToWorld,
    get rate() { return RATES[rateIndex]; },
    cycleRate() { rateIndex = (rateIndex + 1) % RATES.length; if (rateIndex === 0) simMs = Date.now(); return RATES[rateIndex]; },
    resetRate() { rateIndex = 0; simMs = Date.now(); place(true); return RATES[0]; },
    select() {}, lookAt() {}, update() {},
    reveal: async () => {}, skipReveal() {},
    destroy() {
      cancelAnimationFrame(raf); observer.disconnect(); clearTimeout(autoTimer); controls.dispose();
      scene.traverse((o) => { o.geometry?.dispose(); const m = o.material; if (m) { m.map?.dispose(); m.dispose(); } });
      renderer.dispose();
    },
  };

  // On wide screens the home cards cover the left: centre the sky in the space that is left.
  let shift = 0;
  const shell = document.getElementById('shell');
  function frameShift() {
    const want = innerWidth >= 860 && shell?.dataset.mode === 'home' && shell.dataset.panel !== 'closed' ? -205 : 0;
    if (Math.abs(want - shift) < 0.5) return;
    shift += (want - shift) * 0.12;
    camera.setViewOffset(w, hgt, shift, 0, w, hgt);
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(100, now - last);
    last = now;
    if (document.hidden || !w) return;
    frameShift();
    simMs += dt * RATES[rateIndex].ms;
    place(rateIndex > 0);
    const still = reducedMotion();
    const spinK = still ? 0 : dt / 1000;
    for (const p of items) p.mesh.rotation.y += p.spin * spinK;
    moon.rotation.y += 0.05 * spinK;
    sun.rotation.y += 0.02 * spinK;
    if (!still) {
      const breathe = Math.sin(now / 1400);
      corona.scale.setScalar(13 + breathe * 0.6);
      halo.scale.setScalar(34 + Math.sin(now / 2300) * 1.8);
    }
    if (flight) {
      const k = Math.min(1, (now - flight.start) / flight.ms);
      flight.step(ease(k));
      if (k >= 1) { const done = flight.done; flight = null; controls.enabled = true; done(); }
    } else controls.update();
    if (flight) camera.lookAt(controls.target);
    renderer.render(scene, camera);
    placeLabels(w, hgt);
    if (api.onTime && now - clockAt > 100) { clockAt = now; api.onTime(new Date(simMs), RATES[rateIndex]); }
  }
  raf = requestAnimationFrame(frame);

  // Arrival: swoop in from far above the plane of the planets.
  // (after the first resize, so a portrait screen knows to step back)
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (reducedMotion()) { camera.position.copy(HOME_POS).setLength(homeDistance()); controls.update(); }
    else flyHome(3200);
  }));

  return api;
}

function ringTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 1;
  const g = c.getContext('2d');
  for (let x = 0; x < 256; x++) {
    const a = 0.25 + 0.5 * Math.abs(Math.sin(x * 0.11)) * (x > 120 && x < 140 ? 0.15 : 1);
    g.fillStyle = `rgba(230,211,161,${a.toFixed(3)})`;
    g.fillRect(x, 0, 1, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
