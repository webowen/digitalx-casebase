"use client";

import { normalizeCaseCategory, type SmartCityCase } from "./case-model";
import { normalizeCaseContentModel } from "./case-content-model";

const LEGACY_KEY = "digitalx-casebase-local-cases-v2";
const DATABASE_NAME = "digitalx-casebase";
const STORE_NAME = "cases";
let migrationPromise: Promise<void> | null = null;

function normalize(item: SmartCityCase) {
  return normalizeCaseContentModel({ ...item, category: normalizeCaseCategory(item.category) });
}

function isCase(item: unknown): item is SmartCityCase {
  return Boolean(item && typeof item === "object" && "id" in item && "slug" in item && "title" in item && "status" in item);
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("无法打开案例数据库。"));
  });
}

async function migrateLegacyCases() {
  if (migrationPromise) return migrationPromise;
  migrationPromise = (async () => {
    const value = window.localStorage.getItem(LEGACY_KEY);
    if (!value) return;
    let parsed: unknown;
    try { parsed = JSON.parse(value); } catch { return; }
    if (!Array.isArray(parsed)) return;
    const cases = parsed.filter(isCase).map(normalize);
    const database = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      cases.forEach((item) => transaction.objectStore(STORE_NAME).put(item));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("旧案例迁移失败。"));
      transaction.onabort = () => reject(transaction.error || new Error("旧案例迁移中止。"));
    });
    database.close();
    window.localStorage.removeItem(LEGACY_KEY);
  })();
  return migrationPromise;
}

export async function getLocalCases(): Promise<SmartCityCase[]> {
  if (typeof window === "undefined" || !window.indexedDB) return [];
  await migrateLegacyCases();
  const database = await openDatabase();
  const cases = await new Promise<SmartCityCase[]>((resolve, reject) => {
    const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result.filter(isCase).map(normalize));
    request.onerror = () => reject(request.error || new Error("读取案例失败。"));
  });
  database.close();
  return cases.sort((a, b) => (b.updatedAt || b.importedAt || "").localeCompare(a.updatedAt || a.importedAt || ""));
}

export async function saveLocalCase(item: SmartCityCase) {
  await migrateLegacyCases();
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(normalize(item));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("案例保存失败。"));
    transaction.onabort = () => reject(transaction.error || new Error("案例保存空间不足，请释放浏览器空间后重试。"));
  });
  database.close();
  const next = await getLocalCases();
  window.dispatchEvent(new CustomEvent("digitalx-cases-updated"));
  return next;
}

export async function removeLocalCase(id: string) {
  await migrateLegacyCases();
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("案例删除失败。"));
  });
  database.close();
  const next = await getLocalCases();
  window.dispatchEvent(new CustomEvent("digitalx-cases-updated"));
  return next;
}

export function createSlug(title: string) {
  const normalized = title.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return `${normalized || "case"}-${Date.now().toString(36)}`;
}
