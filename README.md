# DigitalX 城市数智应用案例库

DigitalX 是一套面向智慧城市从业者的案例采集、整理、检索、阅读与研判工具。当前仓库在 **V1.0 高保真可交互原型** 基础上增加了真实 AI 案例解析 Alpha：管理端可将粘贴正文或 PDF 交给 Gemini / OpenAI 生成结构化草稿，也可显式开启 Google Search 联网研究，补充长篇案例研究和可核验来源。正式数据库、账号权限和云端文件存储尚未接入。

当前线上演示：<https://digitalx-casebase.bowenw563.chatgpt.site>

## 先看这里

- 产品和页面说明：[docs/01-产品说明.md](docs/01-产品说明.md)
- V1 真实能力与 Demo 边界：[docs/02-V1功能边界.md](docs/02-V1功能边界.md)
- 系统架构与数据流：[docs/03-系统架构与数据流.md](docs/03-系统架构与数据流.md)
- 设计规范：[docs/04-设计规范.md](docs/04-设计规范.md)
- 开发交接说明：[docs/05-开发交接说明.md](docs/05-开发交接说明.md)
- V2 路线图：[docs/06-V2开发清单.md](docs/06-V2开发清单.md)
- Git、VS Code 与 ChatGPT 协作：[docs/07-Git版本管理与ChatGPT协作.md](docs/07-Git版本管理与ChatGPT协作.md)
- 本次迁移验收记录：[docs/08-迁移验收记录.md](docs/08-迁移验收记录.md)
- AI/Codex 开发规则：[AGENTS.md](AGENTS.md)

## 页面路由

| 路由 | 作用 |
|---|---|
| `/` | 公开案例首页、搜索筛选、地图与案例列表 |
| `/cases/[slug]` | 案例阅读器及研读档案 |
| `/admin` | 案例导入、真实 AI 解析、联网研究、位置补全、人工复核与发布工作台 |
| `/api/ai/parse-case` | 服务端按配置调用 Gemini 或 OpenAI，返回严格结构化的案例草稿 |
| `/api/amap/config` | 向前端返回高德地图 JS Key 与代理地址 |
| `/api/amap/[...path]` | 高德安全密钥服务代理 |

## 技术栈

- Next.js 16、React 19、TypeScript
- Vinext / Vite / Cloudflare Worker 运行时
- Tailwind CSS 4 与全局 CSS 设计系统
- 高德地图 JS API 2.0
- Drizzle ORM 与 D1 预留（V1 未启用数据库）
- Node.js 原生测试

## 本地启动

### 环境要求

- Node.js `>=22.13.0`
- npm（随 Node.js 安装）
- VS Code
- Git

Windows 用户建议安装 Git for Windows，并在 VS Code 中使用 PowerShell 或 Git Bash。日常启动命令已兼容 Windows。

### 操作步骤

```bash
npm ci
```

复制环境变量示例并填写自己的高德地图与 AI 服务配置：

```bash
cp .env.example .env.local
```

Windows PowerShell 也可以手动复制 `.env.example`，改名为 `.env.local`。

启动开发环境：

```bash
npm run dev
```

终端会显示本地访问地址。若未配置高德 Key，其他界面仍可打开，但地图区域会显示配置提示。

## 检查命令

```bash
npm run typecheck
npm run lint
npm run build
npm test
```

说明：

- `npm run dev`、`npm run typecheck` 可直接在 Windows PowerShell 使用。
- 当前 Sites 的完整构建与验证脚本依赖 Bash、GNU `timeout` 等工具；Windows 推荐使用 Git Bash 或 WSL 执行 `npm run build` 和 `npm test`。
- `npm run build:local` 是不带 Sites 包装层的本地构建入口，适合日常诊断；正式发布前仍应运行完整 `npm run build`。

## 环境变量

仓库只保留变量名，不应提交真实密钥：

```env
AMAP_JS_KEY=
AMAP_SECURITY_CODE=
AI_CASE_PARSER_PROVIDER=gemini
GEMINI_API_KEY=
GEMINI_CASE_PARSER_MODEL=gemini-3.5-flash
OPENAI_API_KEY=
OPENAI_CASE_PARSER_MODEL=gpt-5.6-sol
```

真实值只写在 `.env.local` 或部署平台的环境变量设置中。

## 目录说明

```text
digitalx-casebase/
├── app/                    页面与接口路由
├── components/             地图、阅读器等业务组件
├── lib/                    案例模型、统计、模拟数据、本地存储
├── db/                     正式数据库预留
├── docs/                   产品、设计、架构、交接与版本管理文档
├── public/                 静态资源
├── scripts/                Sites 构建与校验脚本
├── tests/                  自动测试
├── .openai/hosting.json    现有 Sites 项目标识（不是密钥，请勿随意改）
├── .env.example            环境变量示例
├── AGENTS.md               AI 开发规则
├── CHANGELOG.md            版本记录
└── package.json            依赖与命令
```

## 当前最重要的产品边界

V1 的案例数据来自两部分：

1. `lib/mock-cases.ts` 中的内置演示案例；
2. 浏览器 `localStorage` 中由管理端保存的本地案例。

因此，换浏览器、换电脑或清理浏览器数据后，本地新增内容不会自动同步。管理端已真实接入 Gemini 与 OpenAI 双模型路由，默认使用 Gemini，支持粘贴正文和最大 8MB 的 PDF；Gemini 模式可开启 Google Search 联网扩展，输出实际检索词、来源链接和长篇案例研究。资料只明确省份时，系统会以省会作为地图展示锚点并要求人工确认。AI 只生成草稿，网页自动抓取、独立 OCR 任务、原文件云端保存和跨设备同步尚未实现。

下一阶段建议先打通：

> 管理员登录 → 人工创建案例 → 数据库存草稿 → 复核 → 发布 → 首页检索 → 阅读器打开

完成这条真实闭环后，再接 PDF 上传、文本提取与 AI 结构化。
