import type {
  CaseArticle,
  CaseArticleSection,
  CaseArticleSectionId,
  CaseProjectIdentity,
  SmartCityCase,
} from "./case-model";

export const articleSectionOrder: CaseArticleSectionId[] = [
  "overview",
  "background",
  "objectives",
  "architecture",
  "capabilities",
  "delivery",
  "investment",
  "outcomes",
  "boundaries",
  "lessons",
  "timeline",
];

export const articleSectionTitles: Record<CaseArticleSectionId, string> = {
  overview: "项目概况",
  background: "项目为什么建设",
  objectives: "建设目标与总体思路",
  architecture: "总体架构与数据体系",
  capabilities: "核心功能与业务闭环",
  delivery: "建设、实施与运营机制",
  investment: "投资、采购与参与单位",
  outcomes: "实际成效与证据",
  boundaries: "问题边界与待核验事项",
  lessons: "可复制经验与适用条件",
  timeline: "项目时间线",
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

function fallbackSections(item: Pick<
  SmartCityCase,
  | "summary"
  | "painPoints"
  | "solution"
  | "outcomes"
  | "expertView"
  | "owner"
  | "projectStage"
  | "investmentAmount"
  | "fundingSource"
  | "implementationUnit"
  | "operationUnit"
>) {
  const sections: CaseArticleSection[] = [
    {
      id: "overview",
      title: articleSectionTitles.overview,
      summary: item.summary,
      paragraphs: [item.summary].filter(Boolean),
      points: [],
      evidenceRefs: [],
    },
    {
      id: "background",
      title: articleSectionTitles.background,
      summary: "",
      paragraphs: [],
      points: cleanStrings(item.painPoints),
      evidenceRefs: [],
    },
    {
      id: "capabilities",
      title: articleSectionTitles.capabilities,
      summary: "",
      paragraphs: [],
      points: cleanStrings(item.solution),
      evidenceRefs: [],
    },
    {
      id: "delivery",
      title: articleSectionTitles.delivery,
      summary: "",
      paragraphs: [
        [
          item.owner ? `建设或牵头主体为${item.owner}` : "",
          item.projectStage ? `项目处于${item.projectStage}阶段` : "",
          item.implementationUnit ? `实施单位为${item.implementationUnit}` : "",
          item.operationUnit ? `运营单位为${item.operationUnit}` : "",
        ]
          .filter(Boolean)
          .join("；"),
      ].filter(Boolean),
      points: [],
      evidenceRefs: [],
    },
    {
      id: "investment",
      title: articleSectionTitles.investment,
      summary: "",
      paragraphs: [],
      points: [
        item.investmentAmount ? `项目投资：${item.investmentAmount}` : "",
        item.fundingSource ? `资金来源：${item.fundingSource}` : "",
      ].filter(Boolean),
      evidenceRefs: [],
    },
    {
      id: "outcomes",
      title: articleSectionTitles.outcomes,
      summary: "",
      paragraphs: [],
      points: cleanStrings(item.outcomes),
      evidenceRefs: [],
    },
    {
      id: "boundaries",
      title: articleSectionTitles.boundaries,
      summary: "",
      paragraphs: [item.expertView].filter(Boolean),
      points: [],
      evidenceRefs: [],
    },
  ];
  return sections.filter(
    (section) =>
      Boolean(section.summary) ||
      section.paragraphs.length > 0 ||
      section.points.length > 0,
  );
}

export function normalizeIdentity(
  identity: CaseProjectIdentity | undefined,
  fallbackTitle: string,
): CaseProjectIdentity {
  const canonicalTitle =
    identity?.canonicalTitle?.trim() || fallbackTitle.trim();
  const candidates = cleanStrings([
    canonicalTitle,
    ...(identity?.candidates || []),
  ]);
  return {
    canonicalTitle,
    candidates,
    aliases: cleanStrings(identity?.aliases),
    confidence: Math.min(1, Math.max(0, identity?.confidence || 0)),
    needsReview:
      typeof identity?.needsReview === "boolean"
        ? identity.needsReview
        : true,
    reason: identity?.reason?.trim() || "尚未形成正式项目名称的联网核验证据。",
    evidence: Array.isArray(identity?.evidence)
      ? identity.evidence
          .filter(
            (item) =>
              item &&
              typeof item.title === "string" &&
              typeof item.url === "string" &&
              item.url.startsWith("http"),
          )
          .map((item) => ({
            title: item.title.trim() || item.url,
            url: item.url.trim(),
            quote: typeof item.quote === "string" ? item.quote.trim() : "",
          }))
      : [],
  };
}

export function normalizeArticle(
  article: CaseArticle | undefined,
  item: Parameters<typeof fallbackSections>[0],
): CaseArticle {
  const grouped = new Map<CaseArticleSectionId, CaseArticleSection>();
  for (const section of article?.sections || []) {
    if (!articleSectionOrder.includes(section.id)) continue;
    const current = grouped.get(section.id);
    const next: CaseArticleSection = {
      id: section.id,
      title: articleSectionTitles[section.id],
      summary: section.summary?.trim() || "",
      paragraphs: cleanStrings(section.paragraphs),
      points: cleanStrings(section.points),
      evidenceRefs: cleanStrings(section.evidenceRefs),
    };
    if (current) {
      grouped.set(section.id, {
        ...current,
        summary: current.summary || next.summary,
        paragraphs: cleanStrings([...current.paragraphs, ...next.paragraphs]),
        points: cleanStrings([...current.points, ...next.points]),
        evidenceRefs: cleanStrings([
          ...current.evidenceRefs,
          ...next.evidenceRefs,
        ]),
      });
    } else {
      grouped.set(section.id, next);
    }
  }

  const generated = articleSectionOrder
    .map((id) => grouped.get(id))
    .filter(
      (section): section is CaseArticleSection =>
        section !== undefined &&
        (Boolean(section.summary) ||
          section.paragraphs.length > 0 ||
          section.points.length > 0),
    );
  const sections = generated.length > 0 ? generated : fallbackSections(item);

  return {
    standfirst: article?.standfirst?.trim() || item.summary,
    keyFindings: cleanStrings(
      article?.keyFindings?.length
        ? article.keyFindings
        : [...item.solution.slice(0, 2), ...item.outcomes.slice(0, 2)],
    ).slice(0, 6),
    sections,
  };
}

export function articleCharacterCount(article?: CaseArticle) {
  if (!article) return 0;
  return [
    article.standfirst,
    ...article.keyFindings,
    ...article.sections.flatMap((section) => [
      section.summary,
      ...section.paragraphs,
      ...section.points,
    ]),
  ].join("").length;
}

export function articleQualityIssues(item: SmartCityCase) {
  const issues: string[] = [];
  const identity = normalizeIdentity(item.identity, item.title);
  const article = normalizeArticle(item.article, item);
  if (identity.needsReview || identity.confidence < 0.7) {
    issues.push("正式项目名称尚未达到70%核验置信度。");
  }
  if (identity.canonicalTitle !== item.title.trim()) {
    issues.push("案例名称与AI核验后的正式项目名称不一致。");
  }
  if (article.sections.length < 4) {
    issues.push("结构化文章少于4个有效章节。");
  }
  if (articleCharacterCount(article) < 1_200) {
    issues.push("结构化文章内容不足1200字，建议补充研究资料。");
  }
  const duplicateTitles = article.sections
    .map((section) => section.title)
    .filter((title, index, values) => values.indexOf(title) !== index);
  if (duplicateTitles.length > 0) {
    issues.push("结构化文章存在重复章节。");
  }
  return issues;
}
