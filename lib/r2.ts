import {
  S3Client,
  ListObjectsV2Command,
  HeadObjectCommand,
  PutObjectCommand,
  _Object,
} from "@aws-sdk/client-s3";
import crypto from "crypto";

export interface NoteEntry {
  key: string;
  title: string;
  ext: string;
  size: number;
  lastModified: string;
  url: string;
}

export interface FolderEntry {
  name: string;
  path: string;
}

export interface NotesListing {
  folders: FolderEntry[];
  files: NoteEntry[];
}

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucket = process.env.R2_BUCKET;
const publicBase = process.env.R2_PUBLIC_BASE_URL;

// Bucket prefix that holds site-static assets (hero image, resume, notion
// image cache, etc.). Hidden from the /notes browser.
export const PUBLIC_PREFIX = "public/";

let client: S3Client | null = null;

function getClient(): S3Client {
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("R2 credentials missing (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY)");
  }
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
  }
  return client;
}

function titleFromKey(key: string): string {
  const base = key.split("/").pop() ?? key;
  const noExt = base.replace(/\.[^.]+$/, "");
  return noExt.replace(/[-_]+/g, " ").trim();
}

function extFromKey(key: string): string {
  const m = key.match(/\.([^.]+)$/);
  return m ? m[1].toLowerCase() : "";
}

function encodeKey(key: string): string {
  return key.split("/").map(encodeURIComponent).join("/");
}

function publicBaseTrimmed(): string {
  if (!publicBase) throw new Error("R2_PUBLIC_BASE_URL not set");
  return publicBase.replace(/\/$/, "");
}

// Build a public URL for a key in the bucket. Used for both notes downloads
// and site-static assets under PUBLIC_PREFIX.
export function publicUrlForKey(key: string): string {
  return `${publicBaseTrimmed()}/${encodeKey(key)}`;
}

// Build a public URL for a site-static asset, e.g. publicAssetUrl("ruikai.png").
export function publicAssetUrl(path: string): string {
  const clean = path.replace(/^\/+/, "");
  return publicUrlForKey(`${PUBLIC_PREFIX}${clean}`);
}

// Normalize a path segment array into an R2 key prefix.
// [] -> ""; ["papers", "2024"] -> "papers/2024/"
export function prefixFromPath(path: string[] | undefined): string {
  if (!path || path.length === 0) return "";
  return path.map((s) => decodeURIComponent(s)).join("/") + "/";
}

export async function listPrefix(prefix: string): Promise<NotesListing> {
  if (!bucket || !publicBase) return { folders: [], files: [] };

  const out = await getClient().send(
    new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      Delimiter: "/",
    })
  );

  const folders: FolderEntry[] = (out.CommonPrefixes ?? [])
    .map((p) => p.Prefix ?? "")
    .filter(Boolean)
    .filter((full) => full !== PUBLIC_PREFIX)
    .map((full) => {
      const trimmed = full.slice(prefix.length).replace(/\/$/, "");
      return { name: trimmed, path: full.replace(/\/$/, "") };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const objects: _Object[] = out.Contents ?? [];
  const files: NoteEntry[] = objects
    .filter((o) => o.Key && o.Key !== prefix && !o.Key.endsWith("/"))
    .map((o) => ({
      key: o.Key!,
      title: titleFromKey(o.Key!),
      ext: extFromKey(o.Key!),
      size: o.Size ?? 0,
      lastModified: o.LastModified?.toISOString() ?? "",
      url: publicUrlForKey(o.Key!),
    }))
    .sort((a, b) => b.lastModified.localeCompare(a.lastModified));

  return { folders, files };
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// --- Notion image upload ---

const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
};

async function objectExists(key: string): Promise<boolean> {
  try {
    await getClient().send(new HeadObjectCommand({ Bucket: bucket!, Key: key }));
    return true;
  } catch {
    return false;
  }
}

// Mirror a remote (Notion-signed) image into R2 under public/notion-images/.
// Returns a stable public URL. Falls back to the original URL on failure so
// the page still renders.
export async function uploadNotionImage(sourceUrl: string): Promise<string> {
  if (!bucket || !publicBase) return sourceUrl;

  // Hash by URL pathname only — signed-URL query strings change every fetch
  // but the underlying asset is the same.
  let hashKey = sourceUrl;
  try {
    const parsed = new URL(sourceUrl);
    hashKey = parsed.origin + parsed.pathname;
  } catch {
    // not parseable, hash the raw string
  }
  const urlHash = crypto.createHash("md5").update(hashKey).digest("hex");

  let ext = "png";
  const extMatch = sourceUrl.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  if (extMatch) {
    const candidate = extMatch[1].toLowerCase();
    if (candidate in CONTENT_TYPES) ext = candidate;
  }

  const key = `${PUBLIC_PREFIX}notion-images/${urlHash}.${ext}`;

  try {
    if (await objectExists(key)) {
      return publicUrlForKey(key);
    }

    const response = await fetch(sourceUrl);
    if (!response.ok) {
      console.error(`Failed to fetch notion image: ${sourceUrl}`);
      return sourceUrl;
    }
    const body = Buffer.from(await response.arrayBuffer());

    await getClient().send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: CONTENT_TYPES[ext] ?? "application/octet-stream",
      })
    );

    return publicUrlForKey(key);
  } catch (error) {
    console.error(`Failed to upload notion image to R2: ${sourceUrl}`, error);
    return sourceUrl;
  }
}
