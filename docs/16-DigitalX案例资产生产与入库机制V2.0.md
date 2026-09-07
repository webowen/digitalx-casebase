# DigitalX 案例资产生产与入库机制 V2.0

## 产品定位

DigitalX 不再以“AI 自动写完并发布案例”为核心，而是由真实案例资产库、地图化检索与阅读、Digital X AI 研究助手组成。AI 负责研究和辅助核验，`knowledge-base/cases/` 是可追溯的案例事实来源。

## 标准流程

```text
项目名称 / URL / PDF
→ AI 联网研究
→ 核验正式名称、来源、图片与 POI
→ 生成 candidate 案例资产
→ 人工检查
→ content_status: published
→ 构建时生成公开案例
→ 地图 POI 与案例详情
```

候选案例不得自动发布。AI 联网失败、正式名称未确认、POI 未确认或关键来源不足时，资产必须保持 `candidate`。

## 资产目录

```text
knowledge-base/cases/<slug>/
├── case.md
├── images.md
├── images/
└── sources/source.md
```

- `case.md`：Frontmatter 和正式正文；
- `images.md`：图片清单、图注、来源、授权和建议位置；
- `images/`：允许随案例发布的图片文件；
- `sources/source.md`：政府文件、招投标、建设单位资料、论文等来源索引。

## Frontmatter 最小字段

```yaml
id: stable-case-id
slug: stable-case-slug
title: 公开正式名称
province: 省级行政区
city: 城市
category: 规划建设
year: 2024
longitude: 114.1316
latitude: 22.5485
content_status: candidate
poi_status: pending
last_verified_at: 2026-08-09
```

`scripts/generate-case-assets.mjs` 在开发和构建前读取 Frontmatter，生成类型化案例集合。只有 `content_status: published` 的资产进入公开地图。发布/取消发布的唯一事实来源是 Git 中的 Frontmatter，避免部署环境出现无法追溯的假写入。

## 前台与 AI 上下文

Digital X AI 支持当前案例、当前地图结果、全部公开案例三种作用域。本轮先建立上下文选择和交互结构，不宣称已经完成复杂 RAG。后续检索只能读取已发布案例及其来源，并区分已核验事实、来源方声明、AI 推断和待核验事项。

## 失败与回退

- Frontmatter 缺失或格式错误：构建失败并指出具体 `case.md`；
- `candidate`：只在资产工作台中检查，不进入公开地图；
- POI 待确认：不得伪造北京、深圳等默认坐标；
- 图片或来源为空：允许保留候选状态，但必须明确显示数量；
- 旧 `/admin`：保留代码并封存到 `/lab/ai-case-studio`，不作为公开案例管理入口。
