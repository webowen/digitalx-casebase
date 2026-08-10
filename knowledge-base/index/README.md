# Digital X 案例索引数据

本目录用于保存 Digital X 的**项目级索引母数据**。它和 `knowledge-base/cases/` 中的完整案例资产分工不同：

- `knowledge-base/index/`：轻量项目索引，服务地图 POI、目录、搜索、筛选和后续 AI 研究入口；
- `knowledge-base/cases/`：案例内容资产，包含 `case.md`、`images.md`、`images/`、`sources/source.md`。

## V1 索引文件

预期文件：

`digitalx_case_index_v1.json`

V1 当前正式母表包含 1186 条经过初步治理的项目索引。建议保持字段至少包括：

- `case_id`
- `title`
- `province`
- `city`
- `district`
- `domain`
- `solution_type`
- `technology`
- `topic`
- `project_stage`
- `lng`
- `lat`
- `poi_level`
- `poi_method`
- `poi_confidence`
- `source_level`
- `source_title`
- `source_url`

## 状态规则

案例生命周期：

`indexed → candidate → published`

- `indexed`：已发现并建立项目索引，可以进入地图与目录，但没有完整案例正文；
- `candidate`：已完成 AI/人工研究形成候选案例资产，尚未最终审核；
- `published`：人工审核通过，可以作为正式精品案例公开展示。

因此，批量导入的 1186 条项目应该优先标记为 `indexed`，不要把只有项目名称和基础来源的索引数据误标成完整候选案例。

## 批量生成 case.md

将 `digitalx_case_index_v1.json` 放入本目录后，在仓库根目录执行：

```bash
node scripts/generate-indexed-cases.mjs
```

脚本会在 `knowledge-base/cases/` 下为新项目创建最小案例资产：

```text
<case_id>-<项目名称>/
├── case.md
├── images.md
├── images/
└── sources/
    └── source.md
```

脚本不会覆盖已经存在的目录，避免破坏现有精品案例。

## POI 使用原则

V1 经纬度主要用于地图**展示锚点**，不应默认解释为项目精确建设位置。

- `exact`：原索引认为存在实体项目位置，但如果 `poi_method` 明确写的是城市展示锚点，前端仍应按低置信度展示；
- `district`：区县级项目；
- `city`：市级平台或只能确认到城市；
- `none`：不适合形成地图 POI。

前端应该保留 `poi_method` 和 `poi_confidence`，不要把展示锚点伪装成已核验精确坐标。

## 前端接入建议

地图和目录优先读取索引 JSON，而不是在客户端扫描 1000+ 个 Markdown 文件：

```text
knowledge-base/index/digitalx_case_index_v1.json
        ↓
索引读取/构建层
        ↓
地图 POI / 目录 / 搜索 / 筛选
        ↓
点击具体项目
        ↓
按 case_id 读取 knowledge-base/cases/ 对应案例资产
```

这样后续补采新项目时只需更新索引母数据；某个项目升级为精品案例时，再补强同一 `case_id` 下的案例内容即可。
