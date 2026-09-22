import fs from "fs";
import path from "path";

// Journal entries for the Technology Seminar class. Plain .md files on disk —
// drop a file in content/seminar/, redeploy, done.
export const SEMINAR_DIR = path.join(process.cwd(), "content", "seminar");

// Images referenced with a bare/relative path in an entry resolve against this
// public folder, e.g. ![the rig](rig.png) -> /seminar-media/rig.png
export const SEMINAR_MEDIA_BASE = "/seminar-media/";

export interface SeminarEntry {
  slug: string;
  title: string;
  date: string;
  subtitle?: string;
  draft: boolean;
  content: string;
}

// Minimal frontmatter reader: `key: value` pairs between --- fences. Enough for
// title/date/subtitle/draft; no YAML dependency needed.
function splitFrontmatter(raw: string): {
  meta: Record<string, string>;
  body: string;
} {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
  if (!match) return { meta: {}, body: raw };

  const meta: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const pair = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(line.trim());
    if (!pair) continue;
    meta[pair[1].toLowerCase()] = pair[2].trim().replace(/^["']|["']$/g, "");
  }

  return { meta, body: raw.slice(match[0].length) };
}

// Filenames may be date-prefixed (2026-09-21-first-day.md). The prefix sets the
// date when frontmatter omits one, and is stripped from the slug.
function parseFilename(filename: string): { slug: string; date: string } {
  const base = filename.replace(/\.md$/i, "");
  const dated = /^(\d{4}-\d{2}-\d{2})[-_ ]+(.+)$/.exec(base);
  if (dated) return { slug: dated[2], date: dated[1] };
  return { slug: base, date: "" };
}

function firstHeading(body: string): string {
  const heading = /^#\s+(.+)$/m.exec(body);
  return heading ? heading[1].trim() : "";
}

function titleFromSlug(slug: string): string {
  return slug.replace(/[-_]+/g, " ");
}

function readEntry(filename: string): SeminarEntry | null {
  let raw: string;
  try {
    raw = fs.readFileSync(path.join(SEMINAR_DIR, filename), "utf8");
  } catch {
    return null;
  }

  const { meta, body } = splitFrontmatter(raw);
  const { slug, date } = parseFilename(filename);

  return {
    slug,
    title: meta.title || firstHeading(body) || titleFromSlug(slug),
    date: meta.date || date,
    subtitle: meta.subtitle || meta.summary || undefined,
    draft: /^(true|yes|1)$/i.test(meta.draft ?? ""),
    content: body.trim(),
  };
}

// Drafts stay visible while running `next dev` so entries can be written and
// previewed before they go up.
const showDrafts = process.env.NODE_ENV === "development";

export function getSeminarEntries(): SeminarEntry[] {
  let filenames: string[];
  try {
    filenames = fs.readdirSync(SEMINAR_DIR);
  } catch {
    return [];
  }

  return filenames
    .filter((name) => name.toLowerCase().endsWith(".md"))
    .filter((name) => !name.startsWith("_") && !/^readme\.md$/i.test(name))
    .map(readEntry)
    .filter((entry): entry is SeminarEntry => entry !== null)
    .filter((entry) => showDrafts || !entry.draft)
    .sort((a, b) => {
      const ta = a.date ? Date.parse(a.date) : 0;
      const tb = b.date ? Date.parse(b.date) : 0;
      if (tb !== ta) return tb - ta;
      return a.slug.localeCompare(b.slug);
    });
}

export function getSeminarEntry(slug: string): SeminarEntry | undefined {
  return getSeminarEntries().find((entry) => entry.slug === slug);
}

export function formatEntryDate(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}
