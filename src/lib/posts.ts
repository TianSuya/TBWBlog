import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'blog'>;

/** Drafts are visible while writing locally and never make it into a build. */
const isPublished = (post: Post) => import.meta.env.DEV || !post.data.draft;

const byNewest = (a: Post, b: Post) => b.data.date.valueOf() - a.data.date.valueOf();

/**
 * Every published post, newest first.
 *
 * Posts are Chinese only and carry no language of their own, so there is a
 * single list. Both site shells render it — the English pages wrap the same
 * Chinese articles in English navigation.
 */
export async function getPosts(): Promise<Post[]> {
  const all = await getCollection('blog');
  return all.filter(isPublished).sort(byNewest);
}

/** Group posts by year for the archive page. Returns newest year first. */
export function groupByYear(posts: Post[]): Array<[number, Post[]]> {
  const years = new Map<number, Post[]>();
  for (const post of posts) {
    const y = post.data.date.getUTCFullYear();
    if (!years.has(y)) years.set(y, []);
    years.get(y)!.push(post);
  }
  return [...years.entries()].sort((a, b) => b[0] - a[0]);
}
