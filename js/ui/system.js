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
  { id: 'mercury', body: 'Mercury', au: 0.387, r: 0.32, tex: ['#8c8580', '#b9b2a6', '#6f6a64'], spin: 0.05 },
  { id: 'venus', body: 'Venus', au: 0.723, r: 0.55, tex: ['#e8cf9a', '#d9b77a', '#f2deb0'], spin: -0.03 },
  { id: 'earth', body: 'Earth', au: 1, r: 0.62, tex: 'earth', spin: 0.25 },
  { id: 'mars', body: 'Mars', au: 1.524, r: 0.5, map: 'assets/maps/mars.jpg', spin: 0.24, world: 'mars', glow: 0xff8a5c },
  { id: 'jupiter', body: 'Jupiter', au: 5.2, r: 1.7, tex: ['#d9b58c', '#b98c62', '#efe0c4', '#a8764e'], spin: 0.6 },
  { id: 'saturn', body: 'Saturn', au: 9.58, r: 1.45, tex: ['#e6d3a1', '#cdb07a', '#f1e6c8'], spin: 0.55, ring: true },
  { id: 'uranus', body: 'Uranus', au: 19.2, r: 0.95, tex: ['#9fe0e6', '#8cd0d8', '#b5ecef'], spin: 0.35 },
  { id: 'neptune', body: 'Neptune', au: 30.1, r: 0.92, tex: ['#5b7cf0', '#6f8dff', '#4a66d6'], spin: 0.36 },
];
export const RATES = [
  { ms: 1, key: 'timebar.rate' },             // real time
  { ms: 3600, key: 'timebar.rate.hour' },     // 1 hour per second
  { ms: 86400, key: 'timebar.rate.day' },     // 1 day per second
  { ms: 604800, key: 'timebar.rate.week' },   // 1 week per second
];

/** Banded or speckled surface drawn on a canvas, for planets without a map in the repo. */
function paintTexture(kind) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  if (kind === 'sun') {                       // granulation: warm base, many small bright cells
    g.fillStyle = '#ffc95a'; g.fillRect(0, 0, 512, 256);
    for (let i = 0; i < 2600; i++) {
      g.fillStyle = rnd() < 0.5 ? 'rgba(255,240,190,.55)' : 'rgba(255,170,60,.35)';
      g.beginPath(); g.arc(rnd() * 512, rnd() * 256, 1 + rnd() * 3.5, 0, Math.PI * 2); g.fill();
    }
  } else if (kind === 'earth') {
    g.fillStyle = '#1d4f91'; g.fillRect(0, 0, 512, 256);
    for (let i = 0; i < 70; i++) {          // land blobs
      const x = rnd() * 512, y = 40 + rnd() * 176, r = 6 + rnd() * 26;
      g.fillStyle = rnd() < 0.6 ? '#3f7d3a' : '#9b8556';
      g.beginPath(); g.ellipse(x, y, r * 1.6, r, rnd() * 3, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = '#eef4ff'; g.fillRect(0, 0, 512, 18); g.fillRect(0, 238, 512, 18);
    g.globalAlpha = 0.35;
    for (let i = 0; i < 90; i++) { g.fillStyle = '#fff'; g.beginPath(); g.ellipse(rnd() * 512, rnd() * 256, 10 + rnd() * 30, 3 + rnd() * 5, 0, 0, Math.PI * 2); g.fill(); }
  } else {
    for (let y = 0; y < 256; y++) {
      const band = Math.sin(y * 0.09 + Math.sin(y * 0.021) * 3) * 0.5 + 0.5;
      const col = kind[Math.floor((band * 0.999 + rnd() * 0.15) * kind.length) % kind.length];
      g.fillStyle = col; g.fillRect(0, y, 512, 1);
    }
    g.globalAlpha = 0.18;
    for (let i = 0; i < 400; i++) { g.fillStyle = rnd() < 0.5 ? '#000' : '#fff'; g.fillRect(rnd() * 512, rnd() * 256, 2 + rnd() * 30, 1 + rnd() * 2); }
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
    // a planet's name gives way when it would sit on top of a world we can open
    // (and among the others, the first in this list wins: Earth before its neighbours)
    const box = (l) => { const r = [...l.children].map((c) => c.getBoundingClientRect()); return { left: Math.min(...r.map((x) => x.left)), right: Math.max(...r.map((x) => x.right)), top: Math.min(...r.map((x) => x.top)), bottom: Math.max(...r.map((x) => x.bottom)) }; };
    const boxes = [moonLabel, ...items.filter((p) => p.world).map((p) => p.label)].filter((l) => !l.hidden).map(box);
    for (const p of [earth, ...items.filter((q) => !q.world && q !== earth)]) {
      if (p.label.hidden) continue;
      const r = box(p.label);
      const hit = boxes.some((b) => r.left < b.right + 8 && r.right > b.left - 8 && r.top < b.bottom + 4 && r.bottom > b.top - 4);
      p.label.classList.toggle('crowded', hit);
      if (!hit) boxes.push(r);
    }
    // keep the Moon's label on the far side of the Earth's
    earth.group.getWorldPosition(v); v.project(camera);
    const ex = v.x;
    moon.getWorldPosition(v); v.project(camera);
    const moonLeft = v.x < ex;
    show(moonLabel, moon, moonLeft, 0.22);
    earth.label.classList.toggle('left', !moonLeft);
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
