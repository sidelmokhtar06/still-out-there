// Landing page (#/): a full-screen welcome before the map. A huge Moon turns in the lower
// right, Mars glows and turns in the distance, a small orbiter circles the Moon, and the scene
// leans with the pointer. Over it: the title, two live distances and the way in.
// Scroll down, swipe up, press Enter or use the button to open the map.
import * as THREE from 'three';
import { h } from './dom.js';
import { t } from '../i18n.js';
import { byBody } from '../data.js';
import { moonCanvas } from './moonTexture.js';

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const KM_PER_AU = 149597870.7;
const number = new Intl.NumberFormat('en-US');

function glowTexture(stops) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  for (const [at, col] of stops) grad.addColorStop(at, col);
  g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** The stage: Three.js scene, or two CSS worlds when WebGL is not available. */
export function createLanding() {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch { renderer = null; }
  if (!renderer) {
    const el = h('div', { class: 'landing landing-flat', 'aria-hidden': 'true' },
      h('span', { class: 'sphere sphere-moon flat-moon' }), h('span', { class: 'sphere sphere-mars flat-mars' }));
    return { el, select() {}, lookAt() {}, update() {}, reveal: async () => {}, skipReveal() {}, destroy() {} };
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;           // keep the Moon's greys neutral and bright
  const canvas = renderer.domElement;
  canvas.classList.add('landing-canvas');
  const el = h('div', { class: 'landing', 'aria-hidden': 'true' }, canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
  camera.position.set(0, 0, 16);

  // light: a low Sun from the left makes long crater shadows along the terminator
  const sunLight = new THREE.DirectionalLight(0xfff6ec, 2.6);
  sunLight.position.set(-10, 3, 4);
  scene.add(sunLight, new THREE.AmbientLight(0x8090b0, 0.14));
  const rim = new THREE.DirectionalLight(0x7fa8ff, 0.5);                 // cool edge light from behind
  rim.position.set(6, 2, -8);
  scene.add(rim);

  // the Moon, big and close
  const moonMat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, color: 0xffffff });
  moonCanvas().then((c) => {
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    moonMat.map = tex;
    moonMat.needsUpdate = true;
  });
  // relief from the original (unretouched) map, so it is soft and follows the real albedo
  new THREE.TextureLoader().load('assets/maps/moon.jpg', (tex) => { moonMat.bumpMap = tex; moonMat.bumpScale = 0.9; moonMat.needsUpdate = true; });
  const moon = new THREE.Mesh(new THREE.SphereGeometry(5, 128, 96), moonMat);
  moon.rotation.set(0.15, -1.2, 0);
  const moonGroup = new THREE.Group();
  moonGroup.add(moon);
  scene.add(moonGroup);

  // a little orbiter circling the Moon, with its faint path
  const orbitPivot = new THREE.Group();
  orbitPivot.rotation.set(1.2, 0, -0.35);
  const sat = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture([[0, 'rgba(255,255,255,1)'], [0.2, 'rgba(170,215,255,.8)'], [1, 'rgba(120,180,255,0)']]), blending: THREE.AdditiveBlending, depthWrite: false }));
  sat.scale.setScalar(0.55);
  sat.position.set(6.4, 0, 0);
  orbitPivot.add(sat);
  const ringPts = [];
  for (let i = 0; i <= 128; i++) ringPts.push(new THREE.Vector3(Math.cos(i / 128 * Math.PI * 2) * 6.4, Math.sin(i / 128 * Math.PI * 2) * 6.4, 0));
  orbitPivot.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(ringPts), new THREE.LineBasicMaterial({ color: 0x9fc4ff, transparent: true, opacity: 0.22 })));
  moonGroup.add(orbitPivot);

  // Mars, far behind, with a dusty glow
  const marsMat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 });
  new THREE.TextureLoader().load('assets/maps/mars.jpg', (tex) => { tex.colorSpace = THREE.SRGBColorSpace; marsMat.map = tex; marsMat.needsUpdate = true; });
  const mars = new THREE.Mesh(new THREE.SphereGeometry(1.25, 64, 48), marsMat);
  const marsGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture([[0.42, 'rgba(255,150,100,.0)'], [0.5, 'rgba(255,140,90,.45)'], [1, 'rgba(255,120,70,0)']]), blending: THREE.AdditiveBlending, depthWrite: false }));
  marsGlow.scale.setScalar(4.2);
  const marsGroup = new THREE.Group();
  marsGroup.add(marsGlow, mars);
  scene.add(marsGroup);

  // a far Sun flare on the left edge, the source of the light
  const flare = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture([[0, 'rgba(255,248,230,.95)'], [0.12, 'rgba(255,214,150,.5)'], [1, 'rgba(255,170,90,0)']]), blending: THREE.AdditiveBlending, depthWrite: false }));
  flare.scale.setScalar(16);
  scene.add(flare);

  // layout: wide screens put the Moon lower right; tall screens put it at the bottom
  let w = 0, hgt = 0, portrait = false;
  function layout() {
    w = el.clientWidth; hgt = el.clientHeight;
    if (!w || !hgt) return;
    renderer.setSize(w, hgt, false);
    camera.aspect = w / hgt;
    camera.updateProjectionMatrix();
    portrait = w / hgt < 0.9;
    if (portrait) {
      moonGroup.position.set(0.8, -8.7, 0); moonGroup.scale.setScalar(1);
      marsGroup.position.set(3.3, 4.9, -7); flare.position.set(-7, 9, -20);
    } else {
      moonGroup.position.set(6.2, -3.9, 0); moonGroup.scale.setScalar(1);
      marsGroup.position.set(6.5, 6.6, -12); flare.position.set(-22, 8, -30);
    }
  }
  const observer = new ResizeObserver(layout);
  observer.observe(el);

  // the scene leans gently toward the pointer
  const lean = { x: 0, y: 0, tx: 0, ty: 0 };
  const onMove = (e) => { lean.tx = (e.clientX / innerWidth - 0.5) * 2; lean.ty = (e.clientY / innerHeight - 0.5) * 2; };
  addEventListener('pointermove', onMove);

  let raf = 0, last = performance.now();
  const t0 = performance.now();
  const ease = (k) => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(100, now - last) / 1000;
    last = now;
    if (document.hidden || !w) return;
    const still = reducedMotion();
    if (!still) {
      moon.rotation.y += dt * 0.045;
      mars.rotation.y += dt * 0.16;
      orbitPivot.rotation.z += dt * 0.32;
      marsGroup.position.y += Math.sin(now / 2400) * dt * 0.08;      // Mars drifts a little
      flare.material.opacity = 0.85 + Math.sin(now / 1700) * 0.15;
    }
    // arrival: the Moon rises into place, Mars fades in after it
    const k = still ? 1 : ease((now - t0) / 2600);
    moon.position.set(0, (1 - k) * -6, 0);
    moon.scale.setScalar(0.75 + 0.25 * k);
    const km = still ? 1 : ease((now - t0 - 700) / 2200);
    mars.scale.setScalar(Math.max(0.001, km)); marsGlow.material.opacity = km;
    lean.x += (lean.tx - lean.x) * 0.04; lean.y += (lean.ty - lean.y) * 0.04;
    camera.position.x = still ? 0 : lean.x * 0.9;
    camera.position.y = still ? 0 : -lean.y * 0.6;
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
  }
  raf = requestAnimationFrame(frame);

  return {
    el,
    select() {}, lookAt() {}, update() {},
    reveal: async () => {}, skipReveal() {},
    destroy() {
      cancelAnimationFrame(raf); observer.disconnect(); removeEventListener('pointermove', onMove);
      scene.traverse((o) => { o.geometry?.dispose(); const m = o.material; if (m) { m.map?.dispose(); m.bumpMap?.dispose(); m.dispose(); } });
      renderer.dispose();
    },
  };
}

/** The words over the landing scene. */
export function landingPanel() {
  const words = (text, cls) => h('span', { class: cls }, ...text.split(' ').map((wd, i) => h('span', { class: 'word', style: `--i:${i}` }, wd, ' ')));
  const moonKm = h('span', { class: 'stat-num' }), marsKm = h('span', { class: 'stat-num' });
  const enter = h('a', { class: 'action landing-enter', href: '#/map' }, t('landing.enter'), h('span', { 'aria-hidden': 'true' }, ' →'));
  const el = h('div', { class: 'pane pane-landing' },
    h('p', { class: 'landing-kicker' }, t('landing.kicker')),
    h('h1', { tabindex: '-1', class: 'landing-title' }, words(t('landing.line1'), 'line'), words(t('landing.line2'), 'line line-2')),
    h('p', { class: 'landing-lead' }, t('landing.lead', { moon: byBody('moon').length, mars: byBody('mars').length })),
    h('div', { class: 'landing-actions' },
      enter,
      h('a', { class: 'action ghost', href: '#/rollcall' }, t('rollcall.start'))),
    h('dl', { class: 'landing-stats' },
      h('div', {}, h('dt', {}, t('landing.toMoon')), h('dd', {}, moonKm, h('span', { class: 'stat-unit' }, ' km'))),
      h('div', {}, h('dt', {}, t('landing.toMars')), h('dd', {}, marsKm, h('span', { class: 'stat-unit' }, ' km'))),
      h('div', {}, h('dt', {}, t('landing.machines')), h('dd', {}, h('span', { class: 'stat-num' }, String(byBody('moon').length + byBody('mars').length))))),
    h('a', { class: 'landing-scroll', href: '#/map', 'aria-label': t('landing.enter') }, h('span', { class: 'scroll-line' }), t('landing.scroll')));

  // Scroll down or swipe up anywhere: go in.
  let leaving = false, touchY = null;
  const go = () => { if (leaving) return; leaving = true; location.hash = '#/map'; };
  const onWheel = (e) => { if (e.deltaY > 30) go(); };
  const onTouchStart = (e) => { touchY = e.touches[0].clientY; };
  const onTouchEnd = (e) => { if (touchY != null && touchY - e.changedTouches[0].clientY > 60) go(); touchY = null; };
  addEventListener('wheel', onWheel, { passive: true });
  addEventListener('touchstart', onTouchStart, { passive: true });
  addEventListener('touchend', onTouchEnd, { passive: true });

  // live distances, counted up on arrival
  const A = globalThis.Astronomy;
  const dist = (now) => {
    const m = A.GeoMoon(A.MakeTime(now)), r = A.GeoVector(A.Body.Mars, now, true);
    return [Math.hypot(m.x, m.y, m.z) * KM_PER_AU, Math.hypot(r.x, r.y, r.z) * KM_PER_AU];
  };
  const start = performance.now();
  let raf = 0;
  const count = () => {
    const k = reducedMotion() ? 1 : Math.min(1, (performance.now() - start - 900) / 1800);
    const e = k <= 0 ? 0 : 1 - Math.pow(1 - k, 4);
    const [mo, ma] = dist(new Date());
    moonKm.textContent = number.format(Math.round(mo * e));
    marsKm.textContent = number.format(Math.round(ma * e));
    if (k < 1) raf = requestAnimationFrame(count);
  };
  raf = requestAnimationFrame(count);

  return {
    el, title: t('landing.title'),
    tick(now) {
      if (performance.now() - start < 2800) return;
      const [mo, ma] = dist(now);
      moonKm.textContent = number.format(Math.round(mo));
      marsKm.textContent = number.format(Math.round(ma));
    },
    destroy() {
      cancelAnimationFrame(raf);
      removeEventListener('wheel', onWheel); removeEventListener('touchstart', onTouchStart); removeEventListener('touchend', onTouchEnd);
    },
  };
}
