import assert from "node:assert/strict";
import test from "node:test";
import {
  advanceProduction,
  canAdvanceProduction,
  productionReadiness,
  productionSummary,
} from "../lib/case-production";
import { retiredSmartCityCases as smartCityCases } from "../lib/mock-cases";

test("beta.1 assigns the three benchmark cases to final review without auto approval", () => {
  const benchmarks = smartCityCases.filter(
    (item) =>
      item.contentMigration?.production?.release === "V1.5.0-beta.1",
  );
  assert.equal(benchmarks.length, 3);
  for (const item of benchmarks) {
    assert.equal(item.contentMigration?.production?.stage, "final_review");
    assert.equal(item.contentMigration?.production?.priority, "P0");
    assert.equal(item.contentModel?.manualReviewStatus, "in_review");
    assert.ok(productionReadiness(item).characters >= 3_000);
    assert.equal(productionReadiness(item).readyForPublish, false);
    assert.match(
      canAdvanceProduction(item).reason,
      /正文少于|图片证据|人工门槛/,
    );
  }
});

test("beta.2 assigns all 17 non-benchmark cases to three traceable waves", () => {
  const batchCases = smartCityCases.filter(
    (item) =>
      item.contentMigration?.production?.release === "V1.5.0-beta.2",
  );
  assert.equal(batchCases.length, 17);
  assert.deepEqual(
    new Set(
      batchCases.map((item) => item.contentMigration?.production?.waveId),
    ),
    new Set(["beta2-wave-01", "beta2-wave-02", "beta2-wave-03"]),
  );
  assert.equal(
    batchCases.filter(
      (item) => item.contentMigration?.production?.priority === "P0",
    ).length,
    6,
  );
  assert.equal(
    batchCases.filter(
      (item) => item.contentMigration?.production?.priority === "P1",
    ).length,
    6,
  );
  assert.equal(
    batchCases.filter(
      (item) => item.contentMigration?.production?.priority === "P2",
    ).length,
    5,
  );
  for (const item of batchCases) {
    assert.equal(item.contentMigration?.production?.stage, "queued");
    assert.equal(item.contentMigration?.reviewStatus, "pending");
    assert.equal(item.contentModel?.manualReviewStatus, "pending");
  }
});

test("production stages may start from queued but cannot skip evidence requirements", () => {
  const queued = smartCityCases.find((item) => item.id === "case-001");
  assert.ok(queued);
  assert.equal(canAdvanceProduction(queued).allowed, true);
  const researching = advanceProduction(queued);
  assert.equal(
    researching.contentMigration?.production?.stage,
    "researching",
  );
  const blocked = canAdvanceProduction(researching);
  assert.equal(blocked.allowed, false);
  assert.match(blocked.reason, /可追溯来源/);
});

test("production summary distinguishes benchmark review and batch queue", () => {
  assert.deepEqual(productionSummary(smartCityCases), {
    total: 20,
    benchmarks: 3,
    queued: 17,
    inProduction: 0,
    finalReview: 3,
    approved: 0,
  });
});
