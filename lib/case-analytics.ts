import type { CaseCategory, SmartCityCase } from "./case-model";

export function cityStats(cases: SmartCityCase[], category?: CaseCategory | "全部") {
  const filtered = category && category !== "全部" ? cases.filter((item) => item.category === category) : cases;
  const byCity = new Map<string, { city: string; province: string; count: number; sumLng: number; sumLat: number }>();

  for (const item of filtered) {
    const key = `${item.province}:${item.city}`;
    const current = byCity.get(key);
    if (current) {
      current.count += 1;
      current.sumLng += item.lng;
      current.sumLat += item.lat;
    } else {
      byCity.set(key, {
        city: item.city,
        province: item.province,
        count: 1,
        sumLng: item.lng,
        sumLat: item.lat,
      });
    }
  }

  return Array.from(byCity.values())
    .map(({ sumLng, sumLat, ...item }) => ({
      ...item,
      lng: sumLng / item.count,
      lat: sumLat / item.count,
    }))
    .sort((a, b) => b.count - a.count);
}

export function projectHealth(cases: SmartCityCase[]) {
  const published = cases.filter((item) => item.status === "已发布").length;
  const review = cases.filter((item) => item.status === "待复核").length;
  const draft = cases.filter((item) => item.status === "草稿").length;
  const strongEvidence = cases.filter((item) => item.evidenceLevel === "强").length;
  const mediumEvidence = cases.filter((item) => item.evidenceLevel === "中").length;

  return {
    total: cases.length,
    published,
    review,
    draft,
    evidenceReady: strongEvidence + mediumEvidence,
  };
}

export function categoryStats(cases: SmartCityCase[]) {
  const stats = new Map<string, number>();
  for (const item of cases) {
    stats.set(item.category, (stats.get(item.category) ?? 0) + 1);
  }
  return Array.from(stats.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
}
