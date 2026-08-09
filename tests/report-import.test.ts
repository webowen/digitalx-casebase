import assert from "node:assert/strict";
import test from "node:test";
import { createCaseFromImportedReport, createCaseFromReport } from "../lib/report-import";

test("imports a mature Markdown report as a review draft before confirmation", () => {
  const item = createCaseFromReport(`
# 大湾区文化体育中心智慧运营管理平台

## 项目概况
大湾区文化体育中心位于广州市南沙区，围绕智慧运营、场馆资产管理、赛事保障和数字化运维建设统一平台。

## 建设内容
平台融合 BIM、IoT、视频感知、能耗监测和运营工单，实现大型文体场馆的可视化、精细化和协同化管理。

## 应用成效
项目提升了场馆运行调度效率，并为粤港澳大湾区大型公共文体设施提供可复制的智慧运营样板。
`);

  assert.equal(item.status, "待复核");
  assert.equal(item.title, "大湾区文化体育中心智慧运营管理平台");
  assert.equal(item.province, "广东省");
  assert.equal(item.city, "广州市");
  assert.equal(item.district, "南沙区");
  assert.equal(item.locationLevel, "区县级");
  assert.equal(item.locationMethod, "source_exact");
  assert.ok(Math.abs(item.lng - 113.5252) < 0.001);
  assert.ok(Math.abs(item.lat - 22.8016) < 0.001);
  assert.equal(item.category, "文旅体育");
  assert.equal(item.sourceType, "研究报告");
  assert.ok(item.locationConfidence >= 0.9);
  assert.ok(item.aiTags.includes("智慧运营"));
  assert.ok(item.article);
  assert.ok(item.article.sections.length >= 2);
  assert.match(item.sourceNote, /未调用大模型/);
});

test("falls back to the province capital when a report only names a province", () => {
  const item = createCaseFromReport(`
# 湖北省BIM云平台智慧工地监管系统

## 案例概况
湖北省BIM云平台面向智慧工地监管场景，汇聚项目进度、质量安全和工程数据，支撑住建领域数字化监管。
`);

  assert.equal(item.province, "湖北省");
  assert.equal(item.city, "武汉市");
  assert.equal(item.locationLevel, "省级");
  assert.equal(item.locationMethod, "province_capital_default");
  assert.equal(item.category, "规划建设");
});

test("attaches imported report images as reviewed case media", () => {
  const item = createCaseFromImportedReport(`
# 大湾区文化体育中心智慧运营管理平台

## 项目概况
大湾区文化体育中心位于广州市南沙区，建设智慧运营管理平台。

![智慧运营管理平台三维场馆总览界面](media/image1.jpg)

## 应用成效
平台支撑大型场馆运营、安防、能耗和应急调度。
`, {
    importedFrom: "大湾区文化体育中心智慧运营管理平台案例报告.docx",
    media: [
      {
        id: "imported-image-1",
        url: "data:image/jpeg;base64,abc",
        sourceUrl: "word/media/image1.jpg",
        caption: "智慧运营管理平台三维场馆总览界面",
        alt: "智慧运营管理平台三维场馆总览界面",
        sectionId: "overview",
        kind: "platform_ui",
      },
    ],
  });

  assert.equal(item.media?.length, 1);
  assert.equal(item.media?.[0].included, true);
  assert.equal(item.media?.[0].reviewed, true);
  assert.equal(item.media?.[0].sectionId, "overview");
  assert.match(item.media?.[0].url || "", /^data:image\/jpeg;base64/);
  assert.match(item.sourceNote, /已提取 1 张图片/);
});

test("prefers the concrete project name over report cover metadata", () => {
  const item = createCaseFromReport(`
**DIGITAL X CASE REPORT / 智慧场馆**

**大湾区文化体育中心
智慧运营管理平台**

从大型场馆建设交付走向“建、管、服、赛”一体化运营

## 项目概况
大湾区文化体育中心位于广州市南沙区，平台支撑场馆智慧运营。
`);

  assert.equal(item.title, "大湾区文化体育中心智慧运营管理平台");
});
