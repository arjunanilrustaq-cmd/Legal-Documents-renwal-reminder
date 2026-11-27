import type { AppData, StoredPhoto } from "./types";
import { hydrateAppData } from "./db";

export interface BackupFile {
  app: "expiry-guard";
  version: 1;
  exportedAt: string;
  data: AppData;
  photos: { id: string; mime: string; base64: string }[];
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function base64ToBlob(base64: string, mime: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime || "image/jpeg" });
}

export async function buildBackup(data: AppData, photos: StoredPhoto[], exportedAt: string): Promise<BackupFile> {
  const encoded = [];
  for (const photo of photos) {
    encoded.push({
      id: photo.id,
      mime: photo.mime,
      base64: await blobToBase64(photo.blob),
    });
  }
  return {
    app: "expiry-guard",
    version: 1,
    exportedAt,
    data,
    photos: encoded,
  };
}

export function parseBackup(raw: unknown): { data: AppData; photos: StoredPhoto[] } {
  if (!raw || typeof raw !== "object") throw new Error("Not an Expiry Guard backup");
  const file = raw as Partial<BackupFile>;
  if (file.app !== "expiry-guard") throw new Error("Not an Expiry Guard backup");
  const data = hydrateAppData(file.data);
  const photos: StoredPhoto[] = [];
  if (Array.isArray(file.photos)) {
    for (const row of file.photos) {
      if (!row || typeof row !== "object") continue;
      if (typeof row.id !== "string" || typeof row.base64 !== "string") continue;
      photos.push({
        id: row.id,
        mime: typeof row.mime === "string" ? row.mime : "image/jpeg",
        blob: base64ToBlob(row.base64, typeof row.mime === "string" ? row.mime : "image/jpeg"),
      });
    }
  }
  return { data, photos };
}
