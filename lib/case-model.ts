export type CaseCategory =
  | "低空经济"
  | "城市运行"
  | "CIM / 数字孪生"
  | "智慧交通"
  | "生态环保"
  | "应急治理"
  | "政务服务"
  | "产业园区";

export type LocationLevel = "省级" | "市级" | "区县级" | "园区/项目点";

export type EvidenceLevel = "强" | "中" | "弱";

export type PublishStatus = "已发布" | "待复核" | "草稿";

export type LocationMethod =
  | "source_exact"
  | "province_capital_default"
  | "city_center_inferred";

export type CaseResearchSource = {
  title: string;
  url: string;
};

export type CaseContentLevel = "quick" | "standard" | "deep";

export type CaseClaimType =
  | "verified_fact"
  | "source_claim"
  | "ai_inference"
  | "editorial_judgment"
  | "unresolved";

export type CaseEvidenceStatus =
  | "verified"
  | "source_claimed"
  | "derived"
  | "qualitative"
  | "unknown";

export type CaseContentSectionId =
  | "project_overview"
  | "why_build"
  | "how_build"
  | "core_scenarios"
  | "implementation_operation"
  | "innovation_outcomes"
  | "lessons_boundaries";

export type CaseContentSource = {
  id: string;
  title: string;
  url: string;
  publisher: string;
  publishedAt: string;
  sourceType: SmartCityCase["sourceType"] | "原始资料" | "官方网站" | "其他";
  excerpt: string;
  evidenceLevel: EvidenceLevel;
  reviewed: boolean;
};

export type CaseContentClaim = {
  id: string;
  statement: string;
  type: CaseClaimType;
  evidenceStatus: CaseEvidenceStatus;
  sourceIds: string[];
  sectionId: CaseContentSectionId;
  confidence: number;
  conflict: string;
  reviewed: boolean;
};

export type CaseOrganizationRole =
  | "建设/牵头"
  | "实施"
  | "运营"
  | "使用"
  | "数据提供"
  | "技术支持";

export type CaseOrganization = {
  name: string;
  role: CaseOrganizationRole;
  sourceIds: string[];
  reviewed: boolean;
};

export type CaseDataAsset = {
  name: string;
  category: string;
  source: string;
  usage: string;
  sensitivity: string;
  sourceIds: string[];
};

export type CaseScenario = {
  id: string;
  name: string;
  problem: string;
  dataInputs: string[];
  systemActions: string[];
  businessActions: string[];
  result: string;
  sourceIds: string[];
};

export type CaseMetric = {
  name: string;
  value: string;
  unit: string;
  period: string;
  baseline: string;
  evidenceStatus: CaseEvidenceStatus;
  sourceIds: string[];
  reviewed: boolean;
};

export type CaseMilestone = {
  date: string;
  event: string;
  sourceIds: string[];
};

export type CaseContentSection = {
  id: CaseContentSectionId;
  title: string;
  summary: string;
  paragraphs: string[];
  points: string[];
  claimIds: string[];
  mediaIds: string[];
};

export type CaseQualityBreakdown = {
  identity: number;
  sourcesAndEvidence: number;
  completeness: number;
  problemSolution: number;
  dataAndBusiness: number;
  metrics: number;
  media: number;
  boundaries: number;
};

export type CaseQualityReview = {
  score: number;
  breakdown: CaseQualityBreakdown;
  blockingIssues: string[];
  warnings: string[];
  publishable: boolean;
  reviewedAt: string;
};

export type CaseContentModel = {
  schemaVersion: "1.0";
  generationMode?: "compatibility" | "native";
  contentLevel: CaseContentLevel;
  editorialSections: CaseContentSection[];
  sources: CaseContentSource[];
  claims: CaseContentClaim[];
  organizations: CaseOrganization[];
  dataAssets: CaseDataAsset[];
  scenarios: CaseScenario[];
  metrics: CaseMetric[];
  milestones: CaseMilestone[];
  limitations: string[];
  replicationConditions: string[];
  manualReviewStatus: "pending" | "in_review" | "approved";
  quality: CaseQualityReview;
};

export type CaseContentMigration = {
  protocolVersion: "1.0";
  status: "legacy" | "migrated" | "benchmark_draft" | "approved";
  benchmark: boolean;
  batchId: string;
  migratedAt: string;
  migratedFrom: "v1.4";
  reviewStatus: "pending" | "in_review" | "approved";
  sourceCount: number;
  substantiveSectionCount: number;
  reviewGates: CaseReviewGate[];
  production?: CaseProductionProfile;
  notes: string;
};

export type CaseProductionStage =
  | "queued"
  | "researching"
  | "evidence_ready"
  | "draft_ready"
  | "quality_review"
  | "final_review"
  | "approved"
  | "blocked";

export type CaseProductionPriority = "P0" | "P1" | "P2";

export type CaseProductionProfile = {
  release: "V1.5.0-beta.1" | "V1.5.0-beta.2";
  waveId: string;
  waveLabel: string;
  priority: CaseProductionPriority;
  stage: CaseProductionStage;
  ownerRole: string;
  targetSourceCount: number;
  targetCharacterCount: number;
  nextAction: string;
  rationale: string;
  lastAdvancedAt: string;
};

export type CaseReviewGateId =
  | "identity"
  | "sources"
  | "claims"
  | "metrics"
  | "media"
  | "editorial";

export type CaseReviewGate = {
  id: CaseReviewGateId;
  label: string;
  status: "pending" | "needs_work" | "approved";
  issueCount: number;
  note: string;
  approvedAt?: string;
  reviewer?: string;
};

export type CasePipelineStageId =
  | "input_validation"
  | "source_extraction"
  | "project_identity"
  | "web_research"
  | "fact_evidence_extraction"
  | "article_generation"
  | "quality_review"
  | "human_review_pending";

export type CasePipelineStage = {
  id: CasePipelineStageId;
  label: string;
  status: "completed" | "degraded" | "blocked" | "pending" | "skipped";
  message: string;
  durationMs: number;
  attempts?: number;
  provider?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostCny?: number;
  inputSummary?: string;
  outputSummary?: string;
  retryable?: boolean;
};

export type CasePipelineRun = {
  version: "1.0" | "1.1";
  startedAt: string;
  completedAt: string;
  status: "completed" | "degraded" | "blocked";
  stages: CasePipelineStage[];
};

export type CaseIdentityEvidence = {
  title: string;
  url: string;
  quote: string;
};

export type CaseProjectIdentity = {
  canonicalTitle: string;
  candidates: string[];
  aliases: string[];
  confidence: number;
  needsReview: boolean;
  reason: string;
  evidence: CaseIdentityEvidence[];
};

export type CaseArticleSectionId =
  | "overview"
  | "background"
  | "objectives"
  | "architecture"
  | "capabilities"
  | "delivery"
  | "investment"
  | "outcomes"
  | "boundaries"
  | "lessons"
  | "timeline";

export type CaseArticleSection = {
  id: CaseArticleSectionId;
  title: string;
  summary: string;
  paragraphs: string[];
  points: string[];
  evidenceRefs: string[];
};

export type CaseArticle = {
  standfirst: string;
  keyFindings: string[];
  sections: CaseArticleSection[];
};

export type CaseMediaKind =
  | "platform_ui"
  | "dashboard"
  | "architecture"
  | "map"
  | "site_photo"
  | "document"
  | "other";

export type CaseMediaSourceKind = "pdf_page" | "web_image";

export type CaseMediaCandidate = {
  id: string;
  sourceKind: CaseMediaSourceKind;
  pageNumber: number;
  sourceUrl: string;
  nearbyText: string;
  visualScore: number;
};

export type CaseMediaPlanItem = {
  candidateId: string;
  kind: CaseMediaKind;
  sectionId: CaseArticleSectionId;
  caption: string;
  alt: string;
  confidence: number;
  needsReview: boolean;
  reason: string;
};

export type CaseMediaAsset = CaseMediaPlanItem & {
  id: string;
  url: string;
  sourceKind: CaseMediaSourceKind;
  sourceUrl: string;
  pageNumber: number;
  included: boolean;
  reviewed: boolean;
};

export type SmartCityCase = {
  id: string;
  slug: string;
  title: string;
  city: string;
  province: string;
  district?: string;
  category: CaseCategory;
  year: number;
  owner: string;
  locationLevel: LocationLevel;
  lng: number;
  lat: number;
  locationConfidence: number;
  locationMethod?: LocationMethod;
  locationReason?: string;
  coverageType: "单点项目" | "城市级平台" | "区县级场景" | "省域统筹" | "园区示范";
  status: PublishStatus;
  sourceType: "政策文件" | "新闻报道" | "招投标公告" | "企业案例" | "会议材料" | "研究报告";
  evidenceLevel: EvidenceLevel;
  summary: string;
  painPoints: string[];
  solution: string[];
  outcomes: string[];
  aiTags: string[];
  expertView: string;
  sourceNote: string;
  sourceUrl?: string;
  sourceTitle?: string;
  sourceExcerpt?: string;
  projectStage?: "前期谋划" | "采购招标" | "建设实施" | "验收运营" | "持续运维";
  investmentAmount?: string;
  fundingSource?: string;
  implementationUnit?: string;
  operationUnit?: string;
  researchReport?: string;
  researchSources?: CaseResearchSource[];
  researchQueries?: string[];
  identity?: CaseProjectIdentity;
  article?: CaseArticle;
  media?: CaseMediaAsset[];
  contentModel?: CaseContentModel;
  contentMigration?: CaseContentMigration;
  parsePipeline?: CasePipelineRun;
  importedAt?: string;
  updatedAt?: string;
};

export const categories: CaseCategory[] = [
  "低空经济",
  "城市运行",
  "CIM / 数字孪生",
  "智慧交通",
  "生态环保",
  "应急治理",
  "政务服务",
  "产业园区",
];

export const categoryColors: Record<CaseCategory, string> = {
  低空经济: "#0f766e",
  城市运行: "#2563eb",
  "CIM / 数字孪生": "#7c3aed",
  智慧交通: "#ea580c",
  生态环保: "#16a34a",
  应急治理: "#dc2626",
  政务服务: "#0891b2",
  产业园区: "#4f46e5",
};
