import type { APIRoute } from 'astro';
import { getPosts, postUrl, formatDate } from '../lib/posts';
export const GET: APIRoute = async () => {
  const entries = (await getPosts()).map((post) => ({
    title: post.data.title, description: post.data.description,
    tags: post.data.tags, url: postUrl(post), date: formatDate(post.data.date),
  }));
  return new Response(JSON.stringify(entries), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
};
