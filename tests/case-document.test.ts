import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCaseDocument,
  caseDocumentSectionOrder,
  caseDocumentSectionTitles,
} from "../lib/case-document";
import { normalizeCaseContentModel } from "../lib/case-content-model";
import { smartCityCases } from "../lib/mock-cases";

test("builds a fixed seven-part case document for legacy cases", () => {
  const document = buildCaseDocument(smartCityCases[0]);

  assert.deepEqual(
    document.sections.map((section) => section.id),
    caseDocumentSectionOrder,
  );
  assert.deepEqual(
    document.sections.map((section) => section.title),
    caseDocumentSectionOrder.map((id) => caseDocumentSectionTitles[id]),
  );
  assert.equal(document.sections.length, 7);
});

test("prefers native editorial sections over conflicting legacy article content", () => {
  const normalized = normalizeCaseContentModel(smartCityCases[0]);
  assert.ok(normalized.contentModel);
  const item = {
    ...normalized,
    article: {
      standfirst: "旧版导读",
      keyFindings: [],
      sections: [
        {
          id: "overview" as const,
          title: "项目概况",
          summary: "旧版项目概况",
          paragraphs: ["旧版正文"],
          points: [],
          evidenceRefs: [],
        },
      ],
    },
    contentModel: {
      ...normalized.contentModel,
      generationMode: "native" as const,
      editorialSections: normalized.contentModel.editorialSections.map((section) =>
        section.id === "project_overview"
          ? {
              ...section,
              summary: "原生七部分项目概况",
              paragraphs: ["原生七部分正文"],
            }
          : section,
      ),
    },
  };
  const document = buildCaseDocument(item);
  const overview = document.sections[0];

  assert.equal(document.usesNativeContentModel, true);
  assert.equal(overview.summary, "原生七部分项目概况");
  assert.ok(overview.paragraphs.includes("原生七部分正文"));
  assert.ok(!overview.paragraphs.includes("旧版正文"));
});
