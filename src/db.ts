import { emptyData } from "./types";
import type { AppData, Settings, StoredPhoto } from "./types";

const DB_NAME = "expiry-guard";
export const DB_VERSION = 1;
const KV = "kv";
const PHOTOS = "photos";
const SNAPSHOT_KEY = "app";

let cachedDb: IDBDatabase | null = null;
let opening: Promise<IDBDatabase> | null = null;
let writeChain: Promise<void> = Promise.resolve();

export function cloneAppData(data: AppData): AppData {
  if (typeof structuredClone === "function") return structuredClone(data);
  return JSON.parse(JSON.stringify(data)) as AppData;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asBool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asNumberArray(value: unknown, fallback: number[]): number[] {
  if (!Array.isArray(value)) return [...fallback];
  return value.filter((n): n is number => typeof n === "number" && Number.isFinite(n));
}

export function hydrateSettings(value: unknown): Settings {
  const empty = emptyData().settings;
  if (!value || typeof value !== "object") return empty;
  const raw = value as Partial<Settings>;
  return {
    businessName: asString(raw.businessName),
    currency: "OMR",
    defaultReminderOffsets: asNumberArray(raw.defaultReminderOffsets, empty.defaultReminderOffsets),
    reminderTime: /^\d{2}:\d{2}$/.test(asString(raw.reminderTime)) ? asString(raw.reminderTime) : empty.reminderTime,
    alarmOnExpiryDay: asBool(raw.alarmOnExpiryDay, true),
    dailyReminderAfterExpiry: asBool(raw.dailyReminderAfterExpiry, true),
    appLockEnabled: asBool(raw.appLockEnabled, false),
    pinHash: asString(raw.pinHash),
    biometricEnabled: asBool(raw.biometricEnabled, false),
    monthlySummary: asBool(raw.monthlySummary, true),
    lastMonthlySummaryYm: asString(raw.lastMonthlySummaryYm),
  };
}

export function hydrateAppData(value: unknown): AppData {
  if (!value || typeof value !== "object") return emptyData();
  const raw = value as Partial<AppData>;
  return {
    documents: Array.isArray(raw.documents) ? (raw.documents as AppData["documents"]) : [],
    monthlyTasks: Array.isArray(raw.monthlyTasks) ? (raw.monthlyTasks as AppData["monthlyTasks"]) : [],
    settings: hydrateSettings(raw.settings),
  };
}

function openDb(): Promise<IDBDatabase> {
  if (cachedDb) return Promise.resolve(cachedDb);
  if (opening) return opening;
  opening = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(KV)) db.createObjectStore(KV);
      if (!db.objectStoreNames.contains(PHOTOS)) db.createObjectStore(PHOTOS, { keyPath: "id" });
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onclose = () => {
        if (cachedDb === db) cachedDb = null;
      };
      cachedDb = db;
      opening = null;
      resolve(db);
    };
    req.onerror = () => {
      opening = null;
      reject(req.error ?? new Error("Could not open storage"));
    };
    req.onblocked = () => {
      opening = null;
      reject(new Error("Storage is blocked"));
    };
  });
  return opening;
}

export async function loadData(): Promise<AppData> {
  const db = await openDb();
  const value = await new Promise<unknown>((resolve, reject) => {
    const tx = db.transaction(KV, "readonly");
    const req = tx.objectStore(KV).get(SNAPSHOT_KEY);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Could not load"));
    tx.onabort = () => reject(tx.error ?? new Error("Load aborted"));
  });
  return hydrateAppData(value);
}

function writeSnapshot(snapshot: AppData): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        let settled = false;
        const fail = (err: unknown) => {
          if (settled) return;
          settled = true;
          reject(err instanceof Error ? err : new Error("Could not save"));
        };
        const ok = () => {
          if (settled) return;
          settled = true;
          resolve();
        };
        try {
          const tx = db.transaction(KV, "readwrite");
          const req = tx.objectStore(KV).put(snapshot, SNAPSHOT_KEY);
          req.onerror = () => fail(req.error ?? new Error("Could not save"));
          tx.onabort = () => fail(tx.error ?? new Error("Save aborted"));
          tx.onerror = () => fail(tx.error ?? new Error("Could not save"));
          tx.oncomplete = () => ok();
        } catch (err) {
          fail(err);
        }
      }),
  );
}

export function saveData(data: AppData): Promise<void> {
  const snapshot = cloneAppData(data);
  const run = writeChain.then(() => writeSnapshot(snapshot));
  writeChain = run.catch(() => undefined);
  return run;
}

export async function savePhoto(photo: StoredPhoto): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(PHOTOS, "readwrite");
    tx.objectStore(PHOTOS).put(photo);
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error("Photo save aborted"));
    tx.onerror = () => reject(tx.error ?? new Error("Could not save photo"));
  });
}

export async function loadPhoto(id: string): Promise<StoredPhoto | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTOS, "readonly");
    const req = tx.objectStore(PHOTOS).get(id);
    req.onsuccess = () => resolve((req.result as StoredPhoto | undefined) ?? null);
    req.onerror = () => reject(req.error ?? new Error("Could not load photo"));
  });
}

export async function loadPhotos(ids: string[]): Promise<StoredPhoto[]> {
  const out: StoredPhoto[] = [];
  for (const id of ids) {
    const photo = await loadPhoto(id);
    if (photo) out.push(photo);
  }
  return out;
}

export async function deletePhoto(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(PHOTOS, "readwrite");
    tx.objectStore(PHOTOS).delete(id);
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error("Photo delete aborted"));
  });
}

export async function allPhotos(): Promise<StoredPhoto[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTOS, "readonly");
    const req = tx.objectStore(PHOTOS).getAll();
    req.onsuccess = () => resolve((req.result as StoredPhoto[]) ?? []);
    req.onerror = () => reject(req.error ?? new Error("Could not list photos"));
  });
}

export async function replaceAllPhotos(photos: StoredPhoto[]): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(PHOTOS, "readwrite");
    const store = tx.objectStore(PHOTOS);
    const clear = store.clear();
    clear.onsuccess = () => {
      for (const photo of photos) store.put(photo);
    };
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error("Photo replace aborted"));
  });
}

export function resetDbCache(): void {
  cachedDb = null;
  opening = null;
}
