// Confirms the CMS can actually reach every piece of site content.
//
// public/admin/config.yml and src/data/*.json are two hand-maintained lists that
// have to agree. When they drift the failure is silent: a field keeps rendering
// on the site but quietly disappears from the admin UI, and you only find out
// when you try to edit it.
//
// Run: node scripts/check-cms-coverage.mjs

import { readFileSync, readdirSync } from 'node:fs';
import { parse } from 'yaml';

const cms = parse(readFileSync('public/admin/config.yml', 'utf8'));

let failures = 0;
const report = (ok, msg) => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${msg}`);
  if (!ok) failures++;
};

/** Field names the CMS exposes for a given file collection, one level deep. */
function cmsFields(fileName) {
  for (const c of cms.collections) {
    for (const f of c.files ?? []) {
      if (f.file.endsWith(fileName)) return f.fields;
    }
  }
  return null;
}

/** Walk a CMS field tree into dotted paths, mirroring the JSON shape. */
function fieldPaths(fields, prefix = '') {
  const out = [];
  for (const f of fields ?? []) {
    const path = prefix ? `${prefix}.${f.name}` : f.name;
    out.push(path);
    if (f.fields) out.push(...fieldPaths(f.fields, f.widget === 'list' ? `${path}[]` : path));
  }
  return out;
}

/** Walk actual JSON data into the same dotted-path vocabulary. */
function dataPaths(value, prefix = '') {
  const out = [];
  if (Array.isArray(value)) {
    // Only the first element — every item shares a shape.
    if (value.length) out.push(...dataPaths(value[0], `${prefix}[]`));
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      const path = prefix ? `${prefix}.${k}` : k;
      out.push(path);
      out.push(...dataPaths(v, path));
    }
  }
  return out;
}

console.log('Site data files');
for (const file of ['profile.json', 'projects.json', 'publications.json']) {
  const data = JSON.parse(readFileSync(`src/data/${file}`, 'utf8'));
  const fields = cmsFields(file);
  if (!fields) {
    report(false, `${file} — no file collection in config.yml`);
    continue;
  }
  const exposed = new Set(fieldPaths(fields));
  const actual = dataPaths(data).filter((p) => !p.endsWith('[]'));
  const missing = actual.filter((p) => !exposed.has(p));
  report(missing.length === 0, `${file} — ${actual.length} field(s)${missing.length ? `, NOT editable: ${missing.join(', ')}` : ', all editable'}`);
}

console.log('\nBlog posts');
{
  const blog = cms.collections.find((c) => c.name === 'blog');
  const cmsNames = new Set((blog?.fields ?? []).map((f) => f.name));

  // The Zod schema is the contract the build enforces; parse the field names
  // out of it rather than restating them here.
  const schema = readFileSync('src/content.config.ts', 'utf8');
  const body = schema.slice(schema.indexOf('z.object({'), schema.indexOf('export const collections'));
  const schemaNames = [...body.matchAll(/^\s{4}(\w+):/gm)].map((m) => m[1]);

  const missing = schemaNames.filter((n) => !cmsNames.has(n));
  const extra = [...cmsNames].filter((n) => n !== 'body' && !schemaNames.includes(n));

  report(missing.length === 0, `schema fields exposed in CMS${missing.length ? ` — MISSING: ${missing.join(', ')}` : ` — all ${schemaNames.length}`}`);
  report(extra.length === 0, `no CMS-only fields${extra.length ? ` — EXTRA: ${extra.join(', ')}` : ''}`);
  report(cmsNames.has('body'), 'markdown body field present');
}

console.log('\nUI strings');
{
  // The one thing the CMS deliberately cannot reach.
  const ui = readFileSync('src/i18n/ui.ts', 'utf8');
  const keys = new Set([...ui.matchAll(/^\s{4}'([\w.]+)':/gm)].map((m) => m[1]));
  console.log(
    `  note  ${keys.size} interface strings live in src/i18n/ui.ts and are edited in code, not in the CMS.`
  );
}

console.log('\nPosts on disk');
{
  const files = readdirSync('src/content/blog').filter((f) => /\.mdx?$/.test(f));
  console.log(`  note  ${files.length} post(s): ${files.join(', ')}`);
}

console.log(
  `\n${failures === 0 ? 'Every content field is reachable from the CMS.' : `${failures} coverage gap(s).`}`
);
process.exit(failures === 0 ? 0 : 1);
