import rawCaseIndex from "@/knowledge-base/index/digitalx_case_index_v1.json";
import part01 from "@/knowledge-base/index/digitalx_case_index_v1.part-01.json";
import part02 from "@/knowledge-base/index/digitalx_case_index_v1.part-02.json";
import part03 from "@/knowledge-base/index/digitalx_case_index_v1.part-03.json";
import part04 from "@/knowledge-base/index/digitalx_case_index_v1.part-04.json";
import part05 from "@/knowledge-base/index/digitalx_case_index_v1.part-05.json";
import part06 from "@/knowledge-base/index/digitalx_case_index_v1.part-06.json";
import part07 from "@/knowledge-base/index/digitalx_case_index_v1.part-07.json";
import part08 from "@/knowledge-base/index/digitalx_case_index_v1.part-08.json";
import {
  normalizeCaseCategory,
  type CaseCategory,
  type EvidenceLevel,
  type LocationLevel,
  type SmartCityCase,
} from "./case-model";

type IndexedCaseRow = {
  case_id: string;
  title: string;
  province?: string;
  city?: string;
  district?: string;
  domain?: string;
  solution_type?: string;
  technology?: string;
  topic?: string;
  project_stage?: string;
  lng?: number | string | null;
  lat?: number | string | null;
  poi_level?: string;
  poi_method?: string;
  poi_confidence?: string;
  source_level?: string;
  source_title?: string;
  source_url?: string;
};

function splitTerms(value?: string) {
  return String(value ?? "").split(/[；;,，]/).map((item) => item.trim()).filter(Boolean);
}

function categoryFromRow(row: IndexedCaseRow): CaseCategory {
  const text = [row.domain, row.solution_type, row.topic].join(" ");
  const rules: Array<[RegExp, CaseCategory]> = [
    [/数据要素|数据资产|数据交易/, "数据要素"],
    [/交通|轨道|公路|机场|港口|低空/, "交通出行"],
    [/水务|管网|生命线|应急|安全|防灾|消防/, "市政韧性"],
    [/生态|环保|双碳|能源|碳/, "生态低碳"],
    [/园区|产业|工业|楼宇/, "工业园区"],
    [/农业|乡村|农村/, "农业农村"],
    [/文旅|旅游|文化|体育|景区/, "文旅体育"],
    [/医疗|教育|养老|社区|民生/, "公共民生"],
    [/物流|商贸|供应链/, "商贸物流"],
    [/规划|工程|建设|BIM|CIM|城市更新/, "规划建设"],
    [/政务|政府|审批/, "数字政府"],
  ];
  return rules.find(([pattern]) => pattern.test(text))?.[1] ?? normalizeCaseCategory(row.domain);
}

function locationLevel(value?: string): LocationLevel {
  if (value === "district") return "区县级";
  if (value === "exact") return "园区/项目点";
  if (value === "province") return "省级";
  return "市级";
}

function evidenceLevel(value?: string): EvidenceLevel {
  if (["A", "B"].includes(String(value).toUpperCase())) return "强";
  if (String(value).toUpperCase() === "C") return "中";
  return "弱";
}

function confidence(value?: string) {
  if (value === "high") return 0.9;
  if (value === "medium") return 0.7;
  return value === "low" ? 0.45 : 0;
}

function projectStage(value?: string): SmartCityCase["projectStage"] {
  const text = String(value ?? "");
  if (/谋划|前期/.test(text)) return "前期谋划";
  if (/招标|采购/.test(text)) return "采购招标";
  if (/建设|实施/.test(text)) return "建设实施";
  if (/运维/.test(text)) return "持续运维";
  if (/建成|上线|验收|运营/.test(text)) return "验收运营";
  return undefined;
}

function toIndexedCase(row: IndexedCaseRow): SmartCityCase {
  const lng = Number(row.lng);
  const lat = Number(row.lat);
  const hasPoi = Number.isFinite(lng) && Number.isFinite(lat) && lng >= 73 && lng <= 136 && lat >= 3 && lat <= 54;
  const terms = [...splitTerms(row.domain), ...splitTerms(row.solution_type), ...splitTerms(row.technology), ...splitTerms(row.topic)];
  return {
    id: row.case_id,
    slug: row.case_id.toLowerCase(),
    title: row.title,
    province: row.province || "待确认",
    city: row.city || row.province || "待确认",
    district: row.district || undefined,
    category: categoryFromRow(row),
    year: new Date().getFullYear(),
    owner: "待研究核验",
    locationLevel: locationLevel(row.poi_level),
    lng: hasPoi ? lng : Number.NaN,
    lat: hasPoi ? lat : Number.NaN,
    locationConfidence: confidence(row.poi_confidence),
    locationReason: row.poi_method,
    coverageType: row.poi_level === "exact" ? "单点项目" : row.poi_level === "district" ? "区县级场景" : "城市级平台",
    status: "待复核",
    sourceType: "研究报告",
    evidenceLevel: evidenceLevel(row.source_level),
    summary: "当前仅建立项目身份、分类、来源线索与地图展示锚点，尚未完成 Digital X 深度案例研究。",
    painPoints: [],
    solution: splitTerms(row.solution_type),
    outcomes: [],
    aiTags: terms,
    expertView: "",
    sourceNote: "项目索引线索，待联网研究与人工核验。",
    sourceTitle: row.source_title,
    sourceUrl: row.source_url,
    projectStage: projectStage(row.project_stage),
    asset: {
      contentStatus: "indexed",
      caseId: row.case_id,
      casePath: "knowledge-base/index/digitalx_case_index_v1.json",
      imageCount: 0,
      sourceCount: row.source_url ? 1 : 0,
      poiStatus: hasPoi ? "pending" : "pending",
      lastVerifiedAt: "",
    },
  };
}

type CompactIndex = { schema: Array<keyof IndexedCaseRow>; rows?: unknown[][] };

function readRows(input: IndexedCaseRow[] | CompactIndex) {
  if (Array.isArray(input)) return input;
  const rows = input.rows ?? [part01, part02, part03, part04, part05, part06, part07, part08].flat();
  return rows.map((values) => Object.fromEntries(input.schema.map((key, index) => [key, values[index]])) as IndexedCaseRow);
}

export const indexedCases = readRows(rawCaseIndex as unknown as IndexedCaseRow[] | CompactIndex).map(toIndexedCase);
export const indexedCaseById = new Map(indexedCases.map((item) => [item.id, item]));
export const indexedCaseStats = {
  total: indexedCases.length,
  mappable: indexedCases.filter((item) => Number.isFinite(item.lng) && Number.isFinite(item.lat)).length,
  withoutPoi: indexedCases.filter((item) => !Number.isFinite(item.lng) || !Number.isFinite(item.lat)).length,
};
