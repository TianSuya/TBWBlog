// Turns a full-size photo into the avatar the home page actually serves.
//
// Files in public/ bypass Astro's image pipeline entirely — whatever you put
// there is shipped byte for byte. A 3.9MB camera JPEG behind a 140px slot is
// the single easiest way to make an otherwise weightless site slow, so the
// source photo is processed once, here, rather than at request time.
//
// Usage:
//   node scripts/make-avatar.mjs assets/originals/me.jpg
//   node scripts/make-avatar.mjs <source> --size 280

import sharp from 'sharp';
import { statSync } from 'node:fs';

const args = process.argv.slice(2);
const src = args[0];
const sizeArg = args.indexOf('--size');
// 2x the 140px display slot, which covers every mainstream display density.
const SIZE = sizeArg > -1 ? Number(args[sizeArg + 1]) : 280;
const OUT = 'public/images/avatar.jpg';

if (!src) {
  console.error('usage: node scripts/make-avatar.mjs <source-image> [--size 280]');
  process.exit(1);
}

const before = statSync(src).size;
const meta = await sharp(src).metadata();

await sharp(src)
  // `attention` picks the most salient region rather than the geometric centre,
  // which is what you want when cropping a landscape photo down to a square —
  // a centre crop of a 4:3 frame usually cuts the subject in half.
  .resize(SIZE, SIZE, { fit: 'cover', position: sharp.strategy.attention })
  .rotate() // honour EXIF orientation before it is stripped
  .jpeg({ quality: 82, mozjpeg: true })
  .toFile(OUT);

const after = statSync(OUT).size;
const kb = (n) => `${(n / 1024).toFixed(0)} KB`;

console.log(`source : ${src}  ${meta.width}x${meta.height}  ${kb(before)}`);
console.log(`avatar : ${OUT}  ${SIZE}x${SIZE}  ${kb(after)}`);
console.log(`saved  : ${kb(before - after)}  (${(before / after).toFixed(0)}x smaller)`);
