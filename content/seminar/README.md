# Technology Seminar journal

Entries live in this folder as plain markdown. Add a file, push, done — the
index at `/seminar` and the entry page at `/seminar/<slug>` build themselves.

## New entry

Create `content/seminar/YYYY-MM-DD-some-slug.md`:

~~~markdown
---
title: Soldering the first board
date: 2026-09-24
subtitle: optional one-liner shown under the title on the index
---

Body text here. Normal markdown: **bold**, _italic_, `code`, lists, tables,
links, blockquotes, and fenced code blocks with highlighting:

```python
print("hello")
```
~~~

- The `YYYY-MM-DD-` prefix on the filename is optional but recommended — it sets
  the date and gets stripped from the URL (`.../2026-09-24-some-slug.md`
  becomes `/seminar/some-slug`).
- `date:` in the frontmatter wins over the filename prefix.
- Everything in the frontmatter is optional. With no `title:`, the first `#`
  heading is used; with neither, the slug is.
- `draft: true` hides an entry from the live site but keeps it visible in
  `npm run dev`.
- Files starting with `_` and this README are ignored.

## Images

Drop the file into `public/seminar-media/`, then reference it by name:

```markdown
![caption under the image](breadboard.jpg)
![[breadboard.jpg]]
```

Both forms resolve to `/seminar-media/breadboard.jpg`. Absolute paths
(`/whatever.png`) and full URLs still work as-is. The alt text becomes the
caption, unless it is just a filename.

The entry's **first** image doubles as its thumbnail on the `/seminar` index
and as the link-preview image. Images written inside code blocks or backticks
don't count. To use a different one, set `image:` in the frontmatter — it takes
the same bare-filename / absolute-path / URL forms as above. An entry with no
image just lists without a thumbnail.

## Visibility

`/seminar` is not linked from anywhere else on the site and both pages send
`noindex, nofollow` — it is reachable only by handing out the URL.
