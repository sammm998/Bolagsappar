import { describe, it, expect } from 'vitest';
import { inflateSync } from 'node:zlib';
import { strokesToPng, base64 } from '../src/signatur.js';

describe('underskrift till PNG', () => {
  it('ger en giltig PNG med rätt storlek och bläck där draget gick', () => {
    const { png, pixels } = strokesToPng([[[10, 10], [90, 30]], [[50, 5]]], 100, 40, { scale: 1, pen: 2 });
    expect(pixels).toBeGreaterThan(80);
    const buf = Buffer.from(png.split(',')[1], 'base64');
    expect([...buf.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(buf.readUInt32BE(16)).toBe(100); expect(buf.readUInt32BE(20)).toBe(40);
    const idat = buf.indexOf('IDAT'), len = buf.readUInt32BE(idat - 4);
    const raw = inflateSync(buf.subarray(idat + 4, idat + 4 + len));
    const row = Math.ceil(100 / 8) + 1;
    expect(raw.length).toBe(row * 40);
    const svart = (x, y) => !(raw[y * row + 1 + (x >> 3)] & (0x80 >> (x & 7)));
    expect(svart(10, 10)).toBe(true); expect(svart(50, 20)).toBe(true); expect(svart(5, 35)).toBe(false);
  });
  it('tom underskrift ger inga pixlar', () => { expect(strokesToPng([], 50, 20).pixels).toBe(0); });
  it('base64 som Buffer', () => { const b = new Uint8Array([1, 2, 3, 250, 251]); expect(base64(b)).toBe(Buffer.from(b).toString('base64')); });
});
