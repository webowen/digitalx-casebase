import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCaseDocument,
  caseDocumentSectionOrder,
  caseDocumentSectionTitles,
} from "../lib/case-document";
import { normalizeCaseContentModel } from "../lib/case-content-model";
import { retiredSmartCityCases as smartCityCases } from "../lib/mock-cases";

test("hides empty framework sections instead of forcing a seven-part document", () => {
  const document = buildCaseDocument(smartCityCases[0]);

  assert.ok(document.sections.length < caseDocumentSectionOrder.length);
  assert.ok(document.sections.every((section) =>
    Boolean(section.summary || section.paragraphs.length || section.points.length || section.media.length || section.scenarios.length),
  ));
  assert.ok(document.sections.every((section) =>
    caseDocumentSectionTitles[section.id] === section.title,
  ));
});

test("preserves the original headings of an imported mature report", async () => {
  const { createCaseFromReport } = await import("../lib/report-import");
  const item = createCaseFromReport(`
# 大湾区文化体育中心智慧运营管理平台

## 一、建设背景
大型场馆建成之后，真正的难题是长期运营管理。

## 二、建设内容
平台关联空间、设备、告警和工单，支撑事件处置闭环。
`);
  const document = buildCaseDocument(item);

  assert.equal(document.title, "大湾区文化体育中心智慧运营管理平台");
  assert.equal(document.preservesSourceStructure, true);
  assert.deepEqual(document.sections.map((section) => section.title), ["一、建设背景", "二、建设内容"]);
  assert.deepEqual(document.keyFindings, []);
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
