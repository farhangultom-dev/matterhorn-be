import type { BlogRecord, BlogSummaryRecord } from '../models/blog.model';

export interface PublicBlogSummary {
  readonly id: string;
  readonly authorUserId: string;
  readonly title: string;
  readonly slug: string;
  readonly excerpt: string | null;
  readonly coverUrl: string | null;
  readonly status: 'draft' | 'published';
  readonly publishedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PublicBlog extends PublicBlogSummary {
  readonly content: string;
}

export const presentBlogSummary = (blog: BlogSummaryRecord): PublicBlogSummary => ({
  id: blog.id,
  authorUserId: blog.author_user_id,
  title: blog.title,
  slug: blog.slug,
  excerpt: blog.excerpt,
  coverUrl: blog.cover_url,
  status: blog.status,
  publishedAt: blog.published_at?.toISOString() ?? null,
  createdAt: blog.created_at.toISOString(),
  updatedAt: blog.updated_at.toISOString(),
});

export const presentBlog = (blog: BlogRecord): PublicBlog => ({
  ...presentBlogSummary(blog),
  content: blog.content,
});
