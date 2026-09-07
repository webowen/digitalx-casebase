# Digital X 案例索引数据

`digitalx_case_index_v1.json` 是地图、目录、搜索和筛选的轻量项目级主索引；`knowledge-base/cases/` 保存 candidate / published 的完整案例资产。

生命周期使用同一个稳定 `case_id`：

`indexed → candidate → published`

- indexed 可进入地图与目录，只显示“项目索引 / 待研究”卡片；
- candidate 不进入公开地图；
- published 读取完整 `case.md`、图片和来源，并覆盖相同 `case_id` 的 indexed 记录；
- 经纬度仅作为地图展示锚点，必须保留 `poi_method` 与 `poi_confidence`，不得伪装为精确项目位置。

V1 实际统计：1186条索引，1162条有可用POI，24条无可用POI。

面向前端发布的主 JSON 使用 `schema + shards` 紧凑结构，分片只用于控制构建体积，读取层会自动合并并还原字段名；`case_id`、标题、行政区、领域和POI字段保持不变。

