import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getPosts, postUrl } from '../lib/posts';
import { site } from '../config';
export async function GET(context: APIContext) {
  return rss({
    title: site.title, description: site.description, site: context.site!,
    items: (await getPosts()).map((post) => ({
      title: post.data.title, description: post.data.description,
      pubDate: post.data.date, link: postUrl(post), categories: post.data.tags,
      author: `${site.email} (${site.author})`,
    })),
    customData: '<language>zh-cn</language>',
  });
}
