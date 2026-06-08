import { Client } from "@notionhq/client";
import { NotionToMarkdown } from "notion-to-md";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const BLOG_DATABASE_ID = process.env.NOTION_BLOG_DATABASE_ID;

// Directory to cache downloaded images
const IMAGE_CACHE_DIR = path.join(process.cwd(), "public", "notion-images");

// Create client lazily to ensure env vars are loaded
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getNotionClient(): any {
  if (!process.env.NOTION_SECRET) {
    throw new Error("NOTION_SECRET not set");
  }
  return new Client({
    auth: process.env.NOTION_SECRET,
  });
}

// Helper types for cleaner code
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyProps = Record<string, any>;

export interface BlogEntry {
  id: string;
  title: string;
  author: string;
  date: string;
  pageId: string;
}

// Get plain text content (for database properties)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getRichTextContent(richText: any[]): string {
  if (!richText || !Array.isArray(richText)) return "";
  return richText.map((t) => t.plain_text || "").join("");
}

export async function getBlogs(): Promise<BlogEntry[]> {
  if (!BLOG_DATABASE_ID) {
    console.error("NOTION_BLOG_DATABASE_ID not set");
    return [];
  }

  try {
    const notion = getNotionClient();

    const response = await notion.databases.query({
      database_id: BLOG_DATABASE_ID,
      sorts: [
        {
          property: "Date",
          direction: "descending",
        },
      ],
    });

    const entries: BlogEntry[] = [];

    for (const page of response.results) {
      if (!("properties" in page)) continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pageObj = page as any;
      const props: AnyProps = pageObj.properties;

      // Extract properties - Title is typically the title property
      const titleProp = props["Name"] || props["Title"];
      const authorProp = props["Author"];
      const dateProp = props["Date"];

      const title =
        titleProp?.type === "title"
          ? getRichTextContent(titleProp.title)
          : "";

      // Author can be a person or rich_text
      let author = "";
      if (authorProp?.type === "people" && authorProp.people?.length > 0) {
        author = authorProp.people[0].name || "";
      } else if (authorProp?.type === "rich_text") {
        author = getRichTextContent(authorProp.rich_text);
      }

      const date =
        dateProp?.type === "date" && dateProp.date
          ? dateProp.date.start
          : "";

      if (title) {
        entries.push({
          id: pageObj.id,
          title,
          author,
          date,
          pageId: pageObj.id,
        });
      }
    }

    return entries;
  } catch (error) {
    console.error("Failed to fetch blogs from Notion:", error);
    return [];
  }
}

export interface PageContent {
  markdown: string;
  author: string | null;
}

// Download an image from URL and save it locally, returning the local path
async function cacheImage(url: string): Promise<string> {
  // Hash by URL path only (drop query string) so signed-URL signature churn
  // doesn't invalidate the cache between builds / revalidations.
  let hashKey = url;
  try {
    const parsed = new URL(url);
    hashKey = parsed.origin + parsed.pathname;
  } catch {
    // Not a parseable URL, fall back to raw string
  }
  const urlHash = crypto.createHash("md5").update(hashKey).digest("hex");

  // Extract extension from URL or default to png
  let ext = "png";
  const extMatch = url.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  if (extMatch) {
    const possibleExt = extMatch[1].toLowerCase();
    if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(possibleExt)) {
      ext = possibleExt;
    }
  }

  const filename = `${urlHash}.${ext}`;
  const localPath = path.join(IMAGE_CACHE_DIR, filename);
  const publicPath = `/notion-images/${filename}`;

  // If already cached (e.g., persisted from build), use it.
  if (fs.existsSync(localPath)) {
    return publicPath;
  }

  // Ensure cache directory exists. On Vercel runtime the /var/task FS is
  // read-only and this will throw — that's expected; fall through to the
  // fresh Notion URL, which is valid for ~1h from this revalidation.
  try {
    if (!fs.existsSync(IMAGE_CACHE_DIR)) {
      fs.mkdirSync(IMAGE_CACHE_DIR, { recursive: true });
    }
  } catch {
    return url;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Failed to fetch image: ${url}`);
      return url;
    }

    const buffer = await response.arrayBuffer();
    fs.writeFileSync(localPath, Buffer.from(buffer));
    console.log(`Cached image: ${filename}`);
    return publicPath;
  } catch (error) {
    console.error(`Failed to cache image: ${url}`, error);
    return url;
  }
}

// Process markdown to download and cache all images
async function cacheImagesInMarkdown(markdown: string): Promise<string> {
  // Match markdown images: ![alt](url) or ![alt](url "title")
  const imageRegex = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g;
  
  const matches: { full: string; alt: string; url: string; title?: string }[] = [];
  let match;
  
  while ((match = imageRegex.exec(markdown)) !== null) {
    matches.push({
      full: match[0],
      alt: match[1],
      url: match[2],
      title: match[3],
    });
  }

  // Download all images in parallel
  const replacements = await Promise.all(
    matches.map(async (m) => {
      // Only cache remote URLs (not local paths)
      if (m.url.startsWith("http://") || m.url.startsWith("https://")) {
        const localPath = await cacheImage(m.url);
        const titlePart = m.title ? ` "${m.title}"` : "";
        return { original: m.full, replacement: `![${m.alt}](${localPath}${titlePart})` };
      }
      return { original: m.full, replacement: m.full };
    })
  );

  // Apply replacements
  let result = markdown;
  for (const { original, replacement } of replacements) {
    result = result.replace(original, replacement);
  }

  return result;
}

export async function getPageContent(pageId: string): Promise<PageContent> {
  try {
    const notion = getNotionClient();
    const n2m = new NotionToMarkdown({ notionClient: notion });

    // Fetch page metadata to get author
    const page = await notion.pages.retrieve({ page_id: pageId });
    let author: string | null = null;
    
    if ("created_by" in page && page.created_by?.id) {
      try {
        const user = await notion.users.retrieve({ user_id: page.created_by.id });
        author = user.name || null;
      } catch {
        // User fetch failed, continue without author
      }
    }

    // Convert page to markdown blocks
    const mdBlocks = await n2m.pageToMarkdown(pageId);

    // Convert blocks to markdown string
    const mdString = n2m.toMarkdownString(mdBlocks);

    // Cache all images locally so they don't expire
    const markdownWithCachedImages = await cacheImagesInMarkdown(mdString.parent);

    return {
      markdown: markdownWithCachedImages,
      author,
    };
  } catch (error) {
    console.error("Failed to fetch page content:", error);
    return { markdown: "", author: null };
  }
}
