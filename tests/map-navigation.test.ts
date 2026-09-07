import test from "node:test";
import assert from "node:assert/strict";
import {
  navigateCity,
  navigateNational,
  navigateProvince,
  sanitizeMapNavigation,
  selectCase,
} from "../lib/map-navigation";

const shenzhenCase = { id: "sz-001", province: "广东省", city: "深圳市" };

test("全国入口清空地域、案例和文档状态", () => {
  assert.deepEqual(navigateNational(), {
    level: "national",
    province: "全部",
    city: "全部",
    selectedCaseId: "",
    documentOpen: false,
  });
});

test("省域和城市入口形成互斥的空间层级", () => {
  assert.deepEqual(navigateProvince("广东省"), {
    level: "province",
    province: "广东省",
    city: "全部",
    selectedCaseId: "",
    documentOpen: false,
  });
  assert.equal(navigateCity("广东省", "深圳市").level, "city");
  assert.equal(navigateCity("广东省", "全部").level, "province");
});

test("左侧案例首次点击进入所属城市但不打开文档", () => {
  const selected = selectCase(navigateNational(), shenzhenCase, "directory");
  assert.equal(selected.level, "city");
  assert.equal(selected.province, "广东省");
  assert.equal(selected.city, "深圳市");
  assert.equal(selected.selectedCaseId, "sz-001");
  assert.equal(selected.documentOpen, false);
});

test("POI首次点击只选中，再次点击才打开案例", () => {
  const first = selectCase(navigateCity("广东省", "深圳市"), shenzhenCase, "poi");
  assert.equal(first.documentOpen, false);
  const second = selectCase(first, shenzhenCase, "poi");
  assert.equal(second.documentOpen, true);
});

test("不存在或被筛掉的案例不能留下幽灵选中态", () => {
  const selected = selectCase(navigateNational(), shenzhenCase, "directory");
  const sanitized = sanitizeMapNavigation(selected, []);
  assert.equal(sanitized.selectedCaseId, "");
  assert.equal(sanitized.documentOpen, false);
});
