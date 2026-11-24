import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

// Minimal pure-Node PNG creator using standard zlib
function createPng(width, height, getPixel) {
  const bytesPerPixel = 4;
  const rowSize = width * bytesPerPixel;
  const rawData = Buffer.alloc((rowSize + 1) * height);

  for (let y = 0; y < height; y++) {
    const rowStart = y * (rowSize + 1);
    rawData[rowStart] = 0; // Filter type: None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = getPixel(x, y, width, height);
      const pixelStart = rowStart + 1 + x * bytesPerPixel;
      rawData[pixelStart] = r;
      rawData[pixelStart + 1] = g;
      rawData[pixelStart + 2] = b;
      rawData[pixelStart + 3] = a;
    }
  }

  const compressed = zlib.deflateSync(rawData);

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR Chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);

  const crcPayload = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcPayload), 0);

  return Buffer.concat([lenBuf, crcPayload, crcBuf]);
}

// CRC32 implementation
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) c = 0xedb88320 ^ (c >>> 1);
    else c = c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Aviator Icon pixel generator (Dark slate background, glowing red plane)
function aviatorPixel(x, y, w, h) {
  const cx = w / 2;
  const cy = h / 2;
  const dx = (x - cx) / cx;
  const dy = (y - cy) / cy;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Background rounded squircle / gradient
  if (dist > 0.95) return [0, 0, 0, 0]; // Transparent outside

  // Dark slate cockpit background
  let r = 2;
  let g = 6;
  let b = 23;
  let a = 255;

  // Radar circle
  const radarR = 0.55;
  if (Math.abs(dist - radarR) < 0.02) {
    r = 30; g = 41; b = 59;
  }

  // Red Aviator plane silhouette in center
  // Transformed coordinates
  const px = dx * 0.8 - dy * 0.5;
  const py = dx * 0.5 + dy * 0.8;

  // Fuselage: ellipse
  const fuseDist = Math.sqrt((px * px) / 0.18 + (py * py) / 0.035);
  // Wings
  const wingDist = Math.abs(py) < 0.35 && Math.abs(px) < 0.08;

  if (fuseDist < 0.8 || wingDist) {
    // Supersonic crimson red
    r = 225;
    g = 29;
    b = 72;
  }

  // Glowing trail
  if (px < -0.15 && Math.abs(py) < 0.08) {
    r = 244; g = 63; b = 94; a = 200;
  }

  return [r, g, b, a];
}

const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), createPng(192, 192, aviatorPixel));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), createPng(512, 512, aviatorPixel));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), createPng(180, 180, aviatorPixel));
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), createPng(512, 512, aviatorPixel));

console.log('PWA PNG icons generated successfully in public/');
