import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
// Imported from `zod` directly: astro:content's `z` re-export is deprecated.
import { z } from 'zod';

/**
 * An optional date that tolerates being blank.
 *
 * The CMS writes `updated: ''` when you leave an optional datetime empty, and
 * `z.coerce.date()` turns that into an Invalid Date rather than rejecting it —
 * which surfaces as the baffling "Expected type date, received object" and
 * fails the build. Empty and null are normalised to undefined first.
 */
const optionalDate = z.preprocess(
  (v) => (v === '' || v === null ? undefined : v),
  z.coerce.date().optional()
);

// Every field here must stay in lockstep with public/admin/config.yml.
// If the CMS writes a field this schema does not know about, the build fails —
// which is the behaviour we want, but it means the two files change together.
const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    // Astro's glob loader uses a `slug` in the frontmatter as the entry id in
    // preference to the filename, so this — not the file name — is what decides
    // the URL. `zh-first-post.md` with `slug: test` is served at /zh/blog/test.
    slug: z.string().optional(),
    date: z.coerce.date(),
    updated: optionalDate,
    // No `lang` field: posts are written in Chinese only. The site chrome is
    // still bilingual, so every post is reachable from both shells (/blog/… and
    // /zh/blog/…) — but there is one article, not a translated pair.
    summary: z.string().optional().transform((v) => v || undefined),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog };
