import test from "node:test";
import assert from "node:assert/strict";
import { cityStats } from "../lib/case-analytics";
import type { SmartCityCase } from "../lib/case-model";

function cityCase(id: string, lng: number, lat: number): SmartCityCase {
  return {
    id,
    slug: id,
    title: id,
    province: "广东省",
    city: "深圳市",
    district: "",
    lng,
    lat,
    locationLevel: "园区/项目点",
    locationConfidence: 1,
    category: "城市治理",
    subcategory: "",
    tags: [],
    year: 2026,
    status: "已发布",
    evidenceLevel: "强",
    description: "",
    highlights: [],
    metrics: [],
    painPoints: [],
    solutions: [],
    architecture: [],
    modules: [],
    outcomes: [],
    replicability: "",
    sourceName: "",
    sourceUrl: "",
    sourceType: "研究报告",
    sourceDate: "",
    updatedAt: "",
  } as unknown as SmartCityCase;
}

test("城市气泡坐标使用全部案例的算术平均且不受输入顺序影响", () => {
  const cases = [
    cityCase("a", 113, 22),
    cityCase("b", 114, 23),
    cityCase("c", 116, 25),
  ];
  const forward = cityStats(cases)[0];
  const reverse = cityStats([...cases].reverse())[0];
  assert.equal(forward.count, 3);
  assert.equal(forward.lng, 343 / 3);
  assert.equal(forward.lat, 70 / 3);
  assert.deepEqual(forward, reverse);
});
