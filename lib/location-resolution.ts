import type { CaseParserOutput } from "./ai-case-parser";

type CapitalAnchor = {
  city: string;
  lng: number;
  lat: number;
};

const capitalAnchors: Record<string, CapitalAnchor> = {
  北京市: { city: "北京市", lng: 116.4074, lat: 39.9042 },
  天津市: { city: "天津市", lng: 117.2009, lat: 39.0842 },
  上海市: { city: "上海市", lng: 121.4737, lat: 31.2304 },
  重庆市: { city: "重庆市", lng: 106.5516, lat: 29.563 },
  河北省: { city: "石家庄市", lng: 114.5149, lat: 38.0428 },
  山西省: { city: "太原市", lng: 112.5489, lat: 37.8706 },
  辽宁省: { city: "沈阳市", lng: 123.4315, lat: 41.8057 },
  吉林省: { city: "长春市", lng: 125.3235, lat: 43.8171 },
  黑龙江省: { city: "哈尔滨市", lng: 126.5349, lat: 45.8038 },
  江苏省: { city: "南京市", lng: 118.7969, lat: 32.0603 },
  浙江省: { city: "杭州市", lng: 120.1551, lat: 30.2741 },
  安徽省: { city: "合肥市", lng: 117.2272, lat: 31.8206 },
  福建省: { city: "福州市", lng: 119.2965, lat: 26.0745 },
  江西省: { city: "南昌市", lng: 115.8582, lat: 28.6829 },
  山东省: { city: "济南市", lng: 117.1201, lat: 36.6512 },
  河南省: { city: "郑州市", lng: 113.6254, lat: 34.7466 },
  湖北省: { city: "武汉市", lng: 114.3054, lat: 30.5931 },
  湖南省: { city: "长沙市", lng: 112.9388, lat: 28.2282 },
  广东省: { city: "广州市", lng: 113.2644, lat: 23.1291 },
  海南省: { city: "海口市", lng: 110.1983, lat: 20.044 },
  四川省: { city: "成都市", lng: 104.0665, lat: 30.5728 },
  贵州省: { city: "贵阳市", lng: 106.6302, lat: 26.647 },
  云南省: { city: "昆明市", lng: 102.8329, lat: 24.8801 },
  陕西省: { city: "西安市", lng: 108.9398, lat: 34.3416 },
  甘肃省: { city: "兰州市", lng: 103.8343, lat: 36.0611 },
  青海省: { city: "西宁市", lng: 101.7782, lat: 36.6171 },
  台湾省: { city: "台北市", lng: 121.5654, lat: 25.033 },
  内蒙古自治区: { city: "呼和浩特市", lng: 111.7492, lat: 40.8426 },
  广西壮族自治区: { city: "南宁市", lng: 108.3669, lat: 22.817 },
  西藏自治区: { city: "拉萨市", lng: 91.1409, lat: 29.6456 },
  宁夏回族自治区: { city: "银川市", lng: 106.2309, lat: 38.4872 },
  新疆维吾尔自治区: { city: "乌鲁木齐市", lng: 87.6168, lat: 43.8256 },
  香港特别行政区: { city: "香港特别行政区", lng: 114.1694, lat: 22.3193 },
  澳门特别行政区: { city: "澳门特别行政区", lng: 113.5439, lat: 22.1987 },
};

function normalizedProvince(value: string) {
  const trimmed = value.trim();
  if (capitalAnchors[trimmed]) return trimmed;
  return Object.keys(capitalAnchors).find((name) => name.startsWith(trimmed) || trimmed.startsWith(name)) || trimmed;
}

export function applyLocationFallback(result: CaseParserOutput): CaseParserOutput {
  const province = normalizedProvince(result.case.province);
  const anchor = capitalAnchors[province];
  const useCapital =
    Boolean(anchor) &&
    (!result.case.city.trim() ||
      result.case.locationMethod === "province_capital_default");

  if (!useCapital || !anchor) return result;

  const note = `资料只明确到${province}或项目属于省级范围；系统采用省会${anchor.city}作为地图展示锚点，不代表项目实际落地点。`;
  const assessments = result.fieldAssessments.map((item) =>
    item.field === "location"
      ? {
          ...item,
          confidence: Math.min(item.confidence || 0.5, 0.55),
          evidence: item.evidence || `原始资料明确提及${province}`,
          needsReview: true,
          reason: note,
        }
      : item,
  );

  return {
    ...result,
    case: {
      ...result.case,
      province,
      city: anchor.city,
      lng: anchor.lng,
      lat: anchor.lat,
      locationConfidence: Math.min(result.case.locationConfidence || 0.5, 0.55),
      locationMethod: "province_capital_default",
      locationReason: note,
    },
    fieldAssessments: assessments,
    reviewItems: Array.from(new Set([...result.reviewItems, `请确认${anchor.city}是否仅作为省级项目的地图展示锚点。`])),
  };
}
