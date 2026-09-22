import Link from "next/link";
import type { Metadata } from "next";
import { getSeminarEntries, formatEntryDate } from "@/lib/seminar";

// Unlisted: reachable by URL only, kept out of search engines.
export const metadata: Metadata = {
  title: "Technology Seminar | Ruikai Peng",
  description: "Project journal for Technology Seminar.",
  robots: { index: false, follow: false },
};

export default function SeminarPage() {
  const entries = getSeminarEntries();

  return (
    <div className="container">
      <h1>Ruikai Peng</h1>

      <div className="blog-list">
        {entries.map((entry) => (
          <article key={entry.slug} className="blog-entry">
            <Link href={`/seminar/${entry.slug}`} className="blog-title">
              {entry.title}
            </Link>
            {entry.subtitle && (
              <span className="blog-subtitle">{entry.subtitle}</span>
            )}
            <span className="blog-meta">
              {formatEntryDate(entry.date)}
              {entry.draft && " · draft"}
            </span>
          </article>
        ))}
        {entries.length === 0 && <p className="blog-empty">No entries yet.</p>}
      </div>

      <footer className="footer-nav">
        <Link href="/" className="nav-item">home</Link>
        <Link href="/blog" className="nav-item">blog</Link>
        <span className="nav-item active">seminar</span>
      </footer>
    </div>
  );
}
