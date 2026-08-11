import test from "node:test";
import assert from "node:assert/strict";
import { indexedCases, indexedCaseStats } from "../lib/case-index";

test("real indexed cases use stable unique case_id identities", () => {
  assert.equal(indexedCaseStats.total, 1186);
  assert.equal(new Set(indexedCases.map((item) => item.id)).size, 1186);
  assert.ok(indexedCases.every((item) => item.asset?.caseId === item.id));
  assert.ok(indexedCases.every((item) => item.asset?.contentStatus === "indexed"));
});

test("indexed case POI statistics stay explicit", () => {
  assert.equal(indexedCaseStats.mappable, 1162);
  assert.equal(indexedCaseStats.withoutPoi, 24);
});
