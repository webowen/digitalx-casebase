import {
  articleCharacterCount,
  articleSectionTitles,
  normalizeArticle,
  normalizeIdentity,
} from "./case-editorial";
import type {
  CaseArticleSectionId,
  CaseContentClaim,
  CaseContentModel,
  CaseContentSection,
  CaseContentSectionId,
  CaseContentSource,
  CaseEvidenceStatus,
  CaseMetric,
  CaseQualityBreakdown,
  CaseQualityReview,
  SmartCityCase,
} from "./case-model";

const sectionMap: Record<CaseArticleSectionId, CaseContentSectionId> = {
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

export const contentSectionTitles: Record<CaseContentSectionId, string> = {
  project_overview: "项目概况",
  why_build: "为什么建设",
  how_build: "如何建设",
  core_scenarios: "核心场景与业务闭环",
  implementation_operation: "实施与运营",
  innovation_outcomes: "创新与实际成效",
  lessons_boundaries: "经验、边界与适用条件",
};

function cleanStrings(values: unknown) {
  if (!Array.isArray(values)) return [];
  return Array.from(
    new Set(
      values
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
}

function sourceId(index: number) {
  return `source-${index + 1}`;
}

function deriveSources(item: SmartCityCase): CaseContentSource[] {
  const sources: CaseContentSource[] = [];
  if (item.sourceUrl || item.sourceTitle || item.sourceExcerpt) {
    sources.push({
      id: sourceId(sources.length),
      title: item.sourceTitle?.trim() || item.sourceNote?.trim() || "原始资料",
      url: item.sourceUrl?.trim() || "",
      publisher: "",
      publishedAt: "",
      sourceType: "原始资料",
      excerpt: item.sourceExcerpt?.trim() || "",
      evidenceLevel: item.evidenceLevel,
      reviewed: false,
    });
  }
  for (const source of item.researchSources || []) {
    if (!source.url?.trim()) continue;
    const duplicate = sources.some((current) => current.url === source.url.trim());
    if (duplicate) continue;
    sources.push({
      id: sourceId(sources.length),
      title: source.title?.trim() || source.url.trim(),
      url: source.url.trim(),
      publisher: "",
      publishedAt: "",
      sourceType: "其他",
      excerpt: "",
      evidenceLevel: item.evidenceLevel,
      reviewed: false,
    });
  }
  return sources;
}

function deriveSections(item: SmartCityCase) {
  const article = normalizeArticle(item.article, item);
  const grouped = new Map<CaseContentSectionId, CaseContentSection>();
  for (const section of article.sections) {
    const id = sectionMap[section.id];
    const current = grouped.get(id);
    const next = {
      id,
      title: contentSectionTitles[id],
      summary: section.summary,
      paragraphs: cleanStrings(section.paragraphs),
      points: cleanStrings(section.points),
      claimIds: [],
      mediaIds: (item.media || [])
        .filter((media) => media.included && sectionMap[media.sectionId] === id)
        .map((media) => media.id),
    };
    if (!current) {
      grouped.set(id, next);
      continue;
    }
    grouped.set(id, {
      ...current,
      summary: current.summary || next.summary,
      paragraphs: cleanStrings([...current.paragraphs, ...next.paragraphs]),
      points: cleanStrings([...current.points, ...next.points]),
      mediaIds: cleanStrings([...current.mediaIds, ...next.mediaIds]),
    });
  }
  return Object.keys(contentSectionTitles)
    .map((id) => grouped.get(id as CaseContentSectionId))
    .filter((section): section is CaseContentSection => Boolean(section));
}

function claimType(hasSources: boolean) {
  return hasSources ? "source_claim" : "unresolved";
}

function evidenceStatus(hasSources: boolean): CaseEvidenceStatus {
  return hasSources ? "source_claimed" : "unknown";
}

function deriveClaims(
  item: SmartCityCase,
  sections: CaseContentSection[],
  sources: CaseContentSource[],
) {
  const claims: CaseContentClaim[] = [];
  const article = normalizeArticle(item.article, item);
  for (const section of sections) {
    const referencedSourceIds = cleanStrings(
      article.sections
        .filter((legacySection) => sectionMap[legacySection.id] === section.id)
        .flatMap((legacySection) => legacySection.evidenceRefs)
        .map((reference) => {
          const index = Number(reference.match(/\d+/)?.[0] || 0) - 1;
          return index >= 0 ? sources[index]?.id || "" : "";
        }),
    );
    const statements = cleanStrings([
      section.summary,
      ...section.points,
      ...section.paragraphs,
    ]).slice(0, 8);
    for (const statement of statements) {
      const id = `claim-${claims.length + 1}`;
      claims.push({
        id,
        statement,
        type: claimType(referencedSourceIds.length > 0),
        evidenceStatus: evidenceStatus(referencedSourceIds.length > 0),
        sourceIds: referencedSourceIds,
        sectionId: section.id,
        confidence: referencedSourceIds.length > 0 ? 0.65 : 0.35,
        conflict: "",
        reviewed: false,
      });
      section.claimIds.push(id);
    }
  }
  return claims;
}

function deriveMetrics(item: SmartCityCase): CaseMetric[] {
  const metricPattern =
    /(?:提升|降低|减少|缩短|覆盖|接入|汇聚|节省|增长|达到|超过|约)?\s*\d+(?:\.\d+)?\s*(?:%|％|亿元|万元|万|公里|个|项|家|套|分钟|小时|天|人次|条|路|平方公里)/g;
  const candidates = cleanStrings([
    ...item.outcomes,
    ...(item.article?.sections.flatMap((section) => [
      section.summary,
      ...section.paragraphs,
      ...section.points,
    ]) || []),
  ]);
  return candidates.flatMap((statement) => {
    const values = statement.match(metricPattern) || [];
    return values.slice(0, 2).map((value) => ({
      name: statement.slice(0, 48),
      value: value.trim(),
      unit: "",
      period: "",
      baseline: "",
      evidenceStatus: "unknown" as CaseEvidenceStatus,
      sourceIds: [],
      reviewed: false,
    }));
  }).slice(0, 12);
}

function defaultBreakdown(): CaseQualityBreakdown {
  return {
    identity: 0,
    sourcesAndEvidence: 0,
    completeness: 0,
    problemSolution: 0,
    dataAndBusiness: 0,
    metrics: 0,
    media: 0,
    boundaries: 0,
  };
}

export function evaluateCaseQuality(
  item: SmartCityCase,
  contentModel: Omit<CaseContentModel, "quality">,
): CaseQualityReview {
  const breakdown = defaultBreakdown();
  const blockingIssues: string[] = [];
  const warnings: string[] = [];
  const identity = normalizeIdentity(item.identity, item.title);
  const article = normalizeArticle(item.article, item);

  breakdown.identity =
    identity.canonicalTitle === item.title.trim() && !identity.needsReview
      ? 10
      : identity.confidence >= 0.7
        ? 7
        : 3;
  breakdown.sourcesAndEvidence = Math.min(
    20,
    contentModel.sources.length * 3 +
      contentModel.claims.filter((claim) => claim.sourceIds.length > 0).length,
  );
  const substantiveSectionCount = contentModel.editorialSections.filter(
    (section) =>
      section.claimIds.length > 0 &&
      Boolean(
        section.summary.trim() ||
          section.paragraphs.some((paragraph) => paragraph.trim()) ||
          section.points.some((point) => point.trim()),
      ),
  ).length;
  breakdown.completeness = Math.min(
    15,
    substantiveSectionCount * 2 +
      (articleCharacterCount(article) >= 1_200 ? 3 : 0),
  );
  breakdown.problemSolution = Math.min(
    15,
    (item.painPoints.length > 0 ? 5 : 0) +
      (item.solution.length > 0 ? 5 : 0) +
      (contentModel.scenarios.length > 0 ? 5 : 0),
  );
  breakdown.dataAndBusiness = Math.min(
    10,
    contentModel.dataAssets.length * 2 +
      contentModel.organizations.length +
      (item.owner ? 2 : 0),
  );
  breakdown.metrics = Math.min(
    10,
    contentModel.metrics.filter(
      (metric) =>
        metric.sourceIds.length > 0 &&
        metric.evidenceStatus !== "unknown" &&
        metric.evidenceStatus !== "derived",
    ).length * 2,
  );
  breakdown.media = Math.min(
    10,
    (item.media || []).filter((media) => media.included && media.reviewed).length * 3,
  );
  breakdown.boundaries = Math.min(
    10,
    contentModel.limitations.length * 2 +
      contentModel.replicationConditions.length * 2,
  );

  if (identity.needsReview || identity.confidence < 0.7) {
    blockingIssues.push("正式项目名称尚未完成人工核验。");
  }
  if (identity.canonicalTitle !== item.title.trim()) {
    blockingIssues.push("案例标题与规范项目名称不一致。");
  }
  if (contentModel.claims.some((claim) => claim.type === "ai_inference" && !claim.reviewed)) {
    blockingIssues.push("存在尚未人工确认的 AI 推断。");
  }
  if (contentModel.claims.some((claim) => claim.conflict.trim())) {
    blockingIssues.push("存在尚未解决的关键证据冲突。");
  }
  if (
    contentModel.claims.some(
      (claim) =>
        claim.sectionId === "innovation_outcomes" &&
        claim.sourceIds.length === 0,
    )
  ) {
    blockingIssues.push("实际成效章节存在尚未关联来源的关键陈述。");
  }
  if ((item.media || []).some((media) => media.included && !media.reviewed)) {
    blockingIssues.push("存在尚未人工确认的入选图片。");
  }
  if (contentModel.manualReviewStatus !== "approved") {
    blockingIssues.push("案例尚未完成最终人工复核。");
  }
  if (contentModel.sources.length < 2) warnings.push("来源少于2个，建议继续补充可追溯资料。");
  if (articleCharacterCount(article) < 1_200) warnings.push("正文不足1200字，建议补充研究资料。");
  if (substantiveSectionCount < 7) {
    warnings.push(
      `七章正文中仅有${substantiveSectionCount}章获得事实陈述支撑，其他章节需要补充证据。`,
    );
  }
  if (contentModel.metrics.length === 0) warnings.push("尚未提取到可核验的量化成效指标。");
  if (contentModel.dataAssets.length === 0) warnings.push("尚未形成数据要素与数据用途清单。");

  const score = Object.values(breakdown).reduce((total, value) => total + value, 0);
  return {
    score,
    breakdown,
    blockingIssues: cleanStrings(blockingIssues),
    warnings: cleanStrings(warnings),
    publishable: score >= 70 && blockingIssues.length === 0,
    reviewedAt: new Date().toISOString(),
  };
}

export function normalizeCaseContentModel(item: SmartCityCase): SmartCityCase {
  const existing = item.contentModel;
  const sources = existing?.sources?.length ? existing.sources : deriveSources(item);
  const editorialSections = existing?.editorialSections?.length
    ? existing.editorialSections
    : deriveSections(item);
  const claims = existing?.claims?.length
    ? existing.claims
    : deriveClaims(item, editorialSections, sources);
  const organizations = existing?.organizations?.length
    ? existing.organizations
    : cleanStrings([
        item.owner,
        item.implementationUnit,
        item.operationUnit,
      ]).map((name, index) => ({
        name,
        role:
          index === 0
            ? ("建设/牵头" as const)
            : index === 1
              ? ("实施" as const)
              : ("运营" as const),
        sourceIds: sources.map((source) => source.id),
        reviewed: false,
      }));
  const scenarios = existing?.scenarios?.length
    ? existing.scenarios
    : item.solution.slice(0, 6).map((solution, index) => ({
        id: `scenario-${index + 1}`,
        name: solution.slice(0, 36),
        problem: item.painPoints[index] || item.painPoints[0] || "",
        dataInputs: [],
        systemActions: [solution],
        businessActions: [],
        result: item.outcomes[index] || "",
        sourceIds: sources.map((source) => source.id),
      }));
  const metrics = existing?.metrics?.length
    ? existing.metrics
    : deriveMetrics(item);

  const withoutQuality: Omit<CaseContentModel, "quality"> = {
    schemaVersion: "1.0",
    generationMode: existing?.generationMode || "compatibility",
    contentLevel:
      articleCharacterCount(normalizeArticle(item.article, item)) >= 4_000
        ? "deep"
        : articleCharacterCount(normalizeArticle(item.article, item)) >= 1_200
          ? "standard"
          : "quick",
    editorialSections,
    sources,
    claims,
    organizations,
    dataAssets: existing?.dataAssets || [],
    scenarios,
    metrics,
    milestones: existing?.milestones || [],
    limitations: existing?.limitations?.length
      ? existing.limitations
      : cleanStrings([item.expertView]),
    replicationConditions: existing?.replicationConditions || [],
    manualReviewStatus: existing?.manualReviewStatus || "pending",
  };
  const contentModel: CaseContentModel = {
    ...withoutQuality,
    quality: evaluateCaseQuality(item, withoutQuality),
  };
  return { ...item, contentModel };
}

export function approveCaseContentModel(item: SmartCityCase) {
  const normalized = normalizeCaseContentModel(item);
  if (!normalized.contentModel) return normalized;
  const withoutQuality = {
    ...normalized.contentModel,
    manualReviewStatus: "approved" as const,
  };
  const { quality: previousQuality, ...reviewInput } = withoutQuality;
  void previousQuality;
  return {
    ...normalized,
    contentModel: {
      ...withoutQuality,
      quality: evaluateCaseQuality(normalized, reviewInput),
    },
  };
}

export function legacySectionTitle(sectionId: CaseArticleSectionId) {
  return articleSectionTitles[sectionId];
}
