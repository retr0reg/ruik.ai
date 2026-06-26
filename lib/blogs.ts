import { getBlogs, BlogEntry } from "./notion";
import { getExternalBlogs } from "./external-blog";

export type { BlogEntry } from "./notion";

// Merge locally-hosted blogs (Notion) with externally-indexed ones (retr0.blog),
// sorted newest first. A failure in either source is swallowed by the underlying
// getters, so one source being down never blanks the whole list.
export async function getAllBlogs(): Promise<BlogEntry[]> {
  const [local, external] = await Promise.all([
    getBlogs(),
    getExternalBlogs(),
  ]);

  return [...local, ...external].sort((a, b) => {
    const ta = a.date ? Date.parse(a.date) : 0;
    const tb = b.date ? Date.parse(b.date) : 0;
    return tb - ta;
  });
}
