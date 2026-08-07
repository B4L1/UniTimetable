// One-off icon generator — rasterizes public/icon.svg into the PWA manifest
// sizes. Not part of the build; run manually (`node scripts/generate-pwa-icons.mjs`)
// whenever icon.svg changes.
import sharp from 'sharp';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');
const svg = readFileSync(join(publicDir, 'icon.svg'));

const targets = [
    { file: 'pwa-192x192.png', size: 192 },
    { file: 'pwa-512x512.png', size: 512 },
    { file: 'apple-touch-icon.png', size: 180 },
];

for (const { file, size } of targets) {
    await sharp(svg, { density: 384 }).resize(size, size).png().toFile(join(publicDir, file));
    console.log(`wrote ${file} (${size}x${size})`);
}

// Maskable icon: Android crops to a circle/squircle, so the glyph needs a
// safe zone — pad the source (which already fills its box) down to ~80% and
// center it on the brand-green background rather than letting the corners
// (already inside the rounded-rect) get clipped unpredictably.
const maskableSize = 512;
const glyphSize = Math.round(maskableSize * 0.72);
const offset = Math.round((maskableSize - glyphSize) / 2);
const glyph = await sharp(svg, { density: 384 }).resize(glyphSize, glyphSize).toBuffer();
await sharp({
    create: { width: maskableSize, height: maskableSize, channels: 4, background: '#0A6C42' },
})
    .composite([{ input: glyph, left: offset, top: offset }])
    .png()
    .toFile(join(publicDir, 'pwa-maskable-512x512.png'));
console.log('wrote pwa-maskable-512x512.png (512x512, maskable safe zone)');
