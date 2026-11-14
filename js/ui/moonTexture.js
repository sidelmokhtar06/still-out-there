// The Moon map in assets/maps/moon.jpg is a flat albedo mosaic: pale, low contrast, no shadows.
// This makes a clearer copy for display: the grey levels are stretched to the full range and a
// light emboss brings out crater rims, like a shaded-relief map. Positions are untouched.

/** Stretch + relief, in place, on RGBA pixel data. */
export function enhanceMoon(d, w, hgt) {
  const n = w * hgt, L = new Float32Array(n), hist = new Uint32Array(256);
  for (let i = 0; i < n; i++) {
    const v = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
    L[i] = v; hist[v | 0]++;
  }
  // levels: ignore the darkest and brightest 1% when choosing the range
  const pick = (frac) => { let acc = 0; for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= n * frac) return v; } return 255; };
  const lo = pick(0.01), hi = pick(0.995), span = Math.max(1, hi - lo);
  for (let i = 0; i < n; i++) L[i] = Math.pow(Math.min(1, Math.max(0, (L[i] - lo) / span)), 1.25);
  for (let y = 0; y < hgt; y++) {
    const up = Math.max(0, y - 1) * w, down = Math.min(hgt - 1, y + 1) * w, row = y * w;
    for (let x = 0; x < w; x++) {
      const xl = x === 0 ? w - 1 : x - 1, xr = x === w - 1 ? 0 : x + 1;   // the map wraps east–west
      const relief = (L[up + xl] - L[down + xr]) * 2.2;                     // light from the upper left
      const v = Math.min(1, Math.max(0, L[row + x] * 0.92 + relief + 0.03));
      const i = (row + x) * 4;
      d[i] = v * 255; d[i + 1] = v * 250; d[i + 2] = v * 244;               // a touch warm, like the real regolith
    }
  }
}

let cached = null;
/** Promise of a canvas holding the clearer Moon map (made once, shared by every view). */
export function moonCanvas(src = 'assets/maps/moon.jpg') {
  if (cached) return cached;
  cached = new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(img, 0, 0);
      const data = g.getImageData(0, 0, c.width, c.height);
      enhanceMoon(data.data, c.width, c.height);
      g.putImageData(data, 0, 0);
      resolve(c);
    };
    img.onerror = reject;
    img.src = src;
  });
  return cached;
}
