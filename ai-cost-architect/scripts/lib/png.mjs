/**
 * Minimal 8-bit PNG decode / encode / resample on top of node:zlib.
 *
 * The project has no image dependency (sharp, jimp, canvas) and the brand assets
 * only need three operations, so this is cheaper than adding one. Handles the
 * PNG colour types produced by design tools (grey / RGB / grey+A / RGBA) and
 * always writes RGBA.
 */
import zlib from 'node:zlib';

let CRC_TABLE;
function crc32(buf) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** @returns {{width:number, height:number, data:Buffer}} RGBA, 4 bytes per pixel. */
export function decode(buf) {
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  const bitDepth = buf[24];
  const colorType = buf[25];
  if (bitDepth !== 8) throw new Error(`unsupported bit depth ${bitDepth} (need 8)`);
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType];
  if (!channels) throw new Error(`unsupported colour type ${colorType}`);

  const idat = [];
  for (let off = 8; off < buf.length;) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('latin1', off + 4, off + 8);
    if (type === 'IDAT') idat.push(buf.subarray(off + 8, off + 8 + len));
    if (type === 'IEND') break;
    off += 12 + len;
  }

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = channels;
  const stride = width * bpp;
  const flat = Buffer.alloc(height * stride);

  // Undo the per-scanline filters (PNG spec 9.2).
  for (let y = 0, pos = 0; y < height; y++) {
    const filter = raw[pos++];
    const line = raw.subarray(pos, pos + stride);
    pos += stride;
    const cur = flat.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? flat.subarray((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0;
      const b = prev[i];
      const c = i >= bpp ? prev[i - bpp] : 0;
      let v = line[i];
      switch (filter) {
        case 0: break;
        case 1: v += a; break;
        case 2: v += b; break;
        case 3: v += (a + b) >> 1; break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
          v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
          break;
        }
        default: throw new Error(`unknown filter type ${filter}`);
      }
      cur[i] = v & 0xff;
    }
  }

  const data = Buffer.alloc(width * height * 4);
  for (let i = 0, n = width * height; i < n; i++) {
    let r, g, b, a = 255;
    if (channels === 1) { r = g = b = flat[i]; }
    else if (channels === 2) { r = g = b = flat[i * 2]; a = flat[i * 2 + 1]; }
    else if (channels === 3) { r = flat[i * 3]; g = flat[i * 3 + 1]; b = flat[i * 3 + 2]; }
    else { r = flat[i * 4]; g = flat[i * 4 + 1]; b = flat[i * 4 + 2]; a = flat[i * 4 + 3]; }
    data[i * 4] = r; data[i * 4 + 1] = g; data[i * 4 + 2] = b; data[i * 4 + 3] = a;
  }
  return { width, height, data };
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** Writes 8-bit RGBA, no interlacing, a single IDAT. */
export function encode({ width, height, data }) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;    // bit depth
  ihdr[9] = 6;    // colour type: RGBA
  const stride = width * 4;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;  // filter: none
    data.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * Area-average ("box") resample. Alpha is premultiplied before averaging so
 * transparent pixels do not bleed their colour into the edges of the glyphs.
 */
export function resize(img, targetW, targetH) {
  const { width: sw, height: sh, data: sd } = img;
  const out = Buffer.alloc(targetW * targetH * 4);
  for (let y = 0; y < targetH; y++) {
    const y0 = (y * sh) / targetH, y1 = ((y + 1) * sh) / targetH;
    for (let x = 0; x < targetW; x++) {
      const x0 = (x * sw) / targetW, x1 = ((x + 1) * sw) / targetW;
      let r = 0, g = 0, b = 0, a = 0, wsum = 0;
      for (let sy = Math.floor(y0); sy < Math.ceil(y1); sy++) {
        const wy = Math.min(y1, sy + 1) - Math.max(y0, sy);
        if (wy <= 0) continue;
        for (let sx = Math.floor(x0); sx < Math.ceil(x1); sx++) {
          const wx = Math.min(x1, sx + 1) - Math.max(x0, sx);
          if (wx <= 0) continue;
          const w = wx * wy;
          const i = (sy * sw + sx) * 4;
          const sa = sd[i + 3] / 255;
          r += sd[i] * sa * w; g += sd[i + 1] * sa * w; b += sd[i + 2] * sa * w;
          a += sd[i + 3] * w;
          wsum += w;
        }
      }
      const o = (y * targetW + x) * 4;
      if (wsum === 0 || a === 0) continue;   // stays fully transparent
      const meanAlpha = a / wsum / 255;
      out[o] = Math.round(Math.min(255, r / wsum / meanAlpha));
      out[o + 1] = Math.round(Math.min(255, g / wsum / meanAlpha));
      out[o + 2] = Math.round(Math.min(255, b / wsum / meanAlpha));
      out[o + 3] = Math.round(a / wsum);
    }
  }
  return { width: targetW, height: targetH, data: out };
}
