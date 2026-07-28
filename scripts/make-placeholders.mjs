// Generates public/images/avatar.jpg and public/favicon.ico.
//
// Both are placeholders meant to be replaced — but the site should not ship
// with broken image links, and a 404 in the browser console on a fresh clone
// is the kind of thing nobody ever gets around to fixing.
//
// Rerun after changing your initials:  node scripts/make-placeholders.mjs

import sharp from 'sharp';
import { writeFileSync, mkdirSync } from 'node:fs';

const INITIALS = process.env.INITIALS ?? 'BT';

// Hairline box, serif initials, no colour. Same rules as the rest of the site.
const avatarSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="280" height="280">
  <rect width="280" height="280" fill="#ffffff"/>
  <rect x="0.5" y="0.5" width="279" height="279" fill="none" stroke="#000000" stroke-width="1"/>
  <text x="140" y="140" font-family="Times New Roman, Times, serif" font-size="110"
        fill="#000000" text-anchor="middle" dominant-baseline="central">${INITIALS}</text>
  <text x="140" y="238" font-family="Courier New, Courier, monospace" font-size="15"
        fill="#555555" text-anchor="middle">[ photo ]</text>
</svg>`;

const faviconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32">
  <rect width="32" height="32" fill="#ffffff"/>
  <rect x="0.5" y="0.5" width="31" height="31" fill="none" stroke="#000000"/>
  <text x="16" y="17" font-family="Times New Roman, Times, serif" font-size="18"
        fill="#000000" text-anchor="middle" dominant-baseline="central">${INITIALS}</text>
</svg>`;

mkdirSync('public/images', { recursive: true });

await sharp(Buffer.from(avatarSvg)).jpeg({ quality: 90 }).toFile('public/images/avatar.jpg');
console.log('wrote public/images/avatar.jpg (280x280 placeholder)');

// sharp cannot write .ico, but every browser since IE11 reads a PNG wrapped in
// an ICO container, so build the 22-byte header by hand.
const png = await sharp(Buffer.from(faviconSvg)).png().toBuffer();

const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(1, 4); // one image

const entry = Buffer.alloc(16);
entry.writeUInt8(32, 0); // width
entry.writeUInt8(32, 1); // height
entry.writeUInt8(0, 2); // palette size (0 = truecolour)
entry.writeUInt8(0, 3); // reserved
entry.writeUInt16LE(1, 4); // colour planes
entry.writeUInt16LE(32, 6); // bits per pixel
entry.writeUInt32LE(png.length, 8); // payload size
entry.writeUInt32LE(header.length + entry.length, 12); // payload offset

writeFileSync('public/favicon.ico', Buffer.concat([header, entry, png]));
console.log(`wrote public/favicon.ico (32x32, ${png.length} byte PNG payload)`);
