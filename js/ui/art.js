// Line drawings of the ten machines. Original artwork for this project: simplified, not
// to scale, drawn in one stroke style. viewBox is 160 x 120; ground line at y = 106.
import { s } from './dom.js';

const GROUND = 'M6 106H154';

// The retroreflector's grid of corner cubes, laid out on its tilted panel.
function prisms() {
  const A = [50, 30], B = [118, 38], C = [110, 88], D = [42, 80], out = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
    const u = (c + 0.5) / 4, v = (r + 0.5) / 4;
    const x = (A[0] + (B[0] - A[0]) * u) * (1 - v) + (D[0] + (C[0] - D[0]) * u) * v;
    const y = (A[1] + (B[1] - A[1]) * u) * (1 - v) + (D[1] + (C[1] - D[1]) * u) * v;
    out.push([x, y, 4.5]);
  }
  return out;
}

const ART = {
  eagle: { ground: true, paths: [
    'M52 48h56l8 10v18l-8 8H52l-8-8V58Z', 'M52 48v36M108 48v36M80 48v36', 'M60 48v-7h40v7',
    'M72 84l-5 14h26l-5-14', 'M44 62 22 102M44 78 22 102M14 104h16', 'M116 62l22 40M116 78l22 24M130 104h16',
    'M30 86l-6 16M33 92h-6M35 98h-8' ] },
  lrv: { ground: true, paths: [
    'M28 78h104', 'M24 82a16 16 0 0 1 32 0M104 82a16 16 0 0 1 32 0', 'M54 78V62h9', 'M72 78V58M72 68h13v10',
    'M90 78V58M90 68h13v10', 'M44 78V30M28 28q16-13 32 0ZM44 28v-6', 'M118 78V54h10v7h-10', 'M130 78V44',
    'M40 78v14M120 78v14' ],
    circles: [[40, 92, 14], [40, 92, 5], [120, 92, 14], [120, 92, 5]] },
  retro: { ground: true, paths: ['M50 30l68 8-8 50-68-8Z', 'M46 81l-8 25M106 88l8 18'], circles: prisms() },
  surveyor3: { ground: true, paths: [
    'M56 78h48L80 60Z', 'M56 78 34 102M26 104h16', 'M104 78l22 24M118 104h16', 'M80 78v24M72 104h16',
    'M80 60V30', 'M46 14l32 8-4 16-32-8Z', 'M84 22l32-8 4 16-32 8Z', 'M100 76l12-8 10 10 10-6 4 8', 'M66 70V58h8' ] },
  sojourner: { ground: true, paths: [
    'M36 56h88v7H36Z', 'M44 63h72v12H44Z', 'M48 94l16-16 16 16M64 78h36l12 16', 'M112 56V24', 'M116 66h9v6h-9',
    'M52 56V63M68 56v7M84 56v7M100 56v7' ],
    circles: [[48, 94, 10], [80, 94, 10], [112, 94, 10]] },
  opportunity: { ground: true, paths: [
    'M24 60h112l-14 8H38Z', 'M54 68h52v8H54Z', 'M62 60V30', 'M51 20h22v10H51Z',
    'M44 94l16-18 20 18M60 76l40-3 16 21', 'M106 72l18 5-4 13', 'M98 60V48M90 46a8 8 0 0 1 16 0Z' ],
    circles: [[44, 94, 11], [80, 94, 11], [116, 94, 11], [57, 25, 1.6], [67, 25, 1.6]] },
  ingenuity: { ground: true, paths: [
    'M70 62h20v20H70Z', 'M70 80 44 106M90 80l26 26M75 82l-13 24M85 82l13 24', 'M80 62V26', 'M64 20h32v5H64Z',
    'M26 46q54-7 108 0q-54 7-108 0Z', 'M34 36q46-6 92 0q-46 6-92 0Z' ] },
  insight: { ground: true, paths: [
    'M58 58h44v10H58Z', 'M50 61h8M102 61h8', 'M62 68 52 106M98 68l10 38M80 68v38',
    'M70 58 64 32l24-8 5 15', 'M100 68q16 8 22 28', 'M112 106a10 10 0 0 1 20 0Z',
    'M30 36v40M10 56h40M16 42l28 28M44 42 16 70', 'M130 36v40M110 56h40M116 42l28 28M144 42l-28 28' ],
    circles: [[30, 56, 20], [130, 56, 20]] },
  pioneer10: { paths: [
    'M70 20q-22 40 0 80q8-40 0-80Z', 'M62 60H34M34 53v14', 'M74 46h22v28H74Z',
    'M96 50l48-26M140 18h12v9h-12Z', 'M96 70l48 26M140 93h12v9h-12Z', 'M85 74v38M81 112h8' ] },
  kepler: { paths: [
    'M62 36h36v56H62Z', 'M62 36l-5-22 41 9v13', 'M71 36v56M80 36v56M62 54h18M62 72h18',
    'M57 92h46v10H57Z', 'M70 102q10 14 20 0', 'M104 20l5 5M109 20l-5 5M116 40v8M112 44h8' ] },
};

/** Returns an <svg> line drawing of the machine, drawn in the current text colour. */
export function machineArt(id, attrs = {}) {
  const art = ART[id];
  if (!art) return null;
  return s('svg', { viewBox: '0 0 160 120', class: 'art', 'aria-hidden': 'true', ...attrs },
    art.ground ? s('path', { d: GROUND, class: 'art-ground' }) : null,
    // pathLength=1 lets CSS "draw" every stroke the same way; --i staggers them.
    ...art.paths.map((d, i) => s('path', { d, pathLength: 1, style: `--i:${i}` })),
    ...(art.circles || []).map(([cx, cy, r], i) => s('circle', { cx, cy, r, pathLength: 1, style: `--i:${art.paths.length + i}` })));
}
