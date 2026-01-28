import { marked, Tokens } from "marked";
import Prism from "prismjs";

// Load Prism languages
import "prismjs/components/prism-c";
import "prismjs/components/prism-python";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-javascript";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function isImageFilename(text: string): boolean {
  return /\.(png|jpe?g|gif|webp|svg)$/i.test(text.trim());
}

marked.use({
  renderer: {
    code(token: Tokens.Code): string {
      const { text, lang } = token;
      const language = lang || "";
      const langLabel = language
        ? `<span class="code-lang">${language}</span>`
        : "";

      let highlighted: string;
      if (language && Prism.languages[language]) {
        highlighted = Prism.highlight(text, Prism.languages[language], language);
      } else {
        highlighted = escapeHtml(text);
      }

      return `<div class="code-block">${langLabel}<pre class="language-${language}"><code class="language-${language}">${highlighted}</code></pre></div>`;
    },

    codespan(token: Tokens.Codespan): string {
      return `<code class="inline-code">${escapeHtml(token.text)}</code>`;
    },

    image(token: Tokens.Image): string {
      const { href, title, text } = token;
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
      const caption =
        text && !isImageFilename(text) ? `<figcaption>${escapeHtml(text)}</figcaption>` : "";
      return `<figure class="writeup-figure"><img src="${href}" alt="${escapeHtml(text)}"${titleAttr} loading="lazy">${caption}</figure>`;
    },
  },
});

export function parseMarkdown(markdown: string): string {
  // Pre-process for Obsidian image syntax ![[filename]]
  let processed = markdown.replace(
    /!\[\[([^\]]+)\]\]/g,
    (_, filename: string) => {
      return `<figure class="writeup-figure"><img src="/mds/${filename}" alt="${filename}" loading="lazy"></figure>`;
    }
  );

  // Fix notion-to-md quirks with mixed formatting (italics + code)
  // Pattern: _`code`__ or _`code`_; becomes malformed
  // Fix double underscores that appear after backticks
  processed = processed.replace(/`__/g, "`_ ");
  processed = processed.replace(/__`/g, " _`");
  
  // Fix patterns like `__;_ (italic end + semicolon + italic start)
  processed = processed.replace(/`__;_/g, "`_; _");
  processed = processed.replace(/`__,_/g, "`_, _");
  processed = processed.replace(/`__\)_/g, "`_) _");
  
  // Clean up adjacent italic markers with only whitespace
  // e.g., "_ _" or "_  _" in the middle of text
  processed = processed.replace(/_ +_/g, " ");

  return marked.parse(processed) as string;
}
