import type {
  CaseArticle,
  CaseArticleSectionId,
  CaseMediaPlanItem,
  CaseProjectIdentity,
  CaseResearchSource,
  LocationMethod,
  SmartCityCase,
} from "./case-model";

export const DEFAULT_AI_CASE_PARSER_PROVIDER = "deepseek";
export const OPENAI_CASE_PARSER_MODEL = "gpt-5.6-sol";
export const GEMINI_CASE_PARSER_MODEL = "gemini-3.5-flash";
export const DEEPSEEK_CASE_PARSER_MODEL = "deepseek-v4-flash";
export const QWEN_CASE_PARSER_MODEL = "qwen-plus";
export const MAX_CASE_SOURCE_CHARACTERS = 80_000;
export const MAX_CASE_PDF_BYTES = 8 * 1024 * 1024;
export const MAX_RESEARCH_SEARCH_CALLS = 10;

export type AiCaseParserProvider = "deepseek" | "qwen" | "gemini" | "openai";

export const assessmentFields = [
  "title",
  "location",
  "owner",
  "investmentAmount",
  "solution",
  "outcomes",
  "source",
] as const;

export type AssessmentField = (typeof assessmentFields)[number];

export type CaseFieldAssessment = {
  field: AssessmentField;
  confidence: number;
  evidence: string;
  needsReview: boolean;
  reason: string;
};

export type ParsedCaseFields = Pick<
  SmartCityCase,
  | "title"
  | "province"
  | "city"
  | "district"
  | "category"
  | "year"
  | "owner"
  | "locationLevel"
  | "coverageType"
  | "sourceType"
  | "evidenceLevel"
  | "summary"
  | "painPoints"
  | "solution"
  | "outcomes"
  | "aiTags"
  | "expertView"
  | "sourceTitle"
  | "sourceExcerpt"
  | "projectStage"
  | "investmentAmount"
  | "fundingSource"
  | "implementationUnit"
  | "operationUnit"
  | "lng"
  | "lat"
  | "locationConfidence"
  | "locationMethod"
  | "locationReason"
  | "researchReport"
>;

export type CaseParserOutput = {
  compatible: boolean;
  incompatibilityReason: string;
  case: ParsedCaseFields;
  identity: CaseProjectIdentity;
  article: CaseArticle;
  mediaPlan: CaseMediaPlanItem[];
  fieldAssessments: CaseFieldAssessment[];
  reviewItems: string[];
  researchSources: CaseResearchSource[];
  researchQueries: string[];
};

export type CaseParserResponse = {
  result: CaseParserOutput;
  meta: {
    provider: AiCaseParserProvider;
    model: string;
    responseId: string;
    inputTokens: number;
    outputTokens: number;
    researchMode: boolean;
    searchQueryCount: number;
    estimatedCostCny: number;
    fallbackUsed: boolean;
    fallbackReason: string;
  };
};

const stringSchema = { type: "string" } as const;
const stringArraySchema = {
  type: "array",
  items: { type: "string" },
} as const;

export const caseParserJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "compatible",
    "incompatibilityReason",
    "case",
    "identity",
    "article",
    "mediaPlan",
    "fieldAssessments",
    "reviewItems",
    "researchSources",
    "researchQueries",
  ],
  properties: {
    compatible: { type: "boolean" },
    incompatibilityReason: stringSchema,
    case: {
      type: "object",
      additionalProperties: false,
      required: [
        "title",
        "province",
        "city",
        "district",
        "category",
        "year",
        "owner",
        "locationLevel",
        "coverageType",
        "sourceType",
        "evidenceLevel",
        "summary",
        "painPoints",
        "solution",
        "outcomes",
        "aiTags",
        "expertView",
        "sourceTitle",
        "sourceExcerpt",
        "projectStage",
        "investmentAmount",
        "fundingSource",
        "implementationUnit",
        "operationUnit",
        "lng",
        "lat",
        "locationConfidence",
        "locationMethod",
        "locationReason",
        "researchReport",
      ],
      properties: {
        title: stringSchema,
        province: stringSchema,
        city: stringSchema,
        district: stringSchema,
        category: {
          type: "string",
          enum: ["低空经济", "城市运行", "CIM / 数字孪生", "智慧交通", "生态环保", "应急治理", "政务服务", "产业园区"],
        },
        year: { type: "integer", minimum: 0, maximum: 2100 },
        owner: stringSchema,
        locationLevel: {
          type: "string",
          enum: ["省级", "市级", "区县级", "园区/项目点"],
        },
        coverageType: {
          type: "string",
          enum: ["单点项目", "城市级平台", "区县级场景", "省域统筹", "园区示范"],
        },
        sourceType: {
          type: "string",
          enum: ["政策文件", "新闻报道", "招投标公告", "企业案例", "会议材料", "研究报告"],
        },
        evidenceLevel: {
          type: "string",
          enum: ["强", "中", "弱"],
        },
        summary: stringSchema,
        painPoints: stringArraySchema,
        solution: stringArraySchema,
        outcomes: stringArraySchema,
        aiTags: stringArraySchema,
        expertView: stringSchema,
        sourceTitle: stringSchema,
        sourceExcerpt: stringSchema,
        projectStage: {
          type: "string",
          enum: ["前期谋划", "采购招标", "建设实施", "验收运营", "持续运维"],
        },
        investmentAmount: stringSchema,
        fundingSource: stringSchema,
        implementationUnit: stringSchema,
        operationUnit: stringSchema,
        lng: { type: "number", minimum: -180, maximum: 180 },
        lat: { type: "number", minimum: -90, maximum: 90 },
        locationConfidence: { type: "number", minimum: 0, maximum: 1 },
        locationMethod: {
          type: "string",
          enum: ["source_exact", "province_capital_default", "city_center_inferred"] satisfies LocationMethod[],
        },
        locationReason: stringSchema,
        researchReport: stringSchema,
      },
    },
    identity: {
      type: "object",
      additionalProperties: false,
      required: [
        "canonicalTitle",
        "candidates",
        "aliases",
        "confidence",
        "needsReview",
        "reason",
        "evidence",
      ],
      properties: {
        canonicalTitle: stringSchema,
        candidates: stringArraySchema,
        aliases: stringArraySchema,
        confidence: { type: "number", minimum: 0, maximum: 1 },
        needsReview: { type: "boolean" },
        reason: stringSchema,
        evidence: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["title", "url", "quote"],
            properties: {
              title: stringSchema,
              url: stringSchema,
              quote: stringSchema,
            },
          },
        },
      },
    },
    article: {
      type: "object",
      additionalProperties: false,
      required: ["standfirst", "keyFindings", "sections"],
      properties: {
        standfirst: stringSchema,
        keyFindings: stringArraySchema,
        sections: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: [
              "id",
              "title",
              "summary",
              "paragraphs",
              "points",
              "evidenceRefs",
            ],
            properties: {
              id: {
                type: "string",
                enum: [
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
                ] satisfies CaseArticleSectionId[],
              },
              title: stringSchema,
              summary: stringSchema,
              paragraphs: stringArraySchema,
              points: stringArraySchema,
              evidenceRefs: stringArraySchema,
            },
          },
        },
      },
    },
    mediaPlan: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "candidateId",
          "kind",
          "sectionId",
          "caption",
          "alt",
          "confidence",
          "needsReview",
          "reason",
        ],
        properties: {
          candidateId: stringSchema,
          kind: {
            type: "string",
            enum: [
              "platform_ui",
              "dashboard",
              "architecture",
              "map",
              "site_photo",
              "document",
              "other",
            ],
          },
          sectionId: {
            type: "string",
            enum: [
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
            ] satisfies CaseArticleSectionId[],
          },
          caption: stringSchema,
          alt: stringSchema,
          confidence: { type: "number", minimum: 0, maximum: 1 },
          needsReview: { type: "boolean" },
          reason: stringSchema,
        },
      },
    },
    fieldAssessments: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["field", "confidence", "evidence", "needsReview", "reason"],
        properties: {
          field: {
            type: "string",
            enum: assessmentFields,
          },
          confidence: {
            type: "number",
            minimum: 0,
            maximum: 1,
          },
          evidence: stringSchema,
          needsReview: { type: "boolean" },
          reason: stringSchema,
        },
      },
    },
    reviewItems: stringArraySchema,
    researchSources: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "url"],
        properties: {
          title: stringSchema,
          url: stringSchema,
        },
      },
    },
    researchQueries: stringArraySchema,
  },
} as const;

export const assessmentLabels: Record<AssessmentField, string> = {
  title: "案例名称",
  location: "项目位置",
  owner: "建设主体",
  investmentAmount: "投资金额",
  solution: "建设内容",
  outcomes: "应用成效",
  source: "来源证据",
};
