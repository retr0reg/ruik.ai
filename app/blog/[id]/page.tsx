import Link from "next/link";
import { notFound } from "next/navigation";
import { parseMarkdown } from "@/lib/markdown";
import { getBlogs, getPageContent } from "@/lib/notion";

interface BlogPostPageProps {
  params: Promise<{ id: string }>;
}

// Revalidate every 5 minutes
export const revalidate = 300;

// Generate all blog pages at build time
export async function generateStaticParams() {
  const blogs = await getBlogs();
  return blogs.map((blog) => ({ id: blog.id }));
}

export async function generateMetadata({ params }: BlogPostPageProps) {
  const { id } = await params;

  const blogs = await getBlogs();
  const blog = blogs.find((b) => b.id === id);

  if (blog) {
    return { title: `${blog.title} | Ruikai Peng` };
  }

  return { title: "Not Found | Ruikai Peng" };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { id } = await params;

  // Find the blog entry
  const blogs = await getBlogs();
  const blog = blogs.find((b) => b.id === id);

  if (!blog) {
    notFound();
  }

  // Fetch content from Notion page
  const pageContent = await getPageContent(blog.pageId);
  let markdown = pageContent.markdown;
  const author = blog.author || pageContent.author;

  // Add title if not present
  if (markdown && !markdown.startsWith("#")) {
    markdown = `# ${blog.title}\n\n${markdown}`;
  }

  if (!markdown) {
    notFound();
  }

  let html = parseMarkdown(markdown);

  // Inject author after the title (first h1)
  if (author) {
    let authorHtml = author;
    if (author === "Ruikai Peng") {
      authorHtml = `<a href="/" class="stealth-link">${author}</a>`;
    }
    html = html.replace(
      /<\/h1>/,
      `</h1><div class="writeup-author">${authorHtml}</div>`
    );
  }

  return (
    <div className="container writeup-container">
      <nav className="writeup-nav">
        <Link href="/blog">← Back</Link>
      </nav>
      <article
        className="writeup-content"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
