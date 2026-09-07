import assert from "node:assert/strict";
import test from "node:test";
import { categories, normalizeCaseCategory } from "../lib/case-model";
import { createCaseFromReport } from "../lib/report-import";

test("一级目录固定为12个业务领域", () => {
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

test("旧分类读取时迁移到新体系", () => {
  assert.equal(normalizeCaseCategory("政务服务"), "数字政府");
  assert.equal(normalizeCaseCategory("CIM / 数字孪生"), "规划建设");
  assert.equal(normalizeCaseCategory("应急治理"), "市政韧性");
  assert.equal(normalizeCaseCategory("智慧交通"), "交通出行");
});

test("本地报告按业务问题分类，技术词不会覆盖场馆业务", () => {
  const item = createCaseFromReport(
    "# 大湾区文化体育中心智慧运营管理平台\n\n该项目面向大型体育场馆运营，采用BIM、数字孪生和物联网支撑赛事保障、设备运维与商业运营。",
  );
  assert.equal(item.category, "文旅体育");
  assert.equal(item.title, "大湾区文化体育中心智慧运营管理平台");
  assert.ok(item.aiTags?.includes("BIM"));
  assert.ok(item.aiTags?.includes("数字孪生"));
});
