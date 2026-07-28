import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getPosts } from '../lib/posts';
import profile from '../data/profile.json';

// One feed. Posts are Chinese only, and each item links to the unprefixed
// /blog/<slug> so a subscriber lands on one stable URL rather than whichever
// language shell happened to generate the feed.
export async function GET(context: APIContext) {
  const posts = await getPosts();

  return rss({
    title: profile.name.en,
    description: profile.bio.en.split('\n')[0],
    site: context.site ?? 'https://example.com',
    items: posts.map((post) => ({
      title: post.data.title,
      pubDate: post.data.date,
      description: post.data.summary ?? '',
      link: `/blog/${post.id}`,
      categories: post.data.tags,
    })),
    customData: '<language>zh-CN</language>',
  });
}
