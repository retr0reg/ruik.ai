import { BlogEntry } from "./notion";

// retr0.blog publishes an RSS feed of its blog posts. We index it here so the
// ruik.ai blog list can show those posts alongside the locally-hosted ones,
// linking out to retr0.blog rather than to an internal /blog/[id] route.
const FEED_URL =
  process.env.RETRO_BLOG_FEED_URL || "https://retr0.blog/api/rss/feed.xml";
// Base used to build outbound post links. The feed's own <link> values point at
// a different host with a doubled /blog/blog/ path, so we keep only the slug.
const BLOG_BASE = process.env.RETRO_BLOG_BASE_URL || "https://retr0.blog";
const SOURCE = "retr0.blog";
// Only index posts published on or after this date.
const MIN_DATE = Date.parse("2024-05-10T00:00:00Z");

// Strip a CDATA wrapper and decode the handful of XML entities feeds use.
function cleanText(raw: string): string {
  let s = raw.trim();
  const cdata = s.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  if (cdata) s = cdata[1];
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}

// Split a title into a main heading and subtitle on the first spaced dash
// (" - ", "–", "—") or colon. The dash must be surrounded by whitespace so
// hyphenated words like "Supply-Chain" or "Heap-Overflow" stay intact.
function splitTitle(title: string): { main: string; subtitle: string } {
  const m = title.match(/\s+[-–—]\s+|\s*:\s+/);
  if (!m || m.index === undefined) return { main: title, subtitle: "" };
  return {
    main: title.slice(0, m.index).trim(),
    subtitle: title.slice(m.index + m[0].length).trim(),
  };
}

function extractTag(block: string, tag: string): string {
  const m = block.match(
    new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i")
  );
  return m ? cleanText(m[1]) : "";
}

// Turn a feed <link> into a working retr0.blog post URL using its slug.
function toBlogUrl(feedLink: string): string {
  try {
    const segs = new URL(feedLink).pathname.split("/").filter(Boolean);
    const slug = segs[segs.length - 1];
    if (slug) return `${BLOG_BASE}/blog/${slug}`;
  } catch {
    // fall through
  }
  return feedLink;
}

export async function getExternalBlogs(): Promise<BlogEntry[]> {
  try {
    const res = await fetch(FEED_URL, { next: { revalidate: 300 } });
    if (!res.ok) {
      console.error(`Failed to fetch retr0.blog feed: ${res.status}`);
      return [];
    }

    const xml = await res.text();
    const entries: BlogEntry[] = [];

    const itemRegex = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
    let match: RegExpExecArray | null;
    while ((match = itemRegex.exec(xml)) !== null) {
      const block = match[1];
      const title = extractTag(block, "title");
      const link = extractTag(block, "link") || extractTag(block, "guid");
      if (!title || !link) continue;

      const pubDate = extractTag(block, "pubDate");

      let date = "";
      let ts = NaN;
      if (pubDate) {
        const parsed = new Date(pubDate);
        if (!isNaN(parsed.getTime())) {
          date = parsed.toISOString();
          ts = parsed.getTime();
        }
      }

      // Skip posts published before the cutoff.
      if (isNaN(ts) || ts < MIN_DATE) continue;

      const url = toBlogUrl(link);
      const slug = url.split("/").filter(Boolean).pop() || link;
      const { main, subtitle } = splitTitle(title);

      entries.push({
        id: `ext-${slug}`,
        title: main,
        subtitle,
        author: "",
        date,
        pageId: "",
        external: true,
        url,
        source: SOURCE,
      });
    }

    return entries;
  } catch (error) {
    console.error("Failed to fetch external blogs:", error);
    return [];
  }
}
