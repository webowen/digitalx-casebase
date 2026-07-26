"use client";

import type { SmartCityCase } from "./case-model";

const STORAGE_KEY = "digitalx-casebase-local-cases-v1";

export function getLocalCases(): SmartCityCase[] {
  if (typeof window === "undefined") return [];

  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (!value) return [];
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is SmartCityCase =>
        Boolean(
          item &&
            typeof item === "object" &&
            "id" in item &&
            "slug" in item &&
            "title" in item &&
            "status" in item,
        ),
    );
  } catch {
    return [];
  }
}

export function saveLocalCase(item: SmartCityCase) {
  const cases = getLocalCases();
  const next = [item, ...cases.filter((current) => current.id !== item.id)];
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("digitalx-cases-updated"));
  return next;
}

export function removeLocalCase(id: string) {
  const next = getLocalCases().filter((item) => item.id !== id);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("digitalx-cases-updated"));
  return next;
}

export function createSlug(title: string) {
  const normalized = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return `${normalized || "case"}-${Date.now().toString(36)}`;
}
