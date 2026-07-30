import assert from "node:assert/strict";
import test from "node:test";
import {
  benchmarkCaseSlugs,
  getMigrationSummary,
} from "../lib/benchmark-cases";
import { buildCaseDocument } from "../lib/case-document";
import { smartCityCases } from "../lib/mock-cases";

test("migrates exactly three V1.4 cases without changing stable identities", () => {
  const summary = getMigrationSummary(smartCityCases);
  const benchmarks = smartCityCases.filter(
    (item) => item.contentMigration?.benchmark,
  );

  assert.equal(summary.migrated, 3);
  assert.equal(summary.benchmarkDrafts, 3);
  assert.equal(benchmarks.length, 3);
  assert.deepEqual(
    benchmarks.map((item) => item.slug).sort(),
    [...benchmarkCaseSlugs].sort(),
  );
  assert.deepEqual(
    benchmarks.map((item) => item.id).sort(),
    ["case-003", "case-004", "case-005"],
  );
});

test("every benchmark case satisfies the native seven-part migration contract", () => {
  const benchmarks = smartCityCases.filter(
    (item) => item.contentMigration?.benchmark,
  );

  for (const item of benchmarks) {
    const migration = item.contentMigration;
    const content = item.contentModel;
    const document = buildCaseDocument(item);

    assert.equal(migration?.protocolVersion, "1.0");
    assert.equal(migration?.status, "benchmark_draft");
    assert.equal(migration?.reviewStatus, "in_review");
    assert.equal(migration?.substantiveSectionCount, 7);
    assert.equal(content?.generationMode, "native");
    assert.equal(content?.contentLevel, "deep");
    assert.equal(content?.editorialSections.length, 7);
    assert.ok((content?.sources.length || 0) >= 4);
    assert.ok((content?.claims.length || 0) >= 7);
    assert.ok((content?.scenarios.length || 0) >= 2);
    assert.ok((content?.dataAssets.length || 0) >= 2);
    assert.ok((content?.limitations.length || 0) >= 3);
    assert.ok((content?.replicationConditions.length || 0) >= 3);
    assert.equal(document.usesNativeContentModel, true);
    assert.ok(document.totalCharacters >= 2_000);
  }
});

test("benchmark drafts remain visibly pending human approval", () => {
  for (const item of smartCityCases.filter(
    (candidate) => candidate.contentMigration?.benchmark,
  )) {
    assert.equal(item.contentModel?.manualReviewStatus, "in_review");
    assert.equal(item.contentModel?.quality.publishable, false);
    assert.ok(
      item.contentModel?.quality.blockingIssues.includes(
        "案例尚未完成最终人工复核。",
      ),
    );
  }
});
