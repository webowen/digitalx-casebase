import assert from "node:assert/strict";
import test from "node:test";
import {
  approveCaseContentModel,
  normalizeCaseContentModel,
} from "../lib/case-content-model";
import { smartCityCases } from "../lib/mock-cases";
import type { SmartCityCase } from "../lib/case-model";

test("normalizes every V1.4 built-in case without changing its public identity", () => {
  assert.ok(smartCityCases.length >= 20);
  for (const original of smartCityCases) {
    const normalized = normalizeCaseContentModel(original);
    assert.equal(normalized.id, original.id);
    assert.equal(normalized.slug, original.slug);
    assert.equal(normalized.title, original.title);
    assert.equal(normalized.city, original.city);
    assert.equal(normalized.status, original.status);
    assert.equal(normalized.contentModel?.schemaVersion, "1.0");
    assert.ok((normalized.contentModel?.editorialSections.length || 0) > 0);
  }
});

test("does not attach every research source to unsupported legacy claims", () => {
  const base = smartCityCases[0];
  const draft: SmartCityCase = {
    ...base,
    researchSources: [
      { title: "来源一", url: "https://example.com/one" },
      { title: "来源二", url: "https://example.com/two" },
    ],
    article: {
      standfirst: base.summary,
      keyFindings: [],
      sections: [
        {
          id: "overview",
          title: "项目概况",
          summary: "仅由来源一支持的陈述。",
          paragraphs: [],
          points: [],
          evidenceRefs: ["来源1"],
        },
        {
          id: "outcomes",
          title: "实际成效与证据",
          summary: "尚未建立来源引用的成效陈述。",
          paragraphs: [],
          points: [],
          evidenceRefs: [],
        },
      ],
    },
  };
  const normalized = normalizeCaseContentModel(draft);
  const claims = normalized.contentModel?.claims || [];
  const supported = claims.find((claim) => claim.statement.includes("来源一"));
  const unsupported = claims.find((claim) => claim.statement.includes("尚未建立"));

  assert.deepEqual(supported?.sourceIds, ["source-1"]);
  assert.equal(supported?.type, "source_claim");
  assert.deepEqual(unsupported?.sourceIds, []);
  assert.equal(unsupported?.type, "unresolved");
});

test("manual approval alone cannot bypass the quality threshold", () => {
  const original = normalizeCaseContentModel(smartCityCases[0]);
  const approved = approveCaseContentModel(original);

  assert.equal(approved.contentModel?.manualReviewStatus, "approved");
  assert.equal(
    approved.contentModel?.quality.publishable,
    (approved.contentModel?.quality.score || 0) >= 70 &&
      (approved.contentModel?.quality.blockingIssues.length || 0) === 0,
  );
});
