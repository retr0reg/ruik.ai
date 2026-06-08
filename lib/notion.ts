import { Client } from "@notionhq/client";
import { NotionToMarkdown } from "notion-to-md";
import { uploadNotionImage } from "./r2";

const BLOG_DATABASE_ID = process.env.NOTION_BLOG_DATABASE_ID;

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

// Process markdown to mirror all remote images into R2
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
      // Only mirror remote URLs (not local paths)
      if (m.url.startsWith("http://") || m.url.startsWith("https://")) {
        const r2Url = await uploadNotionImage(m.url);
        const titlePart = m.title ? ` "${m.title}"` : "";
        return { original: m.full, replacement: `![${m.alt}](${r2Url}${titlePart})` };
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

    // Mirror images to R2 so signed Notion URLs don't expire
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
