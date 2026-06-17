const DB_NAME = "sentence-gate";
const DB_VERSION = 1;
const REVIEWS_STORE = "reviews";
const STYLE_PROFILES_STORE = "styleProfiles";
const SETTINGS_STORE = "settings";

export interface ReviewRecord {
  documentHash: string;
  title: string;
  format: string;
  sentenceCount: number;
  decisions: Record<string, unknown>;
  diagnosisCache: Record<string, unknown>;
  savedAt: string;
}

export interface StyleProfileRecord {
  id: string;
  [key: string]: unknown;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(REVIEWS_STORE)) {
        db.createObjectStore(REVIEWS_STORE, { keyPath: "documentHash" });
      }
      if (!db.objectStoreNames.contains(STYLE_PROFILES_STORE)) {
        db.createObjectStore(STYLE_PROFILES_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
        db.createObjectStore(SETTINGS_STORE, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        const request = fn(store);
        request.onsuccess = () => resolve(request.result as T);
        request.onerror = () => reject(request.error);
      })
  );
}

export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function getReview(documentHash: string): Promise<ReviewRecord | undefined> {
  return withStore<ReviewRecord | undefined>(REVIEWS_STORE, "readonly", (store) =>
    store.get(documentHash)
  );
}

export async function saveReview(record: ReviewRecord): Promise<void> {
  await withStore<void>(REVIEWS_STORE, "readwrite", (store) => store.put(record));
}

export async function getActiveStyleProfile(): Promise<StyleProfileRecord | undefined> {
  return withStore<StyleProfileRecord | undefined>(STYLE_PROFILES_STORE, "readonly", (store) =>
    store.get("active")
  );
}

export async function saveStyleProfile(profile: Record<string, unknown>): Promise<void> {
  await withStore<void>(STYLE_PROFILES_STORE, "readwrite", (store) =>
    store.put({ ...profile, id: "active" })
  );
}

export async function clearStyleProfile(): Promise<void> {
  await withStore<void>(STYLE_PROFILES_STORE, "readwrite", (store) => store.delete("active"));
}

export async function getSetting<T = unknown>(key: string): Promise<T | undefined> {
  const record = await withStore<{ key: string; value: T } | undefined>(
    SETTINGS_STORE,
    "readonly",
    (store) => store.get(key)
  );
  return record ? record.value : undefined;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await withStore<void>(SETTINGS_STORE, "readwrite", (store) => store.put({ key, value }));
}
