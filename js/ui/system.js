// Home stage: the Earth, the Moon and Mars in 3D (Three.js), and the trip between them.
// Small probes keep leaving the Earth for the Moon and for Mars along glowing paths.
// Click the Moon or Mars: the camera leaves the Earth and travels there, then the page opens.
// Sizes and distances are not to scale: the picture is about the journey.
import * as THREE from 'three';
import { OrbitControls } from '../../vendor/three-addons/OrbitControls.js';
import { h } from './dom.js';
import { t } from '../i18n.js';
import { byBody } from '../data.js';
import { orrery } from './space.js';
import { moonCanvas } from './moonTexture.js';

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const RAD = Math.PI / 180;

const EARTH_R = 2, MOON_R = 0.55, MARS_R = 1.25;
const MOON_ORBIT = 6.2;
const MOON_PERIOD = 80;                                  // seconds for one trip around the Earth
const MARS_POS = new THREE.Vector3(24, 2.5, -17);
const HOME_TARGET = new THREE.Vector3(10, 1.5, -6);   // between the Earth and Mars
const HOME_OFFSET = new THREE.Vector3(-12, 7, 26);        // camera, seen from the target

function glowTexture(inner, outer) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, inner); grad.addColorStop(0.3, outer); grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const glowSprite = (tex, size, opacity = 1) => {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity, toneMapped: false }));
  s.scale.setScalar(size);
  return s;
};

export function createSystem() {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch {
    // No WebGL: keep a flat animated sky so the home page still moves.
    const flat = orrery();
    const el = h('div', { class: 'system system-flat', role: 'img', 'aria-label': t('system.label') }, flat.el);
    return { el, select() {}, lookAt() {}, update() {}, reveal: async () => {}, skipReveal() {}, destroy: flat.destroy, flyToWorld: async () => {} };
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  const canvas = renderer.domElement;
  canvas.classList.add('system-canvas');
  canvas.setAttribute('aria-hidden', 'true');

  const labels = h('div', { class: 'sys-labels' });
  const zoomIn = h('button', { type: 'button', class: 'sys-btn', 'aria-label': t('system.zoomIn') }, '+');
  const zoomOut = h('button', { type: 'button', class: 'sys-btn', 'aria-label': t('system.zoomOut') }, '−');
  const homeBtn = h('button', { type: 'button', class: 'sys-btn', 'aria-label': t('system.reset') }, '⟲');
  const scaleNote = h('p', { class: 'sys-note' }, t('system.notToScale'));
  const el = h('div', { class: 'system', role: 'group', 'aria-label': t('system.label') },
    canvas, labels, h('div', { class: 'sys-controls' }, zoomIn, zoomOut, homeBtn), scaleNote);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 1000);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan = false;
  controls.minDistance = 3;
  controls.maxDistance = 90;
  controls.rotateSpeed = 0.6;
  controls.autoRotate = !reducedMotion();
  controls.autoRotateSpeed = 0.22;
  controls.target.copy(HOME_TARGET);

  // No Sun on screen: the light comes from one side, so each world shows a lit face and a night side.
  scene.add(new THREE.AmbientLight(0x5868a0, 0.28));
  const light = new THREE.DirectionalLight(0xfff3e2, 3);
  light.position.set(-30, 12, 22);
  scene.add(light);

  const loader = new THREE.TextureLoader();
  const loadInto = (mat, src) => loader.load(src, (tex) => { tex.colorSpace = THREE.SRGBColorSpace; mat.map = tex; mat.needsUpdate = true; });

  // ---- the Earth ----
  const earthMat = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0 });
  loadInto(earthMat, 'assets/maps/earth.jpg');
  const earth = new THREE.Mesh(new THREE.SphereGeometry(EARTH_R, 64, 48), earthMat);
  earth.rotation.z = 23.4 * RAD;
  const earthAtmo = new THREE.Mesh(new THREE.SphereGeometry(EARTH_R * 1.025, 64, 48),
    new THREE.MeshBasicMaterial({ color: 0x6fb4ff, transparent: true, opacity: 0.12, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false }));
  const earthGlow = glowSprite(glowTexture('rgba(120,180,255,.55)', 'rgba(60,120,255,.18)'), EARTH_R * 5.2, 0.8);
  scene.add(earth, earthAtmo, earthGlow);

  // ---- the Moon, going round the Earth ----
  const moonMat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 });
  moonCanvas().then((c) => { const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; moonMat.map = tex; moonMat.needsUpdate = true; });
  const moon = new THREE.Mesh(new THREE.SphereGeometry(MOON_R, 48, 32), moonMat);
  const moonGlow = glowSprite(glowTexture('rgba(235,232,225,.35)', 'rgba(200,200,210,.08)'), MOON_R * 4.5, 0.7);
  scene.add(moon, moonGlow);
  const ringPts = [];
  for (let i = 0; i <= 120; i++) ringPts.push(new THREE.Vector3(Math.cos(i * 3 * RAD) * MOON_ORBIT, 0, -Math.sin(i * 3 * RAD) * MOON_ORBIT));
  const moonRing = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(ringPts),
    new THREE.LineBasicMaterial({ color: 0xd8d4cc, transparent: true, opacity: 0.22 }));
  moonRing.rotation.x = 5 * RAD;
  scene.add(moonRing);
  let moonAngle = 35 * RAD;
  const moonAt = (a, out = new THREE.Vector3()) => out.set(Math.cos(a) * MOON_ORBIT, 0, -Math.sin(a) * MOON_ORBIT).applyAxisAngle(new THREE.Vector3(1, 0, 0), 5 * RAD);

  // ---- Mars, far away ----
  const marsMat = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0 });
  loadInto(marsMat, 'assets/maps/mars.jpg');
  const mars = new THREE.Mesh(new THREE.SphereGeometry(MARS_R, 64, 48), marsMat);
  mars.position.copy(MARS_POS);
  mars.rotation.z = 25 * RAD;
  const marsAtmo = new THREE.Mesh(new THREE.SphereGeometry(MARS_R * 1.025, 64, 48),
    new THREE.MeshBasicMaterial({ color: 0xff8a5c, transparent: true, opacity: 0.1, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false }));
  marsAtmo.position.copy(MARS_POS);
  const marsGlow = glowSprite(glowTexture('rgba(255,150,100,.5)', 'rgba(255,100,60,.14)'), MARS_R * 5, 0.75);
  marsGlow.position.copy(MARS_POS);
  scene.add(mars, marsAtmo, marsGlow);

  // ---- the routes: an arc from the Earth to each world ----
  const UP = new THREE.Vector3(0, 1, 0);
  function route(to, lift) {
    const from = new THREE.Vector3();
    const mid = to.clone().multiplyScalar(0.5).addScaledVector(UP, lift);
    // leave from the Earth's surface, on the side facing the destination
    from.copy(mid).normalize().multiplyScalar(EARTH_R * 1.05);
    const end = to.clone().addScaledVector(from.clone().sub(to).normalize(), 0.01);
    return new THREE.QuadraticBezierCurve3(from, mid, end);
  }
  const SEGMENTS = 96;
  function routeLine(color, opacity) {
    const geo = new THREE.BufferGeometry().setFromPoints(new Array(SEGMENTS + 1).fill(0).map(() => new THREE.Vector3()));
    const line = new THREE.Line(geo, new THREE.LineDashedMaterial({ color, transparent: true, opacity, dashSize: 0.35, gapSize: 0.25, depthWrite: false }));
    scene.add(line);
    return line;
  }
  const setLine = (line, curve) => {
    const pos = line.geometry.attributes.position;
    for (let i = 0; i <= SEGMENTS; i++) { const p = curve.getPoint(i / SEGMENTS); pos.setXYZ(i, p.x, p.y, p.z); }
    pos.needsUpdate = true;
    line.computeLineDistances();
    line.geometry.computeBoundingSphere();
  };
  const marsRoute = route(MARS_POS.clone().addScaledVector(MARS_POS.clone().normalize(), -MARS_R), 7);
  const marsLine = routeLine(0xff9a70, 0.5);
  setLine(marsLine, marsRoute);
  let moonRoute = route(moonAt(moonAngle), 2.2);
  const moonLine = routeLine(0xcfd8ff, 0.45);

  // probes: a bright head and a fading tail that run along a route, again and again
  const probeTex = glowTexture('rgba(255,255,255,1)', 'rgba(140,200,255,.5)');
  function probe(color, size, period, offset) {
    const parts = [];
    for (let i = 0; i < 9; i++) {
      const s = glowSprite(probeTex, size * (1 - i * 0.09), 1 - i * 0.11);
      s.material.color = new THREE.Color(color);
      scene.add(s);
      parts.push(s);
    }
    return { parts, period, offset };
  }
  const marsProbes = [probe(0xffc4a0, 0.9, 9, 0), probe(0xffc4a0, 0.7, 9, 0.5)];
  const moonProbes = [probe(0xd6e4ff, 0.7, 4.5, 0.2)];
  function runProbes(list, curve, time) {
    for (const p of list) {
      const k = ((time / p.period + p.offset) % 1 + 1) % 1;
      const fade = Math.min(1, k * 8, (1 - k) * 8);                // appear at launch, vanish on arrival
      p.parts.forEach((s, i) => {
        const at = Math.max(0, k - i * 0.012);
        s.position.copy(curve.getPoint(at));
        s.material.opacity = (1 - i * 0.11) * fade;
      });
    }
  }

  // ---- labels ----
  const label = (world, name) => {
    const n = world ? byBody(world).length : 0;
    const l = h(world ? 'a' : 'span', { class: `sys-label${world ? ' sys-world' : ''}`, href: world ? `#/${world}` : null, 'aria-hidden': world ? null : 'true' },
      h('span', { class: 'sys-name' }, t('body.' + name)),
      n ? h('span', { class: 'sys-sub' }, t('home.machines', { n })) : null);
    labels.append(l);
    return l;
  };
  const earthLabel = label(null, 'earth');
  const moonLabel = label('moon', 'moon');
  const marsLabel = label('mars', 'mars');

  const v = new THREE.Vector3();
  function placeLabels(w, hgt) {
    const pxPerUnit = (hgt / 2) / Math.tan((camera.fov / 2) * RAD);
    const screenX = (obj) => { obj.getWorldPosition(v); v.project(camera); return v.x; };
    const show = (l, obj, radius, left) => {
      obj.getWorldPosition(v);
      l.style.setProperty('--off', `${Math.min(160, (radius / v.distanceTo(camera.position)) * pxPerUnit).toFixed(1)}px`);
      v.project(camera);
      const visible = v.z < 1 && Math.abs(v.x) < 1.2 && Math.abs(v.y) < 1.2;
      l.hidden = !visible;
      if (!visible) return;
      const x = (v.x * 0.5 + 0.5) * w;
      l.style.transform = `translate(${x}px, ${(-v.y * 0.5 + 0.5) * hgt}px)`;
      l.classList.toggle('left', (left || x > w - 170) && x > 170);   // never run off either edge
    };
    // the Moon's name sits on the far side from the Earth's
    const moonLeft = screenX(moon) < screenX(earth);
    show(earthLabel, earth, EARTH_R, !moonLeft);
    show(moonLabel, moon, MOON_R, moonLeft);
    show(marsLabel, mars, MARS_R, false);
  }

  // ---- camera flights ----
  let flight = null;
  const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
  /** Move the camera along `path` (a curve, or a start and end) while it turns to look at `look()`. */
  function fly({ path, look, ms }) {
    return new Promise((done) => {
      const fromTarget = controls.target.clone();
      if (reducedMotion()) ms = 1;
      flight = { start: performance.now(), ms, done, step(k) {
        camera.position.copy(path.getPoint(k));
        controls.target.lerpVectors(fromTarget, look(), Math.min(1, k * 1.4));
      } };
      controls.enabled = false;
    });
  }
  const line2 = (a, b) => new THREE.LineCurve3(a.clone(), b.clone());
  const homeDistance = () => HOME_OFFSET.length() * (camera.aspect < 1 ? Math.pow(Math.min(2.2, 1 / camera.aspect), 0.75) : 1);
  const homeTarget = () => (camera.aspect < 1 ? HOME_TARGET.clone().multiplyScalar(0.7) : HOME_TARGET.clone());
  const homePos = () => homeTarget().add(HOME_OFFSET.clone().setLength(homeDistance()));
  const flyHome = (ms = 2200) => fly({ path: line2(camera.position, homePos()), look: homeTarget, ms });

  const worlds = { moon, mars };
  let orbitPaused = false;
  /** The trip: back to the Earth, lift off, follow the route to the Moon or Mars. Then the caller opens its page. */
  function flyToWorld(world) {
    const obj = worlds[world];
    if (!obj) return Promise.resolve();
    controls.autoRotate = false;
    orbitPaused = true;
    el.classList.add('flying');
    const dest = obj.position.clone();
    const r = obj.geometry.parameters.radius;
    const curve = world === 'mars' ? marsRoute : moonRoute;
    // just behind the Earth, looking along the way out
    const launch = curve.getPoint(0).clone().addScaledVector(curve.getPoint(0).clone().sub(dest).normalize(), EARTH_R * 1.6).addScaledVector(UP, 1.2);
    const back = curve.getPoint(0.82).clone().sub(dest); back.y *= 0.15;
    const arrive = dest.clone().addScaledVector(back.normalize(), r * 6).addScaledVector(UP, r * 0.5);
    const path = new THREE.CatmullRomCurve3([camera.position.clone(), launch, curve.getPoint(0.35).clone().addScaledVector(UP, 1), curve.getPoint(0.7).clone().addScaledVector(UP, 0.6), arrive], false, 'centripetal');
    return fly({ path, look: () => dest, ms: world === 'mars' ? 3600 : 2600 });
  }

  for (const [l, world] of [[moonLabel, 'moon'], [marsLabel, 'mars']]) {
    // hold the sky still while someone aims at a world
    l.addEventListener('pointerenter', () => { controls.autoRotate = false; clearTimeout(autoTimer); });
    l.addEventListener('pointerleave', () => pauseAuto());
    l.addEventListener('focus', () => { controls.autoRotate = false; clearTimeout(autoTimer); });
    l.addEventListener('click', (e) => {
      e.preventDefault();
      flyToWorld(world).then(() => { location.hash = `#/${world}`; });
    });
  }

  // click a world: the Moon and Mars start the trip, the Earth comes closer
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const pick = (e) => {
    const box = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - box.left) / box.width) * 2 - 1, -((e.clientY - box.top) / box.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.intersectObjects([earth, moon, mars], false)[0]?.object;
  };
  let down = null;
  canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; pauseAuto(); });
  canvas.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) { down = null; return; }
    down = null;
    const hit = pick(e);
    if (!hit) return;
    const world = Object.entries(worlds).find(([, o]) => o === hit)?.[0];
    if (world) { flyToWorld(world).then(() => { location.hash = `#/${world}`; }); return; }
    const end = earth.position.clone().add(camera.position.clone().sub(earth.position).setLength(EARTH_R * 4.5));
    fly({ path: line2(camera.position, end), look: () => earth.position, ms: 1500 });
  });
  canvas.addEventListener('pointermove', (e) => { canvas.style.cursor = pick(e) ? 'pointer' : ''; });

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
    offset.setLength(Math.min(controls.maxDistance, Math.max(controls.minDistance, offset.length())));
    const target = controls.target.clone();
    fly({ path: line2(camera.position, target.clone().add(offset)), look: () => target, ms: 500 });
  };
  zoomIn.addEventListener('click', () => zoomBy(0.6));
  zoomOut.addEventListener('click', () => zoomBy(1.6));
  homeBtn.addEventListener('click', () => { pauseAuto(); flyHome(1600); });

  // ---- render loop ----
  let w = 0, hgt = 0, raf = 0, last = performance.now(), clock = 0;
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
    flyToWorld,
    select() {}, lookAt() {}, update() {},
    reveal: async () => {}, skipReveal() {},
    destroy() {
      cancelAnimationFrame(raf); observer.disconnect(); clearTimeout(autoTimer); controls.dispose();
      scene.traverse((o) => { o.geometry?.dispose(); const m = o.material; if (m) { m.map?.dispose(); m.dispose(); } });
      renderer.dispose();
    },
  };

  // On wide screens the home cards cover the left: centre the scene in the space that is left.
  let shift = 0;
  const shell = document.getElementById('shell');
  function frameShift() {
    const want = innerWidth >= 860 && shell?.dataset.mode === 'home' && shell.dataset.panel !== 'closed' ? -205 : 0;
    if (Math.abs(want - shift) < 0.5) return;
    shift += (want - shift) * 0.12;
    camera.setViewOffset(w, hgt, shift, 0, w, hgt);
  }

  const moonPos = new THREE.Vector3();
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(100, now - last) / 1000;
    last = now;
    if (document.hidden || !w) return;
    frameShift();
    const still = reducedMotion();
    const k = still ? 0 : dt;
    clock += k;
    earth.rotation.y += 0.12 * k;
    mars.rotation.y += 0.11 * k;
    if (!orbitPaused) moonAngle += (Math.PI * 2 / MOON_PERIOD) * k;
    moon.position.copy(moonAt(moonAngle, moonPos));
    moon.rotation.y = -moonAngle + Math.PI / 2;              // the same face always turned to the Earth
    moonGlow.position.copy(moon.position);
    moonRoute = route(moon.position.clone().addScaledVector(moon.position.clone().normalize(), -MOON_R), 2.2);
    setLine(moonLine, moonRoute);
    const travelling = !!flight && orbitPaused;
    for (const p of [...marsProbes, ...moonProbes]) p.parts.forEach((sp) => { sp.visible = !still && !travelling; });
    if (travelling) { marsLine.material.opacity *= 0.9; moonLine.material.opacity *= 0.9; }
    else if (!still) {
      marsLine.material.opacity = 0.38 + Math.sin(now / 900) * 0.12;
      moonLine.material.opacity = 0.34 + Math.sin(now / 700 + 1) * 0.1;
      earthGlow.material.opacity = 0.72 + Math.sin(now / 1600) * 0.1;
      runProbes(marsProbes, marsRoute, clock);
      runProbes(moonProbes, moonRoute, clock);
    }
    if (flight) {
      const f = Math.min(1, Math.max(0, (now - flight.start) / flight.ms));   // rAF time can lag the click
      flight.step(ease(f));
      camera.lookAt(controls.target);
      if (f >= 1) { const done = flight.done; flight = null; controls.enabled = true; done(); }
    } else controls.update();
    renderer.render(scene, camera);
    placeLabels(w, hgt);
  }

  // Arrival: start close to the Earth, then pull back until the Moon and Mars come into view.
  camera.position.set(-3.5, 1.5, 6.5);
  controls.target.copy(earth.position);
  camera.lookAt(earth.position);
  raf = requestAnimationFrame(frame);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (reducedMotion()) { camera.position.copy(homePos()); controls.target.copy(homeTarget()); controls.update(); }
    else flyHome(4200);
  }));

  return api;
}
