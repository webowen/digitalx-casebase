import assert from "node:assert/strict";
import test from "node:test";
import {
  categories,
  normalizeCaseCategory,
} from "../lib/case-model";

test("一级分类固定为12个业务领域", () => {
  assert.deepEqual(categories, [
    "数字政府",
    "规划建设",
    "城市治理",
    "市政韧性",
    "交通出行",
    "生态低碳",
    "工业园区",
    "农业农村",
    "文旅体育",
    "公共民生",
    "商贸物流",
    "数据要素",
  ]);
});

test("旧分类在读取时自动归并到新体系", () => {
  assert.equal(normalizeCaseCategory("政务服务"), "数字政府");
  assert.equal(normalizeCaseCategory("CIM / 数字孪生"), "规划建设");
  assert.equal(normalizeCaseCategory("应急治理"), "市政韧性");
  assert.equal(normalizeCaseCategory("智慧交通"), "交通出行");
  assert.equal(normalizeCaseCategory("生态环保"), "生态低碳");
  assert.equal(normalizeCaseCategory("产业园区"), "工业园区");
});

test("新分类保持不变，未知值安全回退", () => {
  assert.equal(normalizeCaseCategory("文旅体育"), "文旅体育");
  assert.equal(normalizeCaseCategory("数据要素"), "数据要素");
  assert.equal(normalizeCaseCategory("数字孪生"), "城市治理");
  assert.equal(normalizeCaseCategory(undefined), "城市治理");
});
