export const languages = { en: 'English', zh: '中文' } as const;
export const defaultLang = 'en' as const;

export type Lang = keyof typeof languages;

/** A field that carries both language variants, as stored in src/data/*.json. */
export type Bilingual = { en: string; zh: string };

export const ui = {
  en: {
    'nav.home': 'Home',
    'nav.blog': 'Blog',
    'nav.publications': 'Publications',
    'nav.archive': 'Archive',
    'nav.sitemap': 'Site Map',
    'nav.search': 'Search',

    'side.navigation': 'Navigation',
    'side.recent': 'Recent Posts',
    'side.language': 'Language',
    'side.display': 'Display',
    'side.syndication': 'Syndication',

    'home.interests': 'Research Interests',
    'home.projects': 'Current Projects',
    'home.publications': 'Selected Publications',
    'home.posts': 'Recent Writing',
    'home.allPublications': 'full publication list',
    'home.allPosts': 'all posts',

    'blog.title': 'Blog',
    'blog.empty': 'No posts yet.',
    'blog.readMore': 'read more',
    'blog.posted': 'Posted',
    'blog.updated': 'Updated',
    'blog.tags': 'Tags',
    'blog.draft': 'DRAFT',
    'blog.backToList': 'back to the post list',

    'pub.title': 'Publications',
    'pub.empty': 'No publications listed yet.',

    'archive.title': 'Archive',
    'archive.blurb': 'Everything ever posted here, newest first.',
    'archive.count': 'posts',

    'sitemap.title': 'Site Map',
    'sitemap.blurb': 'Every page on this site, in one list.',
    'sitemap.pages': 'Pages',
    'sitemap.posts': 'Posts',
    'sitemap.feeds': 'Feeds and Machine-Readable',

    'search.title': 'Search',
    'search.placeholder': 'enter search terms',
    'search.button': 'Search',
    'search.loading': 'Searching...',
    'search.noResults': 'No documents matched your query.',
    'search.results': 'result(s)',
    'search.hint': 'Searches the full text of every post on this site.',

    'theme.toggle': 'Toggle light / dark',
    'theme.light': 'Light',
    'theme.dark': 'Dark',

    'footer.bestViewed': 'Best viewed in Netscape Navigator 4.0 at 800×600',
    'footer.madeWith': 'Made with Notepad',
    'footer.validate': 'Valid HTML5',
    'footer.lastUpdated': 'Last updated',
    'footer.rss': 'RSS',

    'status.active': 'active',
    'status.paused': 'paused',
    'status.done': 'completed',

    'notfound.title': '404 Not Found',
    'notfound.blurb':
      'The requested URL was not found on this server. It may have been moved, or it may never have existed.',
    'notfound.home': 'Return to the home page',
  },
  zh: {
    'nav.home': '首页',
    'nav.blog': '博客',
    'nav.publications': '论文',
    'nav.archive': '归档',
    'nav.sitemap': '站点地图',
    'nav.search': '搜索',

    'side.navigation': '导航',
    'side.recent': '最近文章',
    'side.language': '语言',
    'side.display': '显示',
    'side.syndication': '订阅',

    'home.interests': '研究兴趣',
    'home.projects': '在研项目',
    'home.publications': '代表性论文',
    'home.posts': '最近的文章',
    'home.allPublications': '完整论文列表',
    'home.allPosts': '全部文章',

    'blog.title': '博客',
    'blog.empty': '还没有文章。',
    'blog.readMore': '阅读全文',
    'blog.posted': '发表于',
    'blog.updated': '更新于',
    'blog.tags': '标签',
    'blog.draft': '草稿',
    'blog.backToList': '返回文章列表',

    'pub.title': '论文',
    'pub.empty': '暂无论文。',

    'archive.title': '归档',
    'archive.blurb': '本站全部文章，按时间倒序。',
    'archive.count': '篇',

    'sitemap.title': '站点地图',
    'sitemap.blurb': '本站所有页面，一览无余。',
    'sitemap.pages': '页面',
    'sitemap.posts': '文章',
    'sitemap.feeds': '订阅与机器可读格式',

    'search.title': '搜索',
    'search.placeholder': '输入搜索词',
    'search.button': '搜索',
    'search.loading': '搜索中……',
    'search.noResults': '没有匹配的文档。',
    'search.results': '条结果',
    'search.hint': '搜索本站所有文章的全文。',

    'theme.toggle': '切换亮色 / 深色',
    'theme.light': '亮色',
    'theme.dark': '深色',

    'footer.bestViewed': '建议使用 Netscape Navigator 4.0 于 800×600 分辨率浏览',
    'footer.madeWith': '用记事本制作',
    'footer.validate': '通过 HTML5 验证',
    'footer.lastUpdated': '最后更新',
    'footer.rss': 'RSS',

    'status.active': '进行中',
    'status.paused': '暂停',
    'status.done': '已完成',

    'notfound.title': '404 页面不存在',
    'notfound.blurb': '服务器上没有找到请求的地址。它可能已被移动，也可能从未存在过。',
    'notfound.home': '返回首页',
  },
} as const;

/** Chinese counters read wrong in English word order ("你是第 127 位访客"). */
export const counterSuffix = { en: '', zh: '位访客' } as const;

/**
 * Full-width punctuation for Chinese. Joining with ", " and labelling with ":"
 * looks visibly foreign in CJK text, so the separators are localised too.
 */
export const punct = {
  en: { colon: ': ', comma: ', ', lparen: ' (', rparen: ')' },
  zh: { colon: '：', comma: '，', lparen: '（', rparen: '）' },
} as const;

export function getLangFromUrl(url: URL): Lang {
  const [, first] = url.pathname.split('/');
  if (first in languages) return first as Lang;
  return defaultLang;
}

export function useTranslations(lang: Lang) {
  return function t(key: keyof (typeof ui)['en']): string {
    return ui[lang][key] ?? ui[defaultLang][key];
  };
}

/** Pick the right half of a { en, zh } field, falling back to English. */
export function pick(field: Bilingual | string, lang: Lang): string {
  if (typeof field === 'string') return field;
  return field[lang] || field[defaultLang];
}

/** Prefix a root-relative path with the locale segment. `/blog` -> `/zh/blog`. */
export function localizePath(path: string, lang: Lang): string {
  if (lang === defaultLang) return path;
  return path === '/' ? `/${lang}/` : `/${lang}${path}`;
}

/** The same page in the other language, for the [English] | [中文] switcher. */
export function alternatePath(url: URL, target: Lang): string {
  const current = getLangFromUrl(url);
  if (current === target) return url.pathname;
  const stripped =
    current === defaultLang ? url.pathname : url.pathname.replace(`/${current}`, '') || '/';
  return localizePath(stripped, target);
}

export function formatDate(date: Date, lang: Lang): string {
  // Deliberately ISO-ish and unambiguous — this is an academic site, not a magazine.
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return lang === 'zh' ? `${y} 年 ${Number(m)} 月 ${Number(d)} 日` : `${y}-${m}-${d}`;
}
