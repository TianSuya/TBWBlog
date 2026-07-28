// Two hand-written Shiki themes.
//
// The bundled themes were both wrong here, in opposite directions: `min-light`
// renders almost everything black (no visible highlighting at all), and
// `min-dark` uses pinks and purples that fight the amber phosphor.
//
// So: light mode borrows from early Emacs font-lock — dark red strings, dark
// blue identifiers, grey italic comments, bold keywords. Dark mode stays inside
// the amber hue family and distinguishes tokens by brightness rather than hue,
// so it still reads as one monochrome CRT while being genuinely highlighted.
//
// Contrast of every colour below is checked by scripts/check-contrast.mjs.

const LIGHT = {
  bg: '#ffffff',
  fg: '#000000',
  comment: '#6b6b6b',
  keyword: '#000000',
  string: '#8b0000',
  number: '#8b0000',
  entity: '#00008b',
  punctuation: '#3a3a3a',
};

const DARK = {
  bg: '#0a0a0a',
  fg: '#ffb000',
  comment: '#b98c3f',
  keyword: '#ffd166',
  string: '#e8a33d',
  number: '#e8a33d',
  entity: '#ffc94d',
  punctuation: '#c08f28',
};

/** One token→scope mapping shared by both, so the themes cannot drift apart. */
function build(name, type, p) {
  return {
    name,
    type,
    colors: { 'editor.background': p.bg, 'editor.foreground': p.fg },
    settings: [
      { settings: { foreground: p.fg, background: p.bg } },
      {
        scope: ['comment', 'punctuation.definition.comment', 'string.comment'],
        settings: { foreground: p.comment, fontStyle: 'italic' },
      },
      {
        scope: [
          'keyword',
          'keyword.control',
          'keyword.operator.new',
          'storage',
          'storage.type',
          'storage.modifier',
          'variable.language',
          'constant.language',
        ],
        settings: { foreground: p.keyword, fontStyle: 'bold' },
      },
      {
        scope: ['string', 'string.quoted', 'string.template'],
        settings: { foreground: p.string },
      },
      {
        scope: ['constant.numeric', 'constant.character', 'constant.other'],
        settings: { foreground: p.number },
      },
      {
        scope: [
          'entity.name.function',
          'entity.name.class',
          'entity.name.type',
          'entity.name.tag',
          'support.function',
          'support.class',
          'support.type',
        ],
        settings: { foreground: p.entity },
      },
      {
        scope: ['punctuation', 'meta.brace', 'keyword.operator'],
        settings: { foreground: p.punctuation },
      },
      {
        scope: ['variable', 'variable.parameter', 'meta.definition.variable'],
        settings: { foreground: p.fg },
      },
    ],
  };
}

export const palettes = { light: LIGHT, dark: DARK };
export const lineprinterLight = build('lineprinter-light', 'light', LIGHT);
export const phosphorDark = build('phosphor-dark', 'dark', DARK);
