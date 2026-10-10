// Underskrift med pennan utan canvas: drag (punkter) ritas till en svartvit PNG med genomskinlig bakgrund.
// Används av mobilappen, där det inte finns någon canvas. Webben använder canvas i packages/ui (SignaturePad).

const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = b => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const adler32 = b => { let a = 1, s = 0; for (let i = 0; i < b.length; i++) { a = (a + b[i]) % 65521; s = (s + a) % 65521; } return ((s << 16) | a) >>> 0; };
const u32 = n => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];

function chunk(type, data) {
  const t = [...type].map(c => c.charCodeAt(0));
  const body = new Uint8Array(t.length + data.length); body.set(t); body.set(data, t.length);
  return [...u32(data.length), ...body, ...u32(crc32(body))];
}

/** zlib med okomprimerade block. Bilden är liten (1 bit per pixel), så det räcker. */
function zlibStored(raw) {
  const out = [0x78, 0x01];
  for (let i = 0; i < raw.length || i === 0; i += 65535) {
    const blk = raw.subarray(i, Math.min(i + 65535, raw.length)), last = i + 65535 >= raw.length ? 1 : 0;
    out.push(last, blk.length & 255, blk.length >> 8, ~blk.length & 255, (~blk.length >> 8) & 255, ...blk);
    if (!raw.length) break;
  }
  out.push(...u32(adler32(raw)));
  return new Uint8Array(out);
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export function base64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    s += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < bytes.length ? B64[(n >> 6) & 63] : '=') + (i + 2 < bytes.length ? B64[n & 63] : '=');
  }
  return s;
}

/**
 * @param {number[][][]} strokes drag, varje drag en lista av [x, y] i samma enheter som width och height
 * @returns {{ png: string, pixels: number }} data-URL och antal svarta pixlar (0 = ingen underskrift)
 */
export function strokesToPng(strokes, width, height, { scale = 2, pen = 2.2 } = {}) {
  const W = Math.round(width * scale), H = Math.round(height * scale), r = pen * scale / 2;
  const bits = new Uint8Array(W * H);
  const dot = (cx, cy) => {
    for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(H - 1, Math.ceil(cy + r)); y++)
      for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(W - 1, Math.ceil(cx + r)); x++)
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) bits[y * W + x] = 1;
  };
  for (const s of strokes || []) {
    const P = s.map(([x, y]) => [x * scale, y * scale]);
    if (P.length === 1) dot(P[0][0], P[0][1]);
    for (let i = 1; i < P.length; i++) {
      const [x0, y0] = P[i - 1], [x1, y1] = P[i], n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / Math.max(0.5, r / 2)));
      for (let k = 0; k <= n; k++) dot(x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n);
    }
  }
  // Gråskala 1 bit: 0 svart, 1 vit. tRNS gör vitt genomskinligt.
  const row = Math.ceil(W / 8), raw = new Uint8Array((row + 1) * H);
  let pixels = 0;
  for (let y = 0; y < H; y++) {
    raw[y * (row + 1)] = 0;
    for (let x = 0; x < W; x++) {
      const ink = bits[y * W + x]; pixels += ink;
      if (!ink) raw[y * (row + 1) + 1 + (x >> 3)] |= 0x80 >> (x & 7);
    }
  }
  const png = new Uint8Array([
    137, 80, 78, 71, 13, 10, 26, 10,
    ...chunk('IHDR', new Uint8Array([...u32(W), ...u32(H), 1, 0, 0, 0, 0])),
    ...chunk('tRNS', new Uint8Array([0, 1])),
    ...chunk('IDAT', zlibStored(raw)),
    ...chunk('IEND', new Uint8Array(0))
  ]);
  return { png: 'data:image/png;base64,' + base64(png), pixels };
}
