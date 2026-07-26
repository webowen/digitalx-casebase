# Git、VS Code 与 ChatGPT 协作

## 1. 三个东西分别是什么

| 工具 | 作用 |
|---|---|
| VS Code | 在本地打开和编辑整个工程文件夹 |
| Git | 在本地记录每次代码变化，可比较和回退 |
| GitHub | 远程保存 Git 仓库，便于备份、协作和让开发工具读取 |

GitHub 账号不等于电脑已经安装 Git。先在终端执行：

```bash
git --version
```

能显示版本号才说明本机已安装。

## 2. 第一次迁移

1. 下载并解压源码 ZIP；
2. 用 VS Code “文件 → 打开文件夹”打开整个 `DigitalX-Casebase-V1`；
3. 运行 `npm ci`；
4. 创建 `.env.local`；
5. 运行 `npm run dev`；
6. 确认本地页面可打开；
7. 再初始化自己的 Git 仓库。

## 3. 建议创建 GitHub 私有仓库

在 GitHub 新建一个 **Private** 仓库，例如：

```text
digitalx-casebase
```

不要让 GitHub 自动创建 README、`.gitignore` 或 License，避免和当前工程冲突。

然后在 VS Code 终端执行（把地址换成你的仓库地址）：

```bash
git init
git add .
git commit -m "chore: freeze DigitalX V1 prototype"
git branch -M main
git remote add origin https://github.com/你的用户名/digitalx-casebase.git
git push -u origin main
git tag v1.0-prototype
git push origin v1.0-prototype
```

如果 Git 提示没有姓名和邮箱，先执行：

```bash
git config --global user.name "你的名字"
git config --global user.email "你的GitHub邮箱"
```

## 4. 以后每次开发的正确流程

不要直接在 `main` 上让 AI 大改。以“增加真实数据库”为例：

```bash
git switch main
git pull
git switch -c feat/real-case-database
```

让 Codex/ChatGPT 在这个分支开发。检查后：

```bash
git status
git diff
git add .
git commit -m "feat: add persistent case database"
git push -u origin feat/real-case-database
```

然后在 GitHub 创建 Pull Request，确认测试通过后合并到 `main`。

## 5. ChatGPT 后续怎么继续改

有两种方式。

### 方式 A：重新上传 ZIP

适合偶尔修改：

1. 在 VS Code 中修改；
2. 确认代码可运行；
3. 压缩工程，排除依赖、缓存、`.git` 和 `.env.local`；
4. 上传到 ChatGPT；
5. 明确说明这是哪个分支/版本，以及要改什么；
6. ChatGPT 修改后再下载新 ZIP；
7. 你在本地用 Git 查看差异并提交。

缺点：容易出现“你本地一份、ChatGPT 一份、哪个最新不清楚”。

### 方式 B：通过 GitHub 仓库协作（推荐）

适合持续开发：

1. GitHub 使用私有仓库保存唯一源码；
2. 每个功能新建分支；
3. 让 Codex 连接并读取仓库；
4. Codex 在功能分支修改；
5. 你在 VS Code 拉取分支并本地验收；
6. 通过 PR 合并；
7. `main` 始终保持可运行、可部署。

这样 ChatGPT 不是“临时测试场”，而是围绕同一 Git 仓库工作的开发助手。

## 6. 最小日常命令

查看当前状态：

```bash
git status
```

查看改了什么：

```bash
git diff
```

保存一次变化：

```bash
git add .
git commit -m "fix: adjust reader toolbar"
```

上传到 GitHub：

```bash
git push
```

获取远程最新代码：

```bash
git pull
```

切换分支：

```bash
git switch 分支名
```

## 7. 版本和回退怎么理解

- `commit`：一次有说明的存档；
- `branch`：独立试验路线；
- `main`：稳定主版本；
- `tag`：里程碑标签，例如 `v1.0-prototype`；
- `PR`：把分支合并回主版本前的检查单；
- `rollback`：出现问题时恢复到此前正常版本。

不要用删除文件夹的方式“回到上一版”。先看 Git 历史，再选择恢复或回退。

## 8. 每次交给 AI 的任务模板

```text
项目：DigitalX 城市数智应用案例库
当前分支：
当前版本：
本次目标：
明确不做：
影响页面：
业务流程：
数据来源与去向：
验收标准：
请先读取 README、AGENTS.md 和相关 docs，先给 Plan，不要直接改代码。
```

## 9. 最适合你的长期结构

```text
GitHub 私有仓库：唯一正式源码
├── main：稳定可发布
├── feat/*：新功能
├── fix/*：问题修复
└── tags：V1、V2 等里程碑

VS Code：本地开发与验收
Codex/ChatGPT：读仓库、规划、修改、测试
Sites：保留线上展示与快速发布
```

结论：后续完全可以把 VS Code 文件夹再交给 ChatGPT 修改，但持续开发最好用 GitHub 做中枢，ZIP 作为迁移或阶段性交付，不作为唯一版本管理方式。

