import type {
  CaseFieldAssessment,
  CaseParserOutput,
  ParsedCaseFields,
} from "./ai-case-parser";
import type {
  CaseArticle,
  CaseArticleSection,
  CaseArticleSectionId,
  CaseClaimType,
  CaseContentClaim,
  CaseContentLevel,
  CaseContentSection,
  CaseContentSectionId,
  CaseDataAsset,
  CaseEvidenceStatus,
  CaseMetric,
  CaseMilestone,
  CaseOrganization,
  CaseOrganizationRole,
  CaseMediaPlanItem,
  CaseProjectIdentity,
  CaseScenario,
} from "./case-model";

export const NATIVE_CASE_PROTOCOL_VERSION = "1.0" as const;

export type NativeIdentityPackage = {
  protocolVersion: typeof NATIVE_CASE_PROTOCOL_VERSION;
  compatible: boolean;
  incompatibilityReason: string;
  case: ParsedCaseFields;
  identity: CaseProjectIdentity;
  mediaPlan: CaseMediaPlanItem[];
  fieldAssessments: CaseFieldAssessment[];
  reviewItems: string[];
};

export type NativeEvidencePackage = {
  protocolVersion: typeof NATIVE_CASE_PROTOCOL_VERSION;
  identityResolution: {
    canonicalTitle: string;
    candidates: string[];
    aliases: string[];
    confidence: number;
    needsReview: boolean;
    reason: string;
    evidence: Array<{ sourceId: string; quote: string }>;
  };
  claims: CaseContentClaim[];
  organizations: CaseOrganization[];
  dataAssets: CaseDataAsset[];
  scenarios: CaseScenario[];
  metrics: CaseMetric[];
  milestones: CaseMilestone[];
  limitations: string[];
  replicationConditions: string[];
  reviewItems: string[];
};

export type NativeArticlePackage = {
  protocolVersion: typeof NATIVE_CASE_PROTOCOL_VERSION;
  contentLevel: CaseContentLevel;
  standfirst: string;
  keyFindings: string[];
  sections: CaseContentSection[];
};

const sectionIds: CaseContentSectionId[] = [
  "project_overview",
  "why_build",
  "how_build",
  "core_scenarios",
  "implementation_operation",
  "innovation_outcomes",
  "lessons_boundaries",
];

const sectionTitles: Record<CaseContentSectionId, string> = {
  project_overview: "项目概况",
  why_build: "为什么建设",
  how_build: "如何建设",
  core_scenarios: "核心场景与业务闭环",
  implementation_operation: "实施与运营",
  innovation_outcomes: "创新与实际成效",
  lessons_boundaries: "经验、边界与适用条件",
};

const claimTypes: CaseClaimType[] = [
  "verified_fact",
  "source_claim",
  "ai_inference",
  "editorial_judgment",
  "unresolved",
];

const evidenceStatuses: CaseEvidenceStatus[] = [
  "verified",
  "source_claimed",
  "derived",
  "qualitative",
  "unknown",
];

const organizationRoles: CaseOrganizationRole[] = [
  "建设/牵头",
  "实施",
  "运营",
  "使用",
  "数据提供",
  "技术支持",
];

const legacySectionMap: Record<CaseContentSectionId, CaseArticleSectionId> = {
  project_overview: "overview",
  why_build: "background",
  how_build: "architecture",
  core_scenarios: "capabilities",
  implementation_operation: "delivery",
  innovation_outcomes: "outcomes",
  lessons_boundaries: "boundaries",
};

function objectValue(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function stringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(value.map(stringValue).filter(Boolean)),
  );
}

function numberValue(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

function booleanValue(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function validSourceIds(value: unknown, sourceIds: Set<string>) {
  return stringArray(value).filter((id) => sourceIds.has(id));
}

export function normalizeNativeEvidencePackage(
  value: unknown,
  allowedSourceIds: string[],
): NativeEvidencePackage {
  const root = objectValue(value) || {};
  const sourceIds = new Set(allowedSourceIds);
  const rawResolution = objectValue(root.identityResolution) || {};
  const identityResolution = {
    canonicalTitle: stringValue(rawResolution.canonicalTitle),
    candidates: stringArray(rawResolution.candidates),
    aliases: stringArray(rawResolution.aliases),
    confidence: Math.min(
      1,
      Math.max(0, numberValue(rawResolution.confidence)),
    ),
    needsReview: booleanValue(rawResolution.needsReview, true),
    reason: stringValue(rawResolution.reason),
    evidence: (
      Array.isArray(rawResolution.evidence) ? rawResolution.evidence : []
    )
      .map(objectValue)
      .filter((item): item is Record<string, unknown> => Boolean(item))
      .map((item) => ({
        sourceId: stringValue(item.sourceId),
        quote: stringValue(item.quote),
      }))
      .filter(
        (item) => sourceIds.has(item.sourceId) && Boolean(item.quote),
      )
      .slice(0, 8),
  };
  const rawClaims = Array.isArray(root.claims) ? root.claims : [];
  const claims = rawClaims
    .map(objectValue)
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .map((item, index): CaseContentClaim => {
      const sectionId = stringValue(item.sectionId) as CaseContentSectionId;
      const type = stringValue(item.type) as CaseClaimType;
      const evidenceStatus = stringValue(
        item.evidenceStatus,
      ) as CaseEvidenceStatus;
      return {
        id: stringValue(item.id) || `claim-${index + 1}`,
        statement: stringValue(item.statement),
        type: claimTypes.includes(type) ? type : "unresolved",
        evidenceStatus: evidenceStatuses.includes(evidenceStatus)
          ? evidenceStatus
          : "unknown",
        sourceIds: validSourceIds(item.sourceIds, sourceIds),
        sectionId: sectionIds.includes(sectionId)
          ? sectionId
          : "project_overview",
        confidence: Math.min(1, Math.max(0, numberValue(item.confidence))),
        conflict: stringValue(item.conflict),
        reviewed: false,
      };
    })
    .filter((item) => item.statement)
    .slice(0, 80);

  const rawOrganizations = Array.isArray(root.organizations)
    ? root.organizations
    : [];
  const organizations = rawOrganizations
    .map(objectValue)
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .map((item): CaseOrganization => {
      const role = stringValue(item.role) as CaseOrganizationRole;
      return {
        name: stringValue(item.name),
        role: organizationRoles.includes(role) ? role : "技术支持",
        sourceIds: validSourceIds(item.sourceIds, sourceIds),
        reviewed: false,
      };
    })
    .filter((item) => item.name)
    .slice(0, 20);

  const dataAssets = (Array.isArray(root.dataAssets) ? root.dataAssets : [])
    .map(objectValue)
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .map(
      (item): CaseDataAsset => ({
        name: stringValue(item.name),
        category: stringValue(item.category),
        source: stringValue(item.source),
        usage: stringValue(item.usage),
        sensitivity: stringValue(item.sensitivity),
        sourceIds: validSourceIds(item.sourceIds, sourceIds),
      }),
    )
    .filter((item) => item.name)
    .slice(0, 30);

  const scenarios = (Array.isArray(root.scenarios) ? root.scenarios : [])
    .map(objectValue)
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .map(
      (item, index): CaseScenario => ({
        id: stringValue(item.id) || `scenario-${index + 1}`,
        name: stringValue(item.name),
        problem: stringValue(item.problem),
        dataInputs: stringArray(item.dataInputs),
        systemActions: stringArray(item.systemActions),
        businessActions: stringArray(item.businessActions),
        result: stringValue(item.result),
        sourceIds: validSourceIds(item.sourceIds, sourceIds),
      }),
    )
    .filter((item) => item.name)
    .slice(0, 12);

  const metrics = (Array.isArray(root.metrics) ? root.metrics : [])
    .map(objectValue)
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .map((item): CaseMetric => {
      const evidenceStatus = stringValue(
        item.evidenceStatus,
      ) as CaseEvidenceStatus;
      return {
        name: stringValue(item.name),
        value: stringValue(item.value),
        unit: stringValue(item.unit),
        period: stringValue(item.period),
        baseline: stringValue(item.baseline),
        evidenceStatus: evidenceStatuses.includes(evidenceStatus)
          ? evidenceStatus
          : "unknown",
        sourceIds: validSourceIds(item.sourceIds, sourceIds),
        reviewed: false,
      };
    })
    .filter((item) => item.name && item.value)
    .slice(0, 20);

  const milestones = (Array.isArray(root.milestones) ? root.milestones : [])
    .map(objectValue)
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .map(
      (item): CaseMilestone => ({
        date: stringValue(item.date),
        event: stringValue(item.event),
        sourceIds: validSourceIds(item.sourceIds, sourceIds),
      }),
    )
    .filter((item) => item.event)
    .slice(0, 20);

  return {
    protocolVersion: NATIVE_CASE_PROTOCOL_VERSION,
    identityResolution,
    claims,
    organizations,
    dataAssets,
    scenarios,
    metrics,
    milestones,
    limitations: stringArray(root.limitations).slice(0, 12),
    replicationConditions: stringArray(root.replicationConditions).slice(0, 12),
    reviewItems: stringArray(root.reviewItems).slice(0, 20),
  };
}

export function normalizeNativeIdentityPackage(
  value: unknown,
): NativeIdentityPackage {
  const root = objectValue(value) || {};
  const rawCase = objectValue(root.case) || {};
  const rawIdentity = objectValue(root.identity) || {};
  const title = stringValue(rawCase.title) || stringValue(rawIdentity.canonicalTitle);
  const parsedCase = {
    title,
    province: stringValue(rawCase.province),
    city: stringValue(rawCase.city),
    district: stringValue(rawCase.district),
    category: stringValue(rawCase.category) || "城市运行",
    year: Math.round(numberValue(rawCase.year)),
    owner: stringValue(rawCase.owner),
    locationLevel: stringValue(rawCase.locationLevel) || "市级",
    coverageType: stringValue(rawCase.coverageType) || "城市级平台",
    sourceType: stringValue(rawCase.sourceType) || "新闻报道",
    evidenceLevel: stringValue(rawCase.evidenceLevel) || "弱",
    summary: stringValue(rawCase.summary),
    painPoints: stringArray(rawCase.painPoints),
    solution: stringArray(rawCase.solution),
    outcomes: stringArray(rawCase.outcomes),
    aiTags: stringArray(rawCase.aiTags),
    expertView: stringValue(rawCase.expertView),
    sourceTitle: stringValue(rawCase.sourceTitle),
    sourceExcerpt: stringValue(rawCase.sourceExcerpt),
    projectStage: stringValue(rawCase.projectStage) || "前期谋划",
    investmentAmount: stringValue(rawCase.investmentAmount),
    fundingSource: stringValue(rawCase.fundingSource),
    implementationUnit: stringValue(rawCase.implementationUnit),
    operationUnit: stringValue(rawCase.operationUnit),
    lng: numberValue(rawCase.lng),
    lat: numberValue(rawCase.lat),
    locationConfidence: Math.min(
      1,
      Math.max(0, numberValue(rawCase.locationConfidence)),
    ),
    locationMethod:
      stringValue(rawCase.locationMethod) || "city_center_inferred",
    locationReason: stringValue(rawCase.locationReason),
    researchReport: "",
  } as ParsedCaseFields;
  const identity: CaseProjectIdentity = {
    canonicalTitle: stringValue(rawIdentity.canonicalTitle) || title,
    candidates: stringArray(rawIdentity.candidates),
    aliases: stringArray(rawIdentity.aliases),
    confidence: Math.min(
      1,
      Math.max(0, numberValue(rawIdentity.confidence)),
    ),
    needsReview: booleanValue(rawIdentity.needsReview, true),
    reason: stringValue(rawIdentity.reason),
    evidence: (Array.isArray(rawIdentity.evidence) ? rawIdentity.evidence : [])
      .map(objectValue)
      .filter((item): item is Record<string, unknown> => Boolean(item))
      .map((item) => ({
        title: stringValue(item.title),
        url: stringValue(item.url),
        quote: stringValue(item.quote),
      }))
      .filter((item) => item.title || item.url || item.quote)
      .slice(0, 8),
  };
  const mediaPlan = (Array.isArray(root.mediaPlan) ? root.mediaPlan : [])
    .map(objectValue)
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .map(
      (item): CaseMediaPlanItem => ({
        candidateId: stringValue(item.candidateId),
        kind: stringValue(item.kind) as CaseMediaPlanItem["kind"],
        sectionId: stringValue(
          item.sectionId,
        ) as CaseMediaPlanItem["sectionId"],
        caption: stringValue(item.caption),
        alt: stringValue(item.alt),
        confidence: Math.min(
          1,
          Math.max(0, numberValue(item.confidence)),
        ),
        needsReview: true,
        reason: stringValue(item.reason),
      }),
    )
    .filter((item) => item.candidateId)
    .slice(0, 6);
  const fieldAssessments = (
    Array.isArray(root.fieldAssessments) ? root.fieldAssessments : []
  )
    .map(objectValue)
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .map(
      (item): CaseFieldAssessment => ({
        field: stringValue(item.field) as CaseFieldAssessment["field"],
        confidence: Math.min(
          1,
          Math.max(0, numberValue(item.confidence)),
        ),
        evidence: stringValue(item.evidence),
        needsReview: booleanValue(item.needsReview, true),
        reason: stringValue(item.reason),
      }),
    )
    .filter((item) =>
      [
        "title",
        "location",
        "owner",
        "investmentAmount",
        "solution",
        "outcomes",
        "source",
      ].includes(item.field),
    );
  return {
    protocolVersion: NATIVE_CASE_PROTOCOL_VERSION,
    compatible: booleanValue(root.compatible, true),
    incompatibilityReason: stringValue(root.incompatibilityReason),
    case: parsedCase,
    identity,
    mediaPlan,
    fieldAssessments,
    reviewItems: stringArray(root.reviewItems).slice(0, 20),
  };
}

export function nativeIdentityToParserOutput(
  identity: NativeIdentityPackage,
): CaseParserOutput {
  return {
    compatible: identity.compatible,
    incompatibilityReason: identity.incompatibilityReason,
    case: identity.case,
    identity: identity.identity,
    article: {
      standfirst: identity.case.summary,
      keyFindings: [
        ...identity.case.solution.slice(0, 2),
        ...identity.case.outcomes.slice(0, 2),
      ],
      sections: [],
    },
    mediaPlan: identity.mediaPlan,
    fieldAssessments: identity.fieldAssessments,
    reviewItems: identity.reviewItems,
    researchSources: [],
    researchQueries: [],
  };
}

export function normalizeNativeArticlePackage(
  value: unknown,
  allowedClaimIds: string[],
): NativeArticlePackage {
  const root = objectValue(value) || {};
  const claimIds = new Set(allowedClaimIds);
  const rawSections = Array.isArray(root.sections) ? root.sections : [];
  const normalizedSections = rawSections
    .map(objectValue)
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .map((item): CaseContentSection | null => {
      const id = stringValue(item.id) as CaseContentSectionId;
      if (!sectionIds.includes(id)) return null;
      return {
        id,
        title: stringValue(item.title),
        summary: stringValue(item.summary),
        paragraphs: stringArray(item.paragraphs),
        points: stringArray(item.points),
        claimIds: validSourceIds(item.claimIds, claimIds),
        mediaIds: stringArray(item.mediaIds),
      };
    })
    .filter((item): item is CaseContentSection => Boolean(item));
  const sectionsById = new Map<CaseContentSectionId, CaseContentSection>();
  for (const item of normalizedSections) {
    if (!sectionsById.has(item.id)) sectionsById.set(item.id, item);
  }
  const sections = sectionIds.map((id) => {
    const existing = sectionsById.get(id);
    if (existing) {
      return {
        ...existing,
        title: existing.title || sectionTitles[id],
      };
    }
    return {
      id,
      title: sectionTitles[id],
      summary: "现有证据不足，待补充资料后完善本章。",
      paragraphs: [],
      points: [],
      claimIds: [],
      mediaIds: [],
    };
  });
  const requestedLevel = stringValue(root.contentLevel) as CaseContentLevel;
  return {
    protocolVersion: NATIVE_CASE_PROTOCOL_VERSION,
    contentLevel: ["quick", "standard", "deep"].includes(requestedLevel)
      ? requestedLevel
      : "standard",
    standfirst: stringValue(root.standfirst),
    keyFindings: stringArray(root.keyFindings).slice(0, 6),
    sections,
  };
}

export function nativeArticleToLegacy(
  article: NativeArticlePackage,
  claims: CaseContentClaim[],
): CaseArticle {
  const claimsById = new Map(claims.map((claim) => [claim.id, claim]));
  const sections: CaseArticleSection[] = article.sections.map((section) => ({
    id: legacySectionMap[section.id],
    title: section.title,
    summary: section.summary,
    paragraphs: section.paragraphs,
    points: section.points,
    evidenceRefs: Array.from(
      new Set(
        section.claimIds.flatMap(
          (claimId) => claimsById.get(claimId)?.sourceIds || [],
        ),
      ),
    ).map((sourceId) =>
      sourceId === "source-original"
        ? "原始资料"
        : sourceId.replace("source-", "来源"),
    ),
  }));
  return {
    standfirst: article.standfirst,
    keyFindings: article.keyFindings,
    sections,
  };
}

export function nativeEvidencePrompt(input: {
  sourceText: string;
  sourceUrl: string;
  baseDraft: unknown;
  researchContext: string;
  availableSources: Array<{ id: string; title: string; url: string }>;
}) {
  return `你是 Digital X 城市数智应用案例库的事实与证据分析器。请按照原生协议 V1.0 输出事实证据包。

原则：
1. 只能使用原始资料、基础草稿和联网搜索摘要中的信息，不得补写常识性想象。
2. 每条 claim 必须区分 verified_fact、source_claim、ai_inference、editorial_judgment、unresolved。
3. 必须先用联网和原始证据复核候选项目名称，写入 identityResolution；不能因为搜索频次高就认定正式名称。
4. sourceIds 只能使用“可用来源”中给出的 id；无法确定来源时必须返回空数组。
5. verified_fact 需要权威来源或至少两个独立来源；只有单一来源自述时使用 source_claim。
6. 成效指标必须写明数值、单位、时间范围和口径；缺失项用空字符串，不得补猜。
7. 核心场景必须形成 problem → dataInputs → systemActions → businessActions → result。
8. 建设、实施、运营、使用、数据提供和技术支持单位必须分开。
9. AI推断必须显式标为 ai_inference，confidence 不得高于0.69，并进入 reviewItems。
10. 不要只提取摘要。原始资料或联网摘要中明确出现的建设问题、数据、系统动作、业务角色、应用结果、实施运营、限制条件和量化指标都要进入对应结构。
11. 资料较完整时，应形成覆盖多个章节的证据集合；每个有证据支撑的章节至少输出一条 claim，但不得为凑数量制造陈述。
12. 只返回 JSON，不要返回文章，不要使用 Markdown。

返回结构：
{
  "protocolVersion":"1.0",
  "identityResolution":{"canonicalTitle":"","candidates":[],"aliases":[],"confidence":0,"needsReview":true,"reason":"","evidence":[{"sourceId":"source-1","quote":""}]},
  "claims":[{"id":"claim-1","statement":"","type":"source_claim","evidenceStatus":"source_claimed","sourceIds":["source-1"],"sectionId":"project_overview","confidence":0.7,"conflict":""}],
  "organizations":[{"name":"","role":"建设/牵头","sourceIds":["source-1"]}],
  "dataAssets":[{"name":"","category":"","source":"","usage":"","sensitivity":"","sourceIds":["source-1"]}],
  "scenarios":[{"id":"scenario-1","name":"","problem":"","dataInputs":[],"systemActions":[],"businessActions":[],"result":"","sourceIds":[]}],
  "metrics":[{"name":"","value":"","unit":"","period":"","baseline":"","evidenceStatus":"source_claimed","sourceIds":[],"reviewed":false}],
  "milestones":[{"date":"","event":"","sourceIds":[]}],
  "limitations":[],
  "replicationConditions":[],
  "reviewItems":[]
}

七章 sectionId 只能使用：
project_overview、why_build、how_build、core_scenarios、implementation_operation、innovation_outcomes、lessons_boundaries。

可用来源：
${JSON.stringify(input.availableSources)}

原始网址：${input.sourceUrl || "无"}

原始资料：
${input.sourceText.slice(0, 80_000)}

基础身份与字段草稿：
${JSON.stringify(input.baseDraft)}

联网搜索摘要：
${input.researchContext || "本次没有可用联网资料，只能从原始资料抽取；无来源陈述必须标记 unresolved。"}
`;
}

export function nativeIdentityPrompt(input: {
  sourceText: string;
  sourceUrl: string;
  mediaCandidates: unknown[];
}) {
  return `你是 Digital X 城市数智应用案例库的项目身份与基础字段解析器。请输出原生协议 V1.0 的第一阶段结果，不要生成长文。

规则：
1. case.title 必须是具体项目、平台或系统的正式名称，不得直接使用文件名、文章标题或“某某案例”。
2. 当前阶段只依据原始资料识别候选名称；证据不足时 needsReview=true，confidence 不高于0.69。
3. 不明确的单位、金额、时间、成效必须留空，不得推测。
4. 计划目标和已经实现的成效必须分开，只有已经发生的结果才能进入 outcomes。
5. 原文仅明确省份时，city 使用省会作为地图展示锚点，并明确 locationMethod=province_capital_default、confidence不高于0.55。
6. mediaPlan 只能引用给定图片 candidateId，最多6张，全部 needsReview=true。
7. 只返回JSON，不生成article、researchSources或researchReport。

返回结构：
{
  "protocolVersion":"1.0",
  "compatible":true,
  "incompatibilityReason":"",
  "case":{
    "title":"","province":"","city":"","district":"","category":"城市运行","year":0,"owner":"",
    "locationLevel":"市级","coverageType":"城市级平台","sourceType":"新闻报道","evidenceLevel":"弱",
    "summary":"","painPoints":[],"solution":[],"outcomes":[],"aiTags":[],"expertView":"",
    "sourceTitle":"","sourceExcerpt":"","projectStage":"前期谋划","investmentAmount":"",
    "fundingSource":"","implementationUnit":"","operationUnit":"","lng":0,"lat":0,
    "locationConfidence":0,"locationMethod":"city_center_inferred","locationReason":"","researchReport":""
  },
  "identity":{"canonicalTitle":"","candidates":[],"aliases":[],"confidence":0,"needsReview":true,"reason":"","evidence":[]},
  "mediaPlan":[],
  "fieldAssessments":[{"field":"title","confidence":0,"evidence":"","needsReview":true,"reason":""}],
  "reviewItems":[]
}

原始网址：${input.sourceUrl || "无"}

原始资料：
${input.sourceText.slice(0, 80_000)}

图片候选：
${JSON.stringify(input.mediaCandidates)}
`;
}

export function nativeArticlePrompt(input: {
  baseDraft: unknown;
  evidence: NativeEvidencePackage;
  availableSources: Array<{ id: string; title: string; url: string }>;
  mediaCandidateIds: string[];
}) {
  return `你是 Digital X 城市数智应用案例库的资深案例编辑。请根据已经完成的事实证据包，生成原生协议 V1.0 七章正文包。

写作规则：
1. 只能使用 evidence 中的事实，不得新增单位、金额、时间、参数或成效。
2. 每个章节必须通过 claimIds 引用事实陈述；没有 claim 支撑的内容不得写入正文。
3. 全文固定七章：项目概况、为什么建设、如何建设、核心场景与业务闭环、实施与运营、创新与实际成效、经验边界与适用条件。
4. 公开证据不足时生成 quick；资料充足生成 standard；多源且实施成效充分才生成 deep。
5. standard 目标3000—6000字，但证据不足时不得重复或灌水。
6. 成效章节只引用 innovation_outcomes 的有来源 claim；计划目标不得写成实际成效。
7. mediaIds 只能使用给定图片候选 id；不确定时返回空数组。
8. sections 数组必须严格返回下面列出的七个章节，顺序和 id 不得改变、不得省略、不得重复。
9. 某章没有可用 claim 时仍保留该章节，summary 写“现有证据不足，待补充资料后完善本章。”，其他内容留空；不得为了填满章节编造事实。
10. paragraphs 应形成连续可读正文，points 只保留确有价值的提炼，不得重复 paragraphs。
11. 只返回 JSON，不使用 Markdown。

返回结构：
{
  "protocolVersion":"1.0",
  "contentLevel":"standard",
  "standfirst":"",
  "keyFindings":[],
  "sections":[
    {"id":"project_overview","title":"项目概况","summary":"","paragraphs":[],"points":[],"claimIds":[],"mediaIds":[]},
    {"id":"why_build","title":"为什么建设","summary":"","paragraphs":[],"points":[],"claimIds":[],"mediaIds":[]},
    {"id":"how_build","title":"如何建设","summary":"","paragraphs":[],"points":[],"claimIds":[],"mediaIds":[]},
    {"id":"core_scenarios","title":"核心场景与业务闭环","summary":"","paragraphs":[],"points":[],"claimIds":[],"mediaIds":[]},
    {"id":"implementation_operation","title":"实施与运营","summary":"","paragraphs":[],"points":[],"claimIds":[],"mediaIds":[]},
    {"id":"innovation_outcomes","title":"创新与实际成效","summary":"","paragraphs":[],"points":[],"claimIds":[],"mediaIds":[]},
    {"id":"lessons_boundaries","title":"经验、边界与适用条件","summary":"","paragraphs":[],"points":[],"claimIds":[],"mediaIds":[]}
  ]
}

基础项目草稿：
${JSON.stringify(input.baseDraft)}

事实证据包：
${JSON.stringify(input.evidence)}

来源目录：
${JSON.stringify(input.availableSources)}

图片候选 id：
${JSON.stringify(input.mediaCandidateIds)}
`;
}
