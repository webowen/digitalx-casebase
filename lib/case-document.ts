import { normalizeArticle } from "./case-editorial";
import type {
  CaseArticleSectionId,
  CaseContentSectionId,
  CaseMediaAsset,
  CaseScenario,
  SmartCityCase,
} from "./case-model";

export const caseDocumentSectionOrder: CaseContentSectionId[] = [
  "project_overview",
  "why_build",
  "how_build",
  "core_scenarios",
  "implementation_operation",
  "innovation_outcomes",
  "lessons_boundaries",
];

export const caseDocumentSectionTitles: Record<CaseContentSectionId, string> = {
  project_overview: "项目概况",
  why_build: "为什么建设",
  how_build: "如何建设",
  core_scenarios: "核心场景与业务闭环",
  implementation_operation: "实施与运营",
  innovation_outcomes: "创新与实际成效",
  lessons_boundaries: "经验、边界与适用条件",
};

const legacySectionMap: Record<CaseArticleSectionId, CaseContentSectionId> = {
  overview: "project_overview",
  background: "why_build",
  objectives: "how_build",
  architecture: "how_build",
  capabilities: "core_scenarios",
  delivery: "implementation_operation",
  investment: "implementation_operation",
  outcomes: "innovation_outcomes",
  boundaries: "lessons_boundaries",
  lessons: "lessons_boundaries",
  timeline: "implementation_operation",
};

function cleanStrings(values: Array<string | undefined>) {
  return Array.from(
    new Set(values.map((value) => value?.trim() || "").filter(Boolean)),
  );
}

export type CaseDocumentSection = {
  id: CaseContentSectionId;
  title: string;
  summary: string;
  paragraphs: string[];
  points: string[];
  media: CaseMediaAsset[];
  scenarios: CaseScenario[];
};

export type CaseDocumentModel = {
  title: string;
  standfirst: string;
  keyFindings: string[];
  sections: CaseDocumentSection[];
  sources: Array<{ title: string; url: string }>;
  totalCharacters: number;
  usesNativeContentModel: boolean;
  preservesSourceStructure: boolean;
};

function mediaForSection(item: SmartCityCase, sectionId: CaseContentSectionId, mediaIds: string[]) {
  const idSet = new Set(mediaIds);
  return (item.media || []).filter(
    (asset) =>
      asset.included &&
      asset.reviewed &&
      (idSet.has(asset.id) || legacySectionMap[asset.sectionId] === sectionId),
  );
}

export function buildCaseDocument(item: SmartCityCase): CaseDocumentModel {
  const article = normalizeArticle(item.article, item);
  const nativeSections = item.contentModel?.editorialSections || [];
  const usesNativeContentModel = nativeSections.length > 0;
  const preservesSourceStructure = Boolean(
    item.researchReport && item.article?.sections.length && !usesNativeContentModel,
  );

  const structuredSections = caseDocumentSectionOrder.map((id) => {
    const nativeSection = nativeSections.find((section) => section.id === id);
    const legacySections = article.sections.filter(
      (section) => legacySectionMap[section.id] === id,
    );
    const summary =
      nativeSection?.summary?.trim() ||
      legacySections.find((section) => section.summary.trim())?.summary.trim() ||
      "";
    const paragraphs = cleanStrings(
      nativeSection
        ? nativeSection.paragraphs
        : legacySections.flatMap((section) => section.paragraphs),
    );
    const points = cleanStrings(
      nativeSection
        ? nativeSection.points
        : legacySections.flatMap((section) => section.points),
    );

    return {
      id,
      title: caseDocumentSectionTitles[id],
      summary,
      paragraphs,
      points,
      media: mediaForSection(item, id, nativeSection?.mediaIds || []),
      scenarios:
        id === "core_scenarios" ? item.contentModel?.scenarios || [] : [],
    };
  });

  const sections = preservesSourceStructure
    ? (item.article?.sections || []).map((section, index) => ({
        id: legacySectionMap[section.id],
        title: section.title.trim() || `第 ${index + 1} 部分`,
        summary: "",
        paragraphs: cleanStrings(section.paragraphs),
        points: cleanStrings(section.points),
        media: (item.media || []).filter(
          (asset) => asset.included && asset.reviewed && asset.sectionId === section.id,
        ),
        scenarios: [],
      }))
    : structuredSections.filter((section) =>
        Boolean(
          section.summary || section.paragraphs.length || section.points.length ||
          section.media.length || section.scenarios.length,
        ),
      );

  const sources = item.contentModel?.sources?.length
    ? item.contentModel.sources.map((source) => ({
        title: source.title,
        url: source.url,
      }))
    : [
        ...(item.sourceUrl
          ? [{ title: item.sourceTitle?.trim() || "原始资料", url: item.sourceUrl }]
          : []),
        ...(item.researchSources || []),
      ];
  const title =
    item.identity?.canonicalTitle?.trim() && !item.identity.needsReview
      ? item.identity.canonicalTitle.trim()
      : item.title;
  const standfirst = article.standfirst?.trim() || item.summary;
  const keyFindings = cleanStrings([
    ...(preservesSourceStructure ? item.article?.keyFindings || [] : article.keyFindings),
    ...(!preservesSourceStructure ? item.outcomes : []),
  ])
    .filter((finding) => !/导入案例库|系统识别|地图点位|基础分类|人工复核|解析|关键词/.test(finding))
    .slice(0, 4);
  const totalCharacters = [
    title,
    standfirst,
    ...keyFindings,
    ...sections.flatMap((section) => [
      section.summary,
      ...section.paragraphs,
      ...section.points,
      ...section.scenarios.flatMap((scenario) => [
        scenario.name,
        scenario.problem,
        ...scenario.dataInputs,
        ...scenario.systemActions,
        ...scenario.businessActions,
        scenario.result,
      ]),
    ]),
  ].join("").length;

  return {
    title,
    standfirst,
    keyFindings,
    sections,
    sources: sources.filter(
      (source, index, values) =>
        Boolean(source.title || source.url) &&
        values.findIndex((candidate) => candidate.url === source.url) === index,
    ),
    totalCharacters,
    usesNativeContentModel,
    preservesSourceStructure,
  };
}
