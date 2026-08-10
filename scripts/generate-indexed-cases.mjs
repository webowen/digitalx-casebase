import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const indexPath = path.join(repoRoot, "knowledge-base", "index", "digitalx_case_index_v1.json");
const casesRoot = path.join(repoRoot, "knowledge-base", "cases");

if (!fs.existsSync(indexPath)) {
  console.error(`未找到索引文件：${indexPath}`);
  process.exit(1);
}

const cases = JSON.parse(fs.readFileSync(indexPath, "utf8"));
if (!Array.isArray(cases)) {
  console.error("索引文件必须是 JSON 数组。");
  process.exit(1);
}

function clean(value) {
  return String(value ?? "").trim();
}

function yamlString(value) {
  return JSON.stringify(clean(value));
}

function yamlList(value) {
  const items = clean(value)
    .split(/[；;]/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (items.length === 0) return "[]";
  return `[${items.map((item) => JSON.stringify(item)).join(", ")}]`;
}

function safeFolderName(item) {
  const title = clean(item.title)
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 90);
  const id = clean(item.case_id) || "DX-UNKNOWN";
  return `${id}-${title || "未命名项目"}`;
}

function numberOrBlank(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? String(parsed) : "";
}

function caseMarkdown(item) {
  const location = [item.province, item.city, item.district].map(clean).filter(Boolean).join(" · ");
  return `---
case_id: ${yamlString(item.case_id)}
title: ${yamlString(item.title)}
province: ${yamlString(item.province)}
city: ${yamlString(item.city)}
district: ${yamlString(item.district)}
domain: ${yamlList(item.domain)}
solution_type: ${yamlList(item.solution_type)}
technology: ${yamlList(item.technology)}
topic: ${yamlList(item.topic)}
project_stage: ${yamlString(item.project_stage)}
content_status: indexed
review_status: passed
source_level: ${yamlString(item.source_level)}
source: sources/source.md
poi:
  lng: ${numberOrBlank(item.lng)}
  lat: ${numberOrBlank(item.lat)}
  location_level: ${yamlString(item.poi_level)}
  method: ${yamlString(item.poi_method)}
  confidence: ${yamlString(item.poi_confidence)}
---

# ${clean(item.title)}

> **索引案例｜待研究**  
> 当前仅建立项目身份、分类、来源与地图展示锚点，尚未完成 Digital X 深度案例研究，不应视为正式精品案例。

## 项目索引

- **地区：** ${location || "待补充"}
- **业务领域：** ${clean(item.domain) || "待补充"}
- **项目形态：** ${clean(item.solution_type) || "待补充"}
- **技术：** ${clean(item.technology) || "待补充"}
- **专题：** ${clean(item.topic) || "待补充"}
- **项目阶段：** ${clean(item.project_stage) || "待确认"}

## 当前证据

当前索引仅保留一条基础来源线索，详见 \`sources/source.md\`。项目正式名称、建设范围、建设单位、投资金额、系统架构、业务闭环、实际成效和图片资产，均应在后续 AI 联网研究与人工复核中继续补充。

## 后续研究

当该项目进入正式案例生产流程后，应在**同一 case_id** 下逐步补全：

1. 项目正式名称与建设主体核验；
2. 背景与真实业务痛点；
3. 平台、系统、工程与数据架构；
4. 核心应用场景和业务闭环；
5. 实施、交付和运营机制；
6. 投资、成效、指标与证据边界；
7. 项目图片、来源矩阵和附件。

完成研究但尚未人工批准时，将 \`content_status\` 更新为 \`candidate\`；人工审核通过后再更新为 \`published\`。
`;
}

function sourceMarkdown(item) {
  return `# 来源线索

- **来源等级：** ${clean(item.source_level) || "待复核"}
- **来源标题：** ${clean(item.source_title) || "待补充"}
- **来源链接：** ${clean(item.source_url) || "待补充"}

> 当前仅作为项目索引的基础证据线索。后续生产正式案例时，应继续补充政府、招采、建设单位、实施单位、正式案例集等项目级直接来源，并核验项目名称与来源的一一对应关系。
`;
}

const stats = {
  total: cases.length,
  created: 0,
  skippedExisting: 0,
  failed: 0,
};

fs.mkdirSync(casesRoot, { recursive: true });

for (const item of cases) {
  try {
    const folder = path.join(casesRoot, safeFolderName(item));
    if (fs.existsSync(folder)) {
      stats.skippedExisting += 1;
      continue;
    }

    fs.mkdirSync(path.join(folder, "images"), { recursive: true });
    fs.mkdirSync(path.join(folder, "sources"), { recursive: true });
    fs.writeFileSync(path.join(folder, "case.md"), caseMarkdown(item), "utf8");
    fs.writeFileSync(
      path.join(folder, "images.md"),
      "# 图片资产\n\n当前为 indexed 索引案例，尚未完成图片研究与人工筛选。\n",
      "utf8",
    );
    fs.writeFileSync(path.join(folder, "sources", "source.md"), sourceMarkdown(item), "utf8");
    stats.created += 1;
  } catch (error) {
    stats.failed += 1;
    console.error(`生成失败：${item?.case_id ?? "unknown"} ${item?.title ?? ""}`, error);
  }
}

console.log(JSON.stringify(stats, null, 2));
if (stats.failed > 0) process.exitCode = 1;
