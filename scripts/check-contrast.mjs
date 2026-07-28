// Verifies every colour pair in the design system against WCAG.
//
// The retro palette is not a free pass on legibility: amber-on-black and a
// hand-rolled syntax theme are exactly the sort of thing that ends up at 2.8:1
// without anyone noticing. This makes the numbers explicit.
//
// Run: node scripts/check-contrast.mjs

import { palettes } from '../src/styles/shiki-themes.mjs';

// Everything on this site is normal-size text, including the 0.88em monospace
// in code blocks, so every pair is held to the 4.5:1 body threshold rather than
// the 3:1 large-text one.
const AA_BODY = 4.5;

const hex = (h) => {
  const s = h.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16) / 255);
};

// WCAG 2.x relative luminance.
const luminance = (h) => {
  const [r, g, b] = hex(h).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const ratio = (a, b) => {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

let failures = 0;

function check(label, fg, bg, min = AA_BODY) {
  const r = ratio(fg, bg);
  const pass = r >= min;
  if (!pass) failures++;
  console.log(
    `  ${pass ? 'ok  ' : 'FAIL'}  ${label.padEnd(34)} ${r.toFixed(2)}:1  (need ${min})  ${fg} on ${bg}`
  );
}

// --- site chrome, mirroring src/styles/global.css -------------------------
const site = {
  light: {
    bg: '#ffffff',
    fg: '#000000',
    link: '#0000ee',
    linkVisited: '#551a8b',
    muted: '#555555',
  },
  dark: {
    bg: '#0a0a0a',
    fg: '#ffb000',
    link: '#ffd166',
    linkVisited: '#c98a1e',
    muted: '#b3801f',
  },
};

for (const [mode, p] of Object.entries(site)) {
  console.log(`\nSite chrome — ${mode}`);
  check('body text', p.fg, p.bg);
  check('link', p.link, p.bg);
  check('visited link', p.linkVisited, p.bg);
  // Muted text is metadata and footer signature: small, but still prose.
  check('muted text', p.muted, p.bg);
  // Hover inverts fg/bg, so it is the same ratio by definition — assert it anyway.
  check('inverted hover', p.bg, p.fg);
}

// --- syntax highlighting ---------------------------------------------------
for (const [mode, p] of Object.entries(palettes)) {
  console.log(`\nSyntax theme — ${mode}`);
  for (const token of ['fg', 'comment', 'keyword', 'string', 'number', 'entity', 'punctuation']) {
    // Code is monospace at 0.88em — comfortably "normal" text, so hold every
    // token to the body threshold rather than the large-text one.
    check(`code: ${token}`, p[token], p.bg);
  }
}

console.log(
  `\n${failures === 0 ? 'All colour pairs meet WCAG AA.' : `${failures} pair(s) below AA.`}`
);
process.exit(failures === 0 ? 0 : 1);
