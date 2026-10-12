import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'posts'>;

export async function getPosts() {
  return (await getCollection('posts', ({ data }) => !data.draft))
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

export function readingTime(body = '') {
  const text = body.replace(/<[^>]*>/g, '').replace(/\`{3}[\s\S]*?\`{3}/g, '');
  const chinese = (text.match(/[\u3400-\u9fff]/g) || []).length;
  const words = text.replace(/[\u3400-\u9fff]/g, '').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(chinese / 350 + words / 200));
}

export function formatDate(date: Date, format: 'short' | 'long' = 'short') {
  return new Intl.DateTimeFormat('zh-CN', format === 'long'
    ? { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }
    : { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'UTC' }
  ).format(date).replaceAll('/', '.');
}

export const postUrl = (post: Post) => `/posts/${post.id}/`;

export function getTags(posts: Post[]) {
  const counts = new Map<string, number>();
  posts.forEach((post) => post.data.tags.forEach((tag) => counts.set(tag, (counts.get(tag) || 0) + 1)));
  return [...counts].sort((a, b) => b[1] - a[1]);
}
