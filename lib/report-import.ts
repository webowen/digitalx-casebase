import type {
  CaseArticle,
  CaseArticleSection,
  CaseArticleSectionId,
  CaseCategory,
  CaseMediaKind,
  SmartCityCase,
} from "./case-model";
import { normalizeProjectTitle } from "./ai-case-native-protocol";
import { createSlug } from "./local-cases";

export type ImportedReportMedia = {
  id: string;
  url: string;
  sourceUrl: string;
  caption: string;
  alt: string;
  sectionId?: CaseArticleSectionId;
  kind?: CaseMediaKind;
};

type LocationCandidate = {
  province: string;
  city: string;
  district?: string;
  lng: number;
  lat: number;
  level: SmartCityCase["locationLevel"];
  method: SmartCityCase["locationMethod"];
  confidence: number;
  aliases: string[];
};

const DEFAULT_LOCATION: LocationCandidate = {
  province: "广东省",
  city: "深圳市",
  lng: 114.0579,
  lat: 22.5431,
  level: "市级",
  method: "city_center_inferred",
  confidence: 0.35,
  aliases: [],
};

const LOCATION_CANDIDATES: LocationCandidate[] = [
  { province: "广东省", city: "广州市", district: "南沙区", lng: 113.5252, lat: 22.8016, level: "区县级", method: "source_exact", confidence: 0.92, aliases: ["广州市南沙区", "广州南沙区", "南沙区", "南沙"] },
  { province: "北京市", city: "北京市", lng: 116.4074, lat: 39.9042, level: "市级", method: "city_center_inferred", confidence: 0.72, aliases: ["北京", "北京市"] },
  { province: "上海市", city: "上海市", lng: 121.4737, lat: 31.2304, level: "市级", method: "city_center_inferred", confidence: 0.72, aliases: ["上海", "上海市"] },
  { province: "广东省", city: "广州市", lng: 113.2644, lat: 23.1291, level: "市级", method: "city_center_inferred", confidence: 0.7, aliases: ["广州", "广州市", "南沙", "番禺", "大湾区", "粤港澳"] },
  { province: "广东省", city: "深圳市", lng: 114.0579, lat: 22.5431, level: "市级", method: "city_center_inferred", confidence: 0.72, aliases: ["深圳", "深圳市"] },
  { province: "湖北省", city: "武汉市", lng: 114.3055, lat: 30.5928, level: "省级", method: "province_capital_default", confidence: 0.58, aliases: ["湖北", "湖北省", "武汉", "武汉市"] },
  { province: "甘肃省", city: "兰州市", lng: 103.8343, lat: 36.0611, level: "省级", method: "province_capital_default", confidence: 0.58, aliases: ["甘肃", "甘肃省", "兰州", "兰州市"] },
  { province: "浙江省", city: "杭州市", lng: 120.1551, lat: 30.2741, level: "省级", method: "province_capital_default", confidence: 0.58, aliases: ["浙江", "浙江省", "杭州", "杭州市"] },
  { province: "四川省", city: "成都市", lng: 104.0665, lat: 30.5728, level: "省级", method: "province_capital_default", confidence: 0.58, aliases: ["四川", "四川省", "成都", "成都市"] },
  { province: "重庆市", city: "重庆市", lng: 106.5516, lat: 29.563, level: "市级", method: "city_center_inferred", confidence: 0.7, aliases: ["重庆", "重庆市"] },
  { province: "山东省", city: "济南市", lng: 117.1201, lat: 36.6512, level: "省级", method: "province_capital_default", confidence: 0.58, aliases: ["山东", "山东省", "济南", "济南市"] },
  { province: "江苏省", city: "南京市", lng: 118.7969, lat: 32.0603, level: "省级", method: "province_capital_default", confidence: 0.58, aliases: ["江苏", "江苏省", "南京", "南京市"] },
  { province: "陕西省", city: "西安市", lng: 108.9398, lat: 34.3416, level: "省级", method: "province_capital_default", confidence: 0.58, aliases: ["陕西", "陕西省", "西安", "西安市"] },
  { province: "湖南省", city: "长沙市", lng: 112.9388, lat: 28.2282, level: "省级", method: "province_capital_default", confidence: 0.58, aliases: ["湖南", "湖南省", "长沙", "长沙市"] },
];

const CATEGORY_RULES: Array<{ category: CaseCategory; keywords: string[] }> = [
  { category: "文旅体育", keywords: ["场馆", "体育", "赛事", "景区", "旅游", "文旅", "博物馆", "文化中心"] },
  { category: "公共民生", keywords: ["医疗", "医院", "教育", "学校", "养老", "就业", "民政", "住房保障"] },
  { category: "农业农村", keywords: ["农业", "农村", "乡村", "养殖", "农产品"] },
  { category: "市政韧性", keywords: ["水务", "排水", "防涝", "管网", "燃气", "桥梁", "井盖", "生命线", "防灾", "应急指挥"] },
  { category: "交通出行", keywords: ["低空", "无人机", "EVTOL", "空域", "交通", "停车", "公交", "轨道", "道路", "车路协同", "机场", "港口"] },
  { category: "生态低碳", keywords: ["环保", "生态", "污染", "碳管理", "双碳", "自然资源监测"] },
  { category: "工业园区", keywords: ["工业", "制造", "产业园", "工业园", "工业互联网", "工业上楼", "企业服务"] },
  { category: "商贸物流", keywords: ["商贸", "物流", "供应链", "跨境贸易", "金融服务"] },
  { category: "数字政府", keywords: ["政务", "审批", "营商", "一网通办", "政府决策"] },
  { category: "数据要素", keywords: ["数据要素", "授权运营", "可信数据空间", "数据交易", "算力", "数据基础设施"] },
  { category: "规划建设", keywords: ["城市更新", "工程建设", "项目群", "规划管控", "国土空间", "CIM", "BIM", "数字化交付", "实景三维"] },
  { category: "城市治理", keywords: ["城市运行", "一网统管", "城市大脑", "基层治理", "社区治理", "网格管理", "城市管理"] },
];

const TAG_KEYWORDS = [
  "CIM",
  "BIM",
  "GIS",
  "数字孪生",
  "智慧运营",
  "智慧场馆",
  "智慧工地",
  "低空经济",
  "城市大脑",
  "一网统管",
  "数据要素",
  "AI",
  "物联网",
  "视频感知",
  "大模型",
  "韧性城市",
];

function normalizeText(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function cleanLine(value: string) {
  return value
    .replace(/^#{1,6}\s*/, "")
    .replace(/^[\s>*-]+/, "")
    .replace(/\*\*/g, "")
    .trim();
}

function compactParagraph(value: string) {
  return cleanLine(value)
    .replace(/<img\b[^>]*>/gi, "")
    .replace(/!\[[^\]]*]\([^)]+\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTitle(text: string) {
  const labelMatch = text.match(/(?:案例名称|项目名称|平台名称|工程名称)\s*[：:]\s*([^\n]+)/);
  if (labelMatch?.[1]) return normalizeProjectTitle(cleanLine(labelMatch[1]));

  const lines = text
    .split("\n")
    .map(cleanLine)
    .filter(Boolean)
    .filter((line) => !/^(DIGITAL X|CASE REPORT|EXECUTIVE SUMMARY|案例摘要|案例研究版|编制日期)/i.test(line));

  const heading = text.match(/^#\s+(.+)$/m)?.[1]?.trim();
  if (
    heading &&
    !/^DIGITAL X/i.test(heading) &&
    !/^[一二三四五六七八九十0-9]+[、.．：:]\s*/.test(cleanLine(heading))
  ) return normalizeProjectTitle(cleanLine(heading));

  const topLines = lines.slice(0, 10);
  const combinedCandidates = topLines.flatMap((line, index) => {
    const next = topLines[index + 1] || "";
    const joined = `${line}${next}`.trim();
    return joined.length <= 52 && /平台|系统|项目|工程|中心|应用/.test(joined)
      ? [joined]
      : [];
  });
  const specificCandidate = [...combinedCandidates, ...topLines].find(
    (line) =>
      line.length >= 8 &&
      line.length <= 52 &&
      /平台|系统|项目|工程|中心|应用/.test(line) &&
      !/报告|摘要|来源|证据等级/.test(line) &&
      !/^[一二三四五六七八九十0-9]+[、.．：:]\s*/.test(line),
  );
  if (specificCandidate) return normalizeProjectTitle(specificCandidate);

  return (
    normalizeProjectTitle(lines.find((line) => line.length >= 6 && line.length <= 48 && !/[。；;]$/.test(line))) ||
    "未命名智慧城市案例"
  );
}

function extractYear(text: string) {
  const match = text.match(/20\d{2}/);
  return match ? Number(match[0]) : new Date().getFullYear();
}

function extractOwner(text: string, label: string) {
  const match = text.match(new RegExp(`${label}\\s*[：:]\\s*([^\\n]{2,80})`));
  return match?.[1]?.trim() ?? "";
}

function inferLocation(text: string) {
  const matched = LOCATION_CANDIDATES.find((candidate) =>
    candidate.aliases.some((alias) => text.includes(alias)),
  );
  if (!matched) return DEFAULT_LOCATION;

  if (matched.district) return matched;

  const cityMatched = matched.aliases.some((alias) => alias.endsWith("市") && text.includes(alias));
  return {
    ...matched,
    level: cityMatched ? "市级" : matched.level,
    method: cityMatched ? "city_center_inferred" : matched.method,
    confidence: cityMatched ? Math.max(matched.confidence, 0.68) : matched.confidence,
  } satisfies LocationCandidate;
}

function inferCategory(text: string): CaseCategory {
  const upperText = text.toUpperCase();
  return (
    CATEGORY_RULES.find((rule) =>
      rule.keywords.some((keyword) => upperText.includes(keyword.toUpperCase())),
    )?.category ?? "城市治理"
  );
}

function inferTags(text: string, category: CaseCategory) {
  const upperText = text.toUpperCase();
  const tags = TAG_KEYWORDS.filter((keyword) => upperText.includes(keyword.toUpperCase()));
  return Array.from(new Set([category, ...tags])).slice(0, 8);
}

function summarize(text: string, title: string) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map(compactParagraph)
    .map((item) => item.replace(/^(?:#{1,6}\s*)?(?:[一二三四五六七八九十0-9]+[、.．]\s*)?[^。！？!?]{2,24}\n?/, "").trim())
    .filter((item) => item.length > 20 && item !== title && !item.startsWith(title));
  const first = paragraphs[0] ?? `${title}案例内容已完成导入，项目概况以原始报告为准。`;
  return first.length > 180 ? `${first.slice(0, 180)}...` : first;
}

function sectionIdForTitle(title: string): CaseArticleSectionId {
  if (/背景|痛点|问题|为什么/.test(title)) return "background";
  if (/目标|任务|原则/.test(title)) return "objectives";
  if (/架构|建设|方案|技术|如何/.test(title)) return "architecture";
  if (/功能|场景|能力|模块|应用/.test(title)) return "capabilities";
  if (/实施|运营|机制|组织|保障/.test(title)) return "delivery";
  if (/投资|资金|预算|成本/.test(title)) return "investment";
  if (/成效|价值|成果|效益/.test(title)) return "outcomes";
  if (/边界|问题|不足|风险|挑战/.test(title)) return "boundaries";
  if (/经验|启示|推广|复制/.test(title)) return "lessons";
  if (/时间|历程|节点|进度/.test(title)) return "timeline";
  return "overview";
}

function inferMediaKind(value: string): CaseMediaKind {
  if (/驾驶舱|大屏|态势|看板|总览|监测/.test(value)) return "dashboard";
  if (/界面|平台|系统|页面/.test(value)) return "platform_ui";
  if (/架构|流程|体系|方案/.test(value)) return "architecture";
  if (/地图|空间|区位|位置/.test(value)) return "map";
  if (/场馆|建筑|现场|照片|实景|空间/.test(value)) return "site_photo";
  return "other";
}

function buildMediaAssets(media: ImportedReportMedia[] | undefined, sections: CaseArticleSection[]) {
  const fallbackSectionIds = sections.length > 0 ? sections.map((section) => section.id) : ["overview" as const];
  return (media || []).map((asset, index) => {
    const caption = asset.caption.trim() || asset.alt.trim() || `导入报告图片 ${index + 1}`;
    const sectionId = asset.sectionId || fallbackSectionIds[Math.min(index, fallbackSectionIds.length - 1)];
    return {
      id: asset.id || `imported-media-${index + 1}`,
      candidateId: asset.id || `imported-media-${index + 1}`,
      kind: asset.kind || inferMediaKind(`${caption} ${asset.sourceUrl}`),
      sectionId,
      caption,
      alt: asset.alt.trim() || caption,
      confidence: 0.82,
      needsReview: false,
      reason: "由导入的 Word/Markdown 图片包自动提取，并按章节顺序挂载。",
      url: asset.url,
      sourceKind: "web_image" as const,
      sourceUrl: asset.sourceUrl,
      pageNumber: index + 1,
      included: true,
      reviewed: true,
    };
  });
}

function articleFromReport(text: string, title: string, summary: string): CaseArticle {
  const blocks = text.split(/\n(?=#{1,3}\s+)/).map((item) => item.trim()).filter(Boolean);
  const sections: CaseArticleSection[] = blocks
    .flatMap((block) => {
      const lines = block.split("\n");
      const rawTitle = cleanLine(lines[0]?.trim() ?? "");
      if (!rawTitle || rawTitle === title) return [];
      const body = lines.slice(1).join("\n").trim();
      const paragraphs = body
        .split(/\n{2,}/)
        .map((item) => /^\s*\|.+\|\s*$/m.test(item) ? item.trim() : compactParagraph(item))
        .filter((item) => item.length > 8);
      if (paragraphs.length === 0) return [];
      const points = paragraphs.filter((item) => /^[0-9]+[.、]|^[（(][一二三四五六七八九十][）)]/.test(item)).slice(0, 6);
      const section: CaseArticleSection = {
        id: sectionIdForTitle(rawTitle),
        title: rawTitle,
        summary: paragraphs[0].slice(0, 120),
        paragraphs,
        points,
        evidenceRefs: [],
      };
      return [section];
    });

  const fallbackParagraphs = text
    .split(/\n{2,}/)
    .map(compactParagraph)
    .filter((item) => item.length > 20 && item !== title);

  const normalizedSections = sections.length > 0
    ? sections
    : [{
        id: "overview" as const,
        title: "案例概况",
        summary,
        paragraphs: fallbackParagraphs.length > 0 ? fallbackParagraphs : [summary],
        points: [],
        evidenceRefs: [],
      }];

  return {
    standfirst: summary,
    keyFindings: [],
    sections: normalizedSections.slice(0, 11),
  };
}

function listFromKeywords(text: string, fallbacks: string[]) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map(compactParagraph)
    .filter((item) => item.length > 16);
  return (paragraphs.length > 0 ? paragraphs : fallbacks).slice(0, 3);
}

export function createCaseFromReport(rawText: string): SmartCityCase {
  const text = normalizeText(rawText);
  const title = extractTitle(text);
  const location = inferLocation(text);
  const category = inferCategory(text);
  const tags = inferTags(text, category);
  const summary = summarize(text, title);
  const owner =
    extractOwner(text, "建设单位") ||
    extractOwner(text, "牵头单位") ||
    extractOwner(text, "业主单位") ||
    extractOwner(text, "建设主体") ||
    "待补充";
  const implementationUnit =
    extractOwner(text, "实施单位") ||
    extractOwner(text, "承建单位") ||
    extractOwner(text, "技术单位");
  const operationUnit = extractOwner(text, "运营单位") || extractOwner(text, "运维单位");
  const importedAt = new Date().toISOString();

  const article = articleFromReport(text, title, summary);
  const mediaAssets = buildMediaAssets(undefined, article.sections);

  return {
    id: `imported-report-${Date.now().toString(36)}`,
    slug: createSlug(title),
    title,
    city: location.city,
    province: location.province,
    district: location.district,
    category,
    year: extractYear(text),
    owner,
    locationLevel: location.level,
    lng: location.lng,
    lat: location.lat,
    locationConfidence: location.confidence,
    locationMethod: location.method,
    locationReason:
      location.confidence < 0.5
        ? "报告未识别明确省市，暂用默认城市中心点作为待复核锚点。"
        : location.district
          ? `${location.province}${location.city}${location.district}由报告中的完整行政区名称识别，坐标采用区级中心锚点。`
          : `${location.province}${location.city}由导入报告文本中的地名规则推断，坐标采用城市中心或省会锚点。`,
    coverageType: location.level === "省级" ? "省域统筹" : location.level === "区县级" ? "区县级场景" : "城市级平台",
    status: "待复核",
    sourceType: "研究报告",
    evidenceLevel: "中",
    summary,
    painPoints: listFromKeywords(text, ["成熟报告已导入，待进一步抽取业务痛点。"]),
    solution: listFromKeywords(text, ["成熟报告已导入，待进一步抽取建设方案。"]),
    outcomes: listFromKeywords(text, ["成熟报告已导入，待进一步抽取应用成效。"]),
    aiTags: tags,
    expertView: "该案例由已完成报告导入，系统完成基础字段识别、分类、标签和地图点位生成；正文保留原成熟文章结构，适合先入库再逐步校核。",
    sourceNote: "由成熟报告本地导入，未调用大模型或联网搜索接口；基础字段、分类与坐标为规则识别结果。",
    sourceTitle: title,
    sourceExcerpt: text.slice(0, 420),
    projectStage: "验收运营",
    implementationUnit,
    operationUnit,
    researchReport: text,
    identity: {
      canonicalTitle: title,
      candidates: [title],
      aliases: [],
      confidence: 0.72,
      needsReview: false,
      reason: "采用导入报告标题或项目名称字段作为项目规范名称。",
      evidence: [{ title, url: "", quote: text.slice(0, 120) }],
    },
    article,
    media: mediaAssets,
    importedAt,
    updatedAt: importedAt,
  };
}

export function createCaseFromImportedReport(
  rawText: string,
  options: {
    media?: ImportedReportMedia[];
    importedFrom?: string;
  } = {},
): SmartCityCase {
  const item = createCaseFromReport(rawText);
  const mediaAssets = buildMediaAssets(options.media, item.article?.sections || []);
  return {
    ...item,
    media: mediaAssets,
    sourceNote: mediaAssets.length > 0
      ? `由${options.importedFrom || "成熟报告文件"}本地导入，已提取 ${mediaAssets.length} 张图片；未调用大模型或联网搜索接口。`
      : item.sourceNote,
    expertView: mediaAssets.length > 0
      ? `${item.expertView} 本次导入同时保留了报告图片，图片已按章节顺序嵌入案例详情。`
      : item.expertView,
  };
}
