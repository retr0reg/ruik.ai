import { listPrefix, prefixFromPath, formatSize, NotesListing } from "@/lib/r2";
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

function hrefFor(segments: string[]): string {
  if (segments.length === 0) return "/notes";
  return "/notes/" + segments.map(encodeURIComponent).join("/");
}

interface PageProps {
  params: Promise<{ path?: string[] }>;
}

export default async function NotesPage({ params }: PageProps) {
  const { path } = await params;
  const segments = (path ?? []).map((s) => decodeURIComponent(s));
  const prefix = prefixFromPath(segments);

  let listing: NotesListing = { folders: [], files: [] };
  let error: string | null = null;
  try {
    listing = await listPrefix(prefix);
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load notes";
  }

  const isRoot = segments.length === 0;
  const isEmpty = !error && listing.folders.length === 0 && listing.files.length === 0;

  return (
    <div className="container">
      <h1>Ruikai Peng</h1>

      {/* <p>a miscellaneous drive</p> */}

      <nav className="notes-breadcrumbs">
        <Link href="/notes" className="notes-crumb">./</Link>
        {segments.map((seg, i) => {
          const upTo = segments.slice(0, i + 1);
          const last = i === segments.length - 1;
          return (
            <span key={i}>
              {i > 0 && <span className="notes-crumb-sep">/</span>}
              {last ? (
                <span className="notes-crumb active">{seg}</span>
              ) : (
                <Link href={hrefFor(upTo)} className="notes-crumb">{seg}</Link>
              )}
            </span>
          );
        })}
      </nav>

      <div className="blog-list">
        {listing.folders.map((folder) => (
          <article key={folder.path} className="blog-entry">
            <Link
              href={hrefFor([...segments, folder.name])}
              className="blog-title notes-folder"
            >
              {folder.name}/
            </Link>
            <span className="blog-meta">folder</span>
          </article>
        ))}

        {listing.files.map((entry) => (
          <article key={entry.key} className="blog-entry">
            <a
              href={entry.url}
              target="_blank"
              rel="noopener noreferrer"
              className="blog-title"
            >
              {entry.title}
            </a>
            <span className="blog-meta">
              {entry.ext && <span className="notes-ext">{entry.ext}</span>}
              {entry.ext && " · "}
              {formatSize(entry.size)}
              {entry.lastModified && " · "}
              {formatDate(entry.lastModified)}
            </span>
          </article>
        ))}

        {isEmpty && (
          <p className="blog-empty">{isRoot ? "No notes yet." : "Empty folder."}</p>
        )}
        {error && (
          <p className="blog-empty">Could not load notes: {error}</p>
        )}
      </div>

      <footer className="footer-nav">
        <Link href="/" className="nav-item">home</Link>
        <Link href="/blog" className="nav-item">blog</Link>
        <span className="nav-item active">notes</span>
      </footer>
    </div>
  );
}
