import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

export const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(/*turbopackIgnore: true*/ process.cwd(), ".data", "uploads");

const IMAGE_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const DOC_TYPES: Record<string, string> = { ...IMAGE_TYPES, "application/pdf": "pdf" };
const MAX_BYTES = 5 * 1024 * 1024;

/** Public images get a "p-" prefix (unguessable name); private documents get "d-" and require authorization. */
export async function saveUpload(file: FormDataEntryValue | null, kind: "image" | "document" | "attachment") {
  if (!(file instanceof File) || file.size === 0) return null;
  if (file.size > MAX_BYTES) throw new Error("File is too large (max 5 MB).");
  const types = kind === "image" ? IMAGE_TYPES : DOC_TYPES;
  const ext = types[file.type];
  if (!ext) throw new Error(kind === "image" ? "Only JPG, PNG or WebP images are allowed." : "Only images or PDF files are allowed.");
  await mkdir(UPLOAD_DIR, { recursive: true });
  const name = `${kind === "document" ? "d" : "p"}-${randomUUID()}.${ext}`;
  await writeFile(path.join(UPLOAD_DIR, name), Buffer.from(await file.arrayBuffer()));
  return name;
}

export const fileUrl = (name: string | null | undefined) => (name ? `/api/files/${name}` : null);

export async function readUpload(name: string) {
  if (!/^[pd]-[0-9a-f-]{36}\.(jpg|png|webp|pdf)$/.test(name)) return null;
  try {
    return await readFile(path.join(UPLOAD_DIR, name));
  } catch {
    return null;
  }
}

export const MIME_BY_EXT: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", pdf: "application/pdf" };
