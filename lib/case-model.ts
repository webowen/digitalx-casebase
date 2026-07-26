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
