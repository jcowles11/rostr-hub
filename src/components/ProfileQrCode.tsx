/**
 * ProfileQrCode — Generates a QR code SVG entirely client-side.
 *
 * Uses a minimal QR code encoding implementation (alphanumeric mode, error correction L).
 * No external dependencies. Designed for profile URLs up to ~90 characters.
 *
 * For URLs longer than the alphanumeric limit, falls back to a simple
 * "scan me" placeholder directing users to copy the link instead.
 */

import { useMemo } from "react";

// ── Minimal QR Code Generator (Version 2-4, Mode: Byte, EC: L) ────
// Based on https://github.com/nicokoenig/qrcode — simplified for profile URLs

// GF(256) math for Reed-Solomon
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x = x << 1;
    if (x & 256) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function rsGenPoly(nsym: number): Uint8Array {
  let g = new Uint8Array([1]);
  for (let i = 0; i < nsym; i++) {
    const ng = new Uint8Array(g.length + 1);
    for (let j = 0; j < g.length; j++) {
      ng[j] ^= g[j];
      ng[j + 1] ^= gfMul(g[j], GF_EXP[i]);
    }
    g = ng;
  }
  return g;
}

function rsEncode(data: Uint8Array, nsym: number): Uint8Array {
  const gen = rsGenPoly(nsym);
  const res = new Uint8Array(data.length + nsym);
  res.set(data);
  for (let i = 0; i < data.length; i++) {
    const coef = res[i];
    if (coef !== 0) {
      for (let j = 0; j < gen.length; j++) {
        res[i + j] ^= gfMul(gen[j], coef);
      }
    }
  }
  return res.slice(data.length);
}

// QR version configs: [version, size, dataCodewords(EC-L), ecCodewords(EC-L)]
const QR_VERSIONS: [number, number, number, number][] = [
  [1, 21, 19, 7],
  [2, 25, 34, 10],
  [3, 29, 55, 15],
  [4, 33, 80, 20],
  [5, 37, 108, 26],
  [6, 41, 136, 18], // 2 blocks
];

function pickVersion(byteLen: number): { version: number; size: number; dataCw: number; ecCw: number } | null {
  // Byte mode overhead: mode(4 bits) + char count (8 or 16 bits) + terminator(4 bits)
  for (const [v, s, dc, ec] of QR_VERSIONS) {
    const charCountBits = v >= 10 ? 16 : 8;
    const overhead = Math.ceil((4 + charCountBits + 4) / 8);
    if (byteLen + overhead <= dc) return { version: v, size: s, dataCw: dc, ecCw: ec };
  }
  return null;
}

function encodeData(text: string, dataCw: number, version: number): Uint8Array {
  const bytes = new TextEncoder().encode(text);
  const charCountBits = version >= 10 ? 16 : 8;
  const bits: number[] = [];

  // Mode indicator: byte mode = 0100
  bits.push(0, 1, 0, 0);
  // Character count
  for (let i = charCountBits - 1; i >= 0; i--) bits.push((bytes.length >> i) & 1);
  // Data
  for (const b of bytes) for (let i = 7; i >= 0; i--) bits.push((b >> i) & 1);
  // Terminator
  for (let i = 0; i < 4 && bits.length < dataCw * 8; i++) bits.push(0);
  // Pad to byte boundary
  while (bits.length % 8 !== 0) bits.push(0);
  // Pad codewords
  const pads = [0xec, 0x11];
  let pi = 0;
  while (bits.length < dataCw * 8) {
    for (let i = 7; i >= 0; i--) bits.push((pads[pi] >> i) & 1);
    pi = (pi + 1) % 2;
  }

  const result = new Uint8Array(dataCw);
  for (let i = 0; i < dataCw; i++) {
    let byte = 0;
    for (let b = 0; b < 8; b++) byte = (byte << 1) | (bits[i * 8 + b] || 0);
    result[i] = byte;
  }
  return result;
}

// Alignment pattern positions
const ALIGN_POS: number[][] = [
  [], [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34],
];

function createMatrix(version: number, size: number, dataCw: number, ecCw: number, text: string): boolean[][] {
  const data = encodeData(text, dataCw, version);
  const ec = rsEncode(data, ecCw);
  const allBytes = new Uint8Array(dataCw + ecCw);
  allBytes.set(data);
  allBytes.set(ec, dataCw);

  // Initialize matrix
  const m: (boolean | null)[][] = Array.from({ length: size }, () => Array(size).fill(null));
  const reserved: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  function setModule(r: number, c: number, val: boolean, res = true) {
    if (r >= 0 && r < size && c >= 0 && c < size) {
      m[r][c] = val;
      if (res) reserved[r][c] = true;
    }
  }

  // Finder patterns
  function finderPattern(row: number, col: number) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const inOuter = r >= 0 && r <= 6 && c >= 0 && c <= 6;
        const inInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        const onBorder = r === 0 || r === 6 || c === 0 || c === 6;
        setModule(row + r, col + c, inOuter && (onBorder || inInner));
      }
    }
  }

  finderPattern(0, 0);
  finderPattern(0, size - 7);
  finderPattern(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    setModule(6, i, i % 2 === 0);
    setModule(i, 6, i % 2 === 0);
  }

  // Alignment patterns
  if (version >= 2) {
    const positions = ALIGN_POS[version];
    for (const r of positions) {
      for (const c of positions) {
        if (reserved[r][c]) continue;
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const onBorder = Math.abs(dr) === 2 || Math.abs(dc) === 2;
            const isCenter = dr === 0 && dc === 0;
            setModule(r + dr, c + dc, onBorder || isCenter);
          }
        }
      }
    }
  }

  // Dark module
  setModule(size - 8, 8, true);

  // Reserve format info areas
  for (let i = 0; i < 8; i++) {
    if (!reserved[8][i]) { reserved[8][i] = true; m[8][i] = false; }
    if (!reserved[8][size - 1 - i]) { reserved[8][size - 1 - i] = true; m[8][size - 1 - i] = false; }
    if (!reserved[i][8]) { reserved[i][8] = true; m[i][8] = false; }
    if (!reserved[size - 1 - i][8]) { reserved[size - 1 - i][8] = true; m[size - 1 - i][8] = false; }
  }
  if (!reserved[8][8]) { reserved[8][8] = true; m[8][8] = false; }

  // Place data bits
  const dataBits: number[] = [];
  for (const byte of allBytes) {
    for (let i = 7; i >= 0; i--) dataBits.push((byte >> i) & 1);
  }

  let bitIdx = 0;
  let upward = true;
  for (let col = size - 1; col >= 0; col -= 2) {
    if (col === 6) col = 5; // Skip timing column
    const rows = upward ? Array.from({ length: size }, (_, i) => size - 1 - i) : Array.from({ length: size }, (_, i) => i);
    for (const row of rows) {
      for (const dc of [0, -1]) {
        const c = col + dc;
        if (c < 0 || c >= size || reserved[row][c]) continue;
        m[row][c] = bitIdx < dataBits.length ? dataBits[bitIdx++] === 1 : false;
      }
    }
    upward = !upward;
  }

  // Apply mask pattern 0 (checkerboard) and format info
  const MASK_0_FORMAT = 0x5412; // Mask 0, EC level L
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!reserved[r][c] && (r + c) % 2 === 0) {
        m[r][c] = !m[r][c];
      }
    }
  }

  // Write format info
  const formatBits: boolean[] = [];
  for (let i = 14; i >= 0; i--) formatBits.push(((MASK_0_FORMAT >> i) & 1) === 1);

  // Around top-left finder
  const FORMAT_POS_H = [0, 1, 2, 3, 4, 5, 7, 8];
  const FORMAT_POS_V = [8, 7, 5, 4, 3, 2, 1, 0];
  for (let i = 0; i < 8; i++) {
    m[8][FORMAT_POS_H[i]] = formatBits[i];
    m[FORMAT_POS_V[i]][8] = formatBits[i];
  }
  // Bottom-left and top-right
  for (let i = 0; i < 7; i++) {
    m[size - 1 - i][8] = formatBits[i];
    m[8][size - 8 + i] = formatBits[8 + i];
  }
  m[8][size - 8] = formatBits[7]; // Extra bit

  return m.map(row => row.map(v => v === true));
}

// ── SVG Renderer ──────────────────────────────────────────────────

interface ProfileQrCodeProps {
  url: string;
  size?: number;
  className?: string;
}

export default function ProfileQrCode({ url, size = 140, className }: ProfileQrCodeProps) {
  const svgContent = useMemo(() => {
    const ver = pickVersion(url.length);
    if (!ver) return null;

    try {
      const matrix = createMatrix(ver.version, ver.size, ver.dataCw, ver.ecCw, url);
      const moduleCount = matrix.length;
      const quiet = 2; // quiet zone modules
      const total = moduleCount + quiet * 2;
      const moduleSize = size / total;

      const rects: string[] = [];
      for (let r = 0; r < moduleCount; r++) {
        for (let c = 0; c < moduleCount; c++) {
          if (matrix[r][c]) {
            const x = (c + quiet) * moduleSize;
            const y = (r + quiet) * moduleSize;
            rects.push(`<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${(moduleSize + 0.5).toFixed(2)}" height="${(moduleSize + 0.5).toFixed(2)}" fill="currentColor"/>`);
          }
        }
      }

      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><rect width="${size}" height="${size}" fill="white" rx="8"/>${rects.join("")}</svg>`;
    } catch {
      return null;
    }
  }, [url, size]);

  if (!svgContent) {
    return (
      <div
        className={className}
        style={{ width: size, height: size }}
      >
        <div className="w-full h-full rounded-lg bg-muted flex items-center justify-center text-xs text-muted-foreground text-center p-2">
          QR code unavailable — use the share link
        </div>
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  );
}
