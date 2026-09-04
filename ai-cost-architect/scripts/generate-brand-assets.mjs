/**
 * Derives every shipped brand asset from the single source logo in `brand/`.
 *
 * The source is an opaque black-ink-on-white wordmark at 2.93:1. Two transforms
 * carry it into the product:
 *
 *   1. Negative. The app is dark-only (--c-bg is true black), so ink darkness
 *      becomes alpha on a pure-white glyph. Compositing that over black is an
 *      exact photographic negative of the original, which keeps the grey facets
 *      of the K and the Q tail intact instead of flattening them to white.
 *
 *   2. Square crop. A 2.93:1 wordmark is unreadable in a 16px browser tab, so
 *      every square icon is cut from the `Q` glyph alone and set on a hard black
 *      tile -- hard, not rounded, because the design system zeroes every radius.
 *
 * Usage:  node scripts/generate-brand-assets.mjs [source.png]
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decode, encode, resize } from './lib/png.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = process.argv[2] || resolve(ROOT, 'brand/tokiq-logo-source.png');
const PUBLIC = resolve(ROOT, 'public');
const ASSETS = resolve(ROOT, 'src/assets');

/**
 * Ink bounding boxes inside the source, measured once with `inkBounds` below.
 * They are asserted at run time so a re-cut logo fails loudly rather than
 * silently producing a mis-cropped icon.
 */
const WORDMARK_BOX = [14, 18, 644, 232];   // full TOKIQ, tight to the ink
const Q_BOX = [469, 18, 644, 232];         // the Q glyph including its tail
const BLACK = [0, 0, 0];

const luminance = (d, i) => d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;

/** Tight bounding box of everything darker than `threshold`, for verification. */
function inkBounds(img, threshold = 245) {
  const { width: w, height: h, data: d } = img;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (luminance(d, (y * w + x) * 4) >= threshold) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return [x0, y0, x1, y1];
}

/** Ink darkness -> alpha, glyph -> white. See transform (1) in the header. */
function negative(img) {
  const { width, height, data } = img;
  const out = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = 255;
    out[i * 4 + 3] = Math.round(255 - luminance(data, i * 4));
  }
  return { width, height, data: out };
}

function crop(img, [x0, y0, x1, y1]) {
  const width = x1 - x0 + 1, height = y1 - y0 + 1;
  const out = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    img.data.copy(out, y * width * 4,
      ((y + y0) * img.width + x0) * 4, ((y + y0) * img.width + x1 + 1) * 4);
  }
  return { width, height, data: out };
}

/** Centre `img` on a size x size canvas, `pad` as a fraction per side. */
function square(img, size, pad, bg) {
  const out = Buffer.alloc(size * size * 4);
  if (bg) {
    for (let i = 0; i < size * size; i++) {
      out[i * 4] = bg[0]; out[i * 4 + 1] = bg[1]; out[i * 4 + 2] = bg[2]; out[i * 4 + 3] = 255;
    }
  }
  const avail = size * (1 - 2 * pad);
  const scale = Math.min(avail / img.width, avail / img.height);
  const tw = Math.max(1, Math.round(img.width * scale));
  const th = Math.max(1, Math.round(img.height * scale));
  const r = resize(img, tw, th);
  const ox = Math.round((size - tw) / 2), oy = Math.round((size - th) / 2);
  for (let y = 0; y < th; y++) {
    for (let x = 0; x < tw; x++) {
      const si = (y * tw + x) * 4, di = ((y + oy) * size + (x + ox)) * 4;
      const a = r.data[si + 3] / 255, da = out[di + 3] / 255;
      const na = a + da * (1 - a);
      if (na === 0) continue;
      for (let c = 0; c < 3; c++) {
        out[di + c] = Math.round((r.data[si + c] * a + out[di + c] * da * (1 - a)) / na);
      }
      out[di + 3] = Math.round(na * 255);
    }
  }
  return { width: size, height: size, data: out };
}

/** Multi-resolution .ico carrying PNG-compressed entries. */
function ico(entries) {
  const dir = Buffer.alloc(6);
  dir.writeUInt16LE(1, 2);                  // type: icon
  dir.writeUInt16LE(entries.length, 4);
  let offset = 6 + entries.length * 16;
  const table = [], blobs = [];
  for (const { size, buf } of entries) {
    const e = Buffer.alloc(16);
    e[0] = size >= 256 ? 0 : size;          // 0 means 256 in the ICO header
    e[1] = size >= 256 ? 0 : size;
    e.writeUInt16LE(1, 4);                  // colour planes
    e.writeUInt16LE(32, 6);                 // bits per pixel
    e.writeUInt32LE(buf.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += buf.length;
    table.push(e); blobs.push(buf);
  }
  return Buffer.concat([dir, ...table, ...blobs]);
}

// --- build -------------------------------------------------------------------

const source = decode(readFileSync(SOURCE));
const bounds = inkBounds(source);
if (bounds.join() !== WORDMARK_BOX.join()) {
  throw new Error(
    `${relative(ROOT, SOURCE)} does not match the expected ink bounds.\n` +
    `  expected [${WORDMARK_BOX}] but measured [${bounds}].\n` +
    `  If the logo was legitimately re-cut, update WORDMARK_BOX and Q_BOX.`
  );
}

const neg = negative(source);
const wordmark = crop(neg, WORDMARK_BOX);
const q = crop(neg, Q_BOX);
const tile = (size, pad = 0.15) => encode(square(q, size, pad, BLACK));

mkdirSync(PUBLIC, { recursive: true });
mkdirSync(ASSETS, { recursive: true });

const written = [];
function write(path, buf) {
  writeFileSync(path, buf);
  written.push(`${relative(ROOT, path).replace(/\\/g, '/')} (${buf.length} B)`);
}

write(resolve(ASSETS, 'tokiq-wordmark.png'), encode(wordmark));

write(resolve(PUBLIC, 'favicon-16x16.png'), tile(16, 0.12));
write(resolve(PUBLIC, 'favicon-32x32.png'), tile(32, 0.14));
write(resolve(PUBLIC, 'favicon-96x96.png'), tile(96));
write(resolve(PUBLIC, 'apple-touch-icon.png'), tile(180, 0.19));
write(resolve(PUBLIC, 'icon-192.png'), tile(192));
write(resolve(PUBLIC, 'icon-512.png'), tile(512));
// Android crops adaptive icons to an unpredictable mask; keep the glyph well
// inside the 40% safe zone.
write(resolve(PUBLIC, 'icon-maskable-512.png'), tile(512, 0.28));

write(resolve(ROOT, 'src/favicon.ico'), ico(
  [16, 32, 48].map(size => ({ size, buf: tile(size, size === 16 ? 0.12 : 0.14) }))
));

// Open Graph / Twitter card: the wordmark on black inside a hairline frame.
{
  const W = 1200, H = 630;
  const canvas = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) canvas[i * 4 + 3] = 255;      // opaque #000
  const line = (x, y) => { const i = (y * W + x) * 4; canvas[i] = canvas[i + 1] = canvas[i + 2] = 38; };
  for (let x = 40; x < W - 40; x++) { line(x, 40); line(x, H - 41); }
  for (let y = 40; y < H - 40; y++) { line(40, y); line(W - 41, y); }

  const tw = 760, th = Math.round(tw * wordmark.height / wordmark.width);
  const r = resize(wordmark, tw, th);
  const ox = Math.round((W - tw) / 2), oy = Math.round((H - th) / 2);
  for (let y = 0; y < th; y++) {
    for (let x = 0; x < tw; x++) {
      const si = (y * tw + x) * 4, di = ((y + oy) * W + (x + ox)) * 4, a = r.data[si + 3] / 255;
      for (let c = 0; c < 3; c++) canvas[di + c] = Math.round(r.data[si + c] * a + canvas[di + c] * (1 - a));
    }
  }
  write(resolve(PUBLIC, 'og-image.png'), encode({ width: W, height: H, data: canvas }));
}

console.log(`brand assets generated from ${relative(ROOT, SOURCE).replace(/\\/g, '/')}`);
for (const w of written) console.log(`  ${w}`);
