import type { HubId } from "./household";

const HUB_IDS: HubId[] = ["park", "studio", "lisbon", "created"];
const MAX_CHARS = 450_000;

export function isStoredImage(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("data:image/jpeg;base64,") && value.length <= MAX_CHARS;
}

export function readHubPhotos(raw: unknown): Partial<Record<HubId, string>> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const src = raw as Record<string, unknown>;
  const out: Partial<Record<HubId, string>> = {};
  for (const id of HUB_IDS) {
    if (isStoredImage(src[id])) out[id] = src[id];
  }
  return Object.keys(out).length ? out : undefined;
}

export async function readImageFile(file: File, maxEdge: number): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Choose a photo.");
  if (file.size > 12 * 1024 * 1024) throw new Error("That photo is larger than 12 MB.");

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("Couldn’t read that photo.");
  }

  try {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Couldn’t read that photo.");
    ctx.drawImage(bitmap, 0, 0, width, height);

    let quality = 0.82;
    let data = canvas.toDataURL("image/jpeg", quality);
    while (data.length > 420_000 && quality > 0.45) {
      quality = Math.round((quality - 0.08) * 100) / 100;
      data = canvas.toDataURL("image/jpeg", quality);
    }
    if (!isStoredImage(data)) throw new Error("That photo is still too large. Try a smaller one.");
    return data;
  } finally {
    bitmap.close();
  }
}
