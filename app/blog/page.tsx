import { getBlogs, BlogEntry } from "@/lib/notion";
import Link from "next/link";

// Revalidate every 5 minutes
export const revalidate = 300;

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function BlogPage() {
  const entries = await getBlogs();

  return (
    <div className="container">
      <h1>Ruikai Peng</h1>

      <div className="blog-list">
        {entries.map((entry: BlogEntry) => (
          <article key={entry.id} className="blog-entry">
            <Link href={`/blog/${entry.id}`} className="blog-title">
              {entry.title}
            </Link>
            <span className="blog-meta">
              {entry.author}{entry.author && entry.date && " · "}{formatDate(entry.date)}
            </span>
          </article>
        ))}
        {entries.length === 0 && (
          <p className="blog-empty">No posts yet.</p>
        )}
      </div>

      <div className="blog-footer-note">
        for my bugs storytell<br />
        visit <a href="https://retr0.blog" className="blog-footer-link">retr0.blog</a>
      </div>

      <footer className="footer-nav">
        <Link href="/" className="nav-item">home</Link>
        <span className="nav-item active">blog</span>
        <Link href="/notes" className="nav-item">notes</Link>
      </footer>
    </div>
  );
}
