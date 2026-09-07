import test from "node:test";
import assert from "node:assert/strict";
import { administrativeFocusOwnsCamera, getCaseMarkerDetail, getMapPointStrategy, shouldEnterShenzhenCityMode, shouldExpandCityCaseLabels, splitCityMapPoints, type AMapCasePoint } from "../components/amap-case-map";

function point(overrides: Partial<AMapCasePoint>): AMapCasePoint {
  return {
    id: "case-1",
    title: "深圳国际会展中心智慧项目",
    province: "广东省",
    city: "深圳市",
    district: "宝安区",
    category: "规划建设",
    lng: 113.77,
    lat: 22.7,
    locationLevel: "园区/项目点",
    locationConfidence: 0.9,
    ...overrides,
  };
}

test("城市近景把真实项目保留为带名称的独立点", () => {
  const result = splitCityMapPoints([point({})]);
  assert.equal(result.precise.length, 1);
  assert.equal(result.precise[0].title, "深圳国际会展中心智慧项目");
  assert.equal(result.districts.length, 0);
});

test("同一区级低精度案例合并为一个紧凑区级聚合", () => {
  const result = splitCityMapPoints([
    point({ id: "case-1", locationLevel: "区县级", locationConfidence: 0.55 }),
    point({ id: "case-2", title: "宝安区建设监管平台", locationLevel: "区县级", locationConfidence: 0.5 }),
  ]);
  assert.equal(result.precise.length, 0);
  assert.equal(result.districts.length, 1);
  assert.equal(result.districts[0].district, "宝安区");
  assert.equal(result.districts[0].count, 2);
});

test("市级应用不会被伪装成具体项目名称标签", () => {
  const result = splitCityMapPoints([
    point({ locationLevel: "市级", district: "", title: "深圳市全域数字平台" }),
  ]);
  assert.equal(result.precise.length, 0);
  assert.equal(result.districts[0].district, "深圳全域");
});

test("全国视图手动放大进入深圳范围时切换深圳试点模式", () => {
  assert.equal(shouldEnterShenzhenCityMode(10, 114.0579, 22.5431), true);
  assert.equal(shouldEnterShenzhenCityMode(8, 114.0579, 22.5431), false);
  assert.equal(shouldEnterShenzhenCityMode(10, 113.2668, 23.1333), false);
});

test("深圳案例点随缩放从小气泡切换到水滴和名称标签", () => {
  assert.equal(getCaseMarkerDetail(4.5), "dot");
  assert.equal(getCaseMarkerDetail(8), "compact");
  assert.equal(getCaseMarkerDetail(10), "full");
});

test("深圳案例在 12 级切换为直接名称标签", () => {
  assert.equal(shouldExpandCityCaseLabels(11.99), false);
  assert.equal(shouldExpandCityCaseLabels(12), true);
  assert.equal(shouldExpandCityCaseLabels(16), true);
});

test("全国固定视角拥有镜头控制权，不被城市点位 fitView 覆盖", () => {
  assert.equal(administrativeFocusOwnsCamera({
    level: "national",
    center: [104.1954, 35.8617],
    zoom: 4.1,
  }), true);
  assert.equal(administrativeFocusOwnsCamera({ level: "national" }), false);
});

test("全国、省域和城市使用互不混淆的点位策略", () => {
  assert.equal(getMapPointStrategy("national"), "clustered-cities");
  assert.equal(getMapPointStrategy("province"), "independent-cities");
  assert.equal(getMapPointStrategy("city"), "clustered-cases");
});
