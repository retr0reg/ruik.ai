import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { parseMarkdown } from "@/lib/markdown";
import {
  getSeminarEntries,
  getSeminarEntry,
  formatEntryDate,
  SEMINAR_MEDIA_BASE,
} from "@/lib/seminar";

interface SeminarEntryPageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return getSeminarEntries().map((entry) => ({ slug: entry.slug }));
}

export async function generateMetadata({
  params,
}: SeminarEntryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const entry = getSeminarEntry(slug);

  return {
    title: entry
      ? `${entry.title} | Technology Seminar`
      : "Not Found | Ruikai Peng",
    // Unlisted: reachable by URL only, kept out of search engines.
    robots: { index: false, follow: false },
  };
}

export default async function SeminarEntryPage({
  params,
}: SeminarEntryPageProps) {
  const { slug } = await params;
  const entry = getSeminarEntry(slug);

  if (!entry) {
    notFound();
  }

  let markdown = entry.content;
  if (!markdown.startsWith("#")) {
    markdown = `# ${entry.title}\n\n${markdown}`;
  }

  let html = parseMarkdown(markdown, { imageBase: SEMINAR_MEDIA_BASE });

  const date = formatEntryDate(entry.date);
  if (date) {
    html = html.replace(
      /<\/h1>/,
      `</h1><div class="writeup-author">${date}</div>`
    );
  }

  return (
    <div className="container writeup-container">
      <nav className="writeup-nav">
        <Link href="/seminar">← Back</Link>
      </nav>
      <article
        className="writeup-content"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
