"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  categories,
  categoryColors,
  type CaseCategory,
  type EvidenceLevel,
  type LocationLevel,
  type PublishStatus,
  type SmartCityCase,
} from "@/lib/case-model";
import { smartCityCases } from "@/lib/mock-cases";
import { createSlug, getLocalCases, removeLocalCase, saveLocalCase } from "@/lib/local-cases";

type ImportMode = "网页链接" | "粘贴原文" | "本地文件";
type WorkflowStep = "导入资料" | "AI解析" | "人工复核" | "位置确认" | "发布入库";

const workflowSteps: WorkflowStep[] = ["导入资料", "AI解析", "人工复核", "位置确认", "发布入库"];
const sourceTypes: SmartCityCase["sourceType"][] = ["政策文件", "新闻报道", "招投标公告", "企业案例", "会议材料", "研究报告"];
const locationLevels: LocationLevel[] = ["省级", "市级", "区县级", "园区/项目点"];
const evidenceLevels: EvidenceLevel[] = ["强", "中", "弱"];
const coverageTypes: SmartCityCase["coverageType"][] = ["单点项目", "城市级平台", "区县级场景", "省域统筹", "园区示范"];
const projectStages: NonNullable<SmartCityCase["projectStage"]>[] = ["前期谋划", "采购招标", "建设实施", "验收运营", "持续运维"];

const demoSource = `项目名称：深圳市低空飞行综合监管与公共服务平台项目（演示）
建设背景：随着物流配送、城市巡检、应急救援等低空应用快速增加，现有飞行活动分散申报、跨部门协同不足，亟需形成统一运行服务与安全监管能力。
主要建设内容：建设低空空域数字底座、飞行计划申报、航线管理、实时态势监测、风险预警、应急协同和运营服务门户；对接城市运行、公安、应急等相关系统。
项目范围：深圳市，重点覆盖南山区低空应用示范区域。
建设阶段：采购招标。项目总投资约3200万元，资金来源为财政资金与产业专项资金。
预期成效：提升飞行活动可视化监管能力，缩短任务申报和跨部门协同时间，为物流、巡检、文旅和应急等场景提供统一底座。
来源说明：本段为产品交互演示资料，不代表正式项目公告。`;

const emptyCase: SmartCityCase = {
  id: "",
  slug: "",
  title: "",
  province: "广东省",
  city: "深圳市",
  district: "",
  category: "低空经济",
  year: 2026,
  owner: "",
  locationLevel: "市级",
  lng: 114.0579,
  lat: 22.5431,
  locationConfidence: 0.62,
  coverageType: "城市级平台",
  status: "草稿",
  sourceType: "招投标公告",
  evidenceLevel: "中",
  summary: "",
  painPoints: [],
  solution: [],
  outcomes: [],
  aiTags: [],
  expertView: "",
  sourceNote: "",
  sourceUrl: "",
  sourceTitle: "",
  sourceExcerpt: "",
  projectStage: "采购招标",
  investmentAmount: "",
  fundingSource: "",
  implementationUnit: "",
  operationUnit: "",
};

function lines(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function toText(value: string[]) {
  return value.join("\n");
}

function buildParsedCase(sourceUrl: string, sourceText: string): SmartCityCase {
  const now = new Date().toISOString();
  return {
    ...emptyCase,
    id: `local-${Date.now()}`,
    slug: createSlug("深圳市低空飞行综合监管与公共服务平台项目"),
    title: "深圳市低空飞行综合监管与公共服务平台项目（演示）",
    owner: "市级低空经济主管部门 / 城市运行管理相关单位",
    summary:
      "针对低空飞行活动分散申报、运行数据割裂及安全监管协同不足等问题，建设覆盖空域数字底座、飞行服务、运行监测、风险预警和应急联动的城市级低空综合监管与公共服务能力。",
    painPoints: [
      "低空飞行计划分散申报，企业和管理部门协同成本较高",
      "物流、巡检、应急等场景数据尚未形成统一运行视图",
      "产业发展速度快于安全监管规则和跨部门处置机制建设",
    ],
    solution: [
      "建设低空空域、航线、起降点和重点风险区数字底座",
      "形成飞行计划申报、任务审核、实时态势监测和风险预警闭环",
      "对接城市运行、公安、应急等系统，支撑异常事件协同处置",
    ],
    outcomes: [
      "提升低空飞行活动的可视化、可追溯和协同监管能力",
      "为物流配送、城市巡检、文旅和应急救援提供共性服务底座",
      "沉淀城市级低空运行规则、接口和项目实施方法",
    ],
    aiTags: ["空域管理", "飞行服务", "风险预警", "城市运行", "低空经济"],
    expertView:
      "项目价值不应只看无人机数量和可视化效果，而要重点核验飞行申报是否提效、跨部门处置是否形成制度闭环、平台是否具备持续运营主体。",
    sourceNote: "演示资料已完成结构化提取；正式发布前仍需绑定原始公告、采购文件及可核验指标。",
    sourceUrl,
    sourceTitle: "低空飞行综合监管与公共服务平台项目资料（演示）",
    sourceExcerpt: sourceText.slice(0, 420),
    investmentAmount: "约3,200万元",
    fundingSource: "财政资金与产业专项资金",
    implementationUnit: "待采购结果确认",
    operationUnit: "市级低空运行服务主体",
    importedAt: now,
    updatedAt: now,
  };
}

function StatusBadge({ status }: { status: PublishStatus }) {
  const styles = {
    已发布: "bg-emerald-50 text-emerald-700 border-emerald-200",
    待复核: "bg-amber-50 text-amber-700 border-amber-200",
    草稿: "bg-slate-100 text-slate-600 border-slate-200",
  };
  return <span className={`inline-flex rounded border px-2 py-0.5 text-xs font-medium ${styles[status]}`}>{status}</span>;
}

export default function AdminPage() {
  const [importMode, setImportMode] = useState<ImportMode>("网页链接");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [fileName, setFileName] = useState("");
  const [caseItem, setCaseItem] = useState<SmartCityCase>(emptyCase);
  const [localCases, setLocalCases] = useState<SmartCityCase[]>([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [parsing, setParsing] = useState(false);
  const [notice, setNotice] = useState("");
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setLocalCases(getLocalCases()));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const combinedCases = useMemo(() => [...localCases, ...smartCityCases], [localCases]);
  const health = useMemo(
    () => ({
      total: combinedCases.length,
      published: combinedCases.filter((item) => item.status === "已发布").length,
      review: combinedCases.filter((item) => item.status === "待复核").length,
      draft: combinedCases.filter((item) => item.status === "草稿").length,
    }),
    [combinedCases],
  );

  function loadDemo() {
    setImportMode("粘贴原文");
    setSourceText(demoSource);
    setSourceUrl("https://example.com/demo-low-altitude-project");
    setFileName("");
    setStepIndex(0);
    setNotice("已载入一份演示资料，可直接开始解析。");
  }

  function simulateParse() {
    if (!sourceText.trim() && !sourceUrl.trim() && !fileName) {
      setErrors(["请先粘贴网页链接、原始资料或选择文件。"]);
      return;
    }
    setErrors([]);
    setNotice("");
    setParsing(true);
    setStepIndex(1);
    window.setTimeout(() => {
      setCaseItem(buildParsedCase(sourceUrl, sourceText || demoSource));
      setParsing(false);
      setStepIndex(2);
      setNotice("模拟AI解析完成：已识别28个字段，并标记3项需要人工核验。");
    }, 900);
  }

  function update<K extends keyof SmartCityCase>(key: K, value: SmartCityCase[K]) {
    setCaseItem((current) => ({ ...current, [key]: value, updatedAt: new Date().toISOString() }));
  }

  function validateForPublish() {
    const next: string[] = [];
    if (!caseItem.title.trim()) next.push("案例名称不能为空。");
    if (!caseItem.city.trim()) next.push("城市不能为空。");
    if (!caseItem.summary.trim()) next.push("案例摘要不能为空。");
    if (!caseItem.sourceNote.trim()) next.push("请填写来源说明。");
    if (!Number.isFinite(caseItem.lng) || !Number.isFinite(caseItem.lat)) next.push("请确认地图经纬度。");
    setErrors(next);
    return next.length === 0;
  }

  function persist(status: PublishStatus) {
    if (status === "已发布" && !validateForPublish()) return;
    if (!caseItem.title.trim()) {
      setErrors(["请先完成模拟解析或填写案例名称。"]);
      return;
    }

    const now = new Date().toISOString();
    const item: SmartCityCase = {
      ...caseItem,
      id: caseItem.id || `local-${Date.now()}`,
      slug: caseItem.slug || createSlug(caseItem.title),
      status,
      importedAt: caseItem.importedAt || now,
      updatedAt: now,
    };
    const next = saveLocalCase(item);
    setCaseItem(item);
    setLocalCases(next);
    setErrors([]);

    if (status === "草稿") {
      setStepIndex(Math.max(stepIndex, 2));
      setNotice("草稿已保存到当前浏览器。");
    } else if (status === "待复核") {
      setStepIndex(3);
      setNotice("案例已提交复核，下一步确认位置与证据。");
    } else {
      setStepIndex(4);
      setNotice("案例已发布，现已进入公开案例列表和地图统计。");
    }
  }

  function editCase(item: SmartCityCase) {
    setCaseItem(item);
    setSourceUrl(item.sourceUrl || "");
    setSourceText(item.sourceExcerpt || "");
    setStepIndex(item.status === "已发布" ? 4 : item.status === "待复核" ? 3 : 2);
    setNotice(`正在编辑：${item.title}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function newCase() {
    setCaseItem(emptyCase);
    setSourceUrl("");
    setSourceText("");
    setFileName("");
    setStepIndex(0);
    setErrors([]);
    setNotice("");
  }

  function deleteCase(id: string) {
    const next = removeLocalCase(id);
    setLocalCases(next);
    if (caseItem.id === id) newCase();
    setNotice("本地案例已移除。");
  }

  return (
    <main className="admin-shell min-h-screen bg-[#f3f6f8] text-slate-950">
      <header className="admin-header sticky top-0 z-40 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="brand-mark flex h-8 w-8 items-center justify-center rounded bg-slate-950 text-xs font-semibold text-white">DX</span>
              <span>
                <span className="block text-sm font-semibold">案例生产工作台</span>
                <span className="block text-[11px] text-slate-500">DigitalX Case Studio</span>
              </span>
            </Link>
            <span className="hidden h-6 w-px bg-slate-200 md:block" />
            <span className="hidden rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-700 md:inline-flex">
              原型模式 · 模拟AI解析
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={newCase} className="secondary-pill rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">新建案例</button>
            <Link href="/" className="primary-pill rounded bg-slate-950 px-3.5 py-2 text-sm font-medium text-white">查看公开站</Link>
          </div>
        </div>
      </header>

      <section className="workflow-strip border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-[1600px] px-4 py-4 sm:px-6">
          <div className="grid gap-2 md:grid-cols-5">
            {workflowSteps.map((step, index) => (
              <button
                key={step}
                onClick={() => index <= stepIndex && setStepIndex(index)}
                className={`workflow-step flex items-center gap-3 rounded border px-3 py-2.5 text-left ${
                  index === stepIndex
                    ? "border-teal-600 bg-teal-50 text-teal-800"
                    : index < stepIndex
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 bg-white text-slate-400"
                }`}
              >
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  index <= stepIndex ? "bg-current text-white" : "bg-slate-100 text-slate-400"
                }`}>
                  <span className={index <= stepIndex ? "text-white" : ""}>{index < stepIndex ? "✓" : index + 1}</span>
                </span>
                <span>
                  <span className="block text-[11px] opacity-70">STEP {index + 1}</span>
                  <span className="block text-sm font-medium">{step}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="admin-workspace mx-auto max-w-[1600px] px-4 py-5 sm:px-6">
        <div className="admin-metrics mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["案例总量", health.total, "text-slate-950"],
            ["已发布", health.published, "text-emerald-700"],
            ["待复核", health.review, "text-amber-700"],
            ["草稿", health.draft, "text-slate-600"],
          ].map(([label, value, color]) => (
            <div key={String(label)} className="rounded border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <div className={`text-2xl font-semibold ${color}`}>{value}</div>
              <div className="mt-0.5 text-xs text-slate-500">{label}</div>
            </div>
          ))}
        </div>

        {(notice || errors.length > 0) && (
          <div className={`mb-4 rounded border px-4 py-3 text-sm ${
            errors.length > 0 ? "border-red-200 bg-red-50 text-red-700" : "border-teal-200 bg-teal-50 text-teal-800"
          }`}>
            {errors.length > 0 ? errors.map((error) => <div key={error}>• {error}</div>) : notice}
          </div>
        )}

        <div className="admin-grid grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)_340px]">
          <aside className="admin-panel source-panel h-fit rounded border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-4 py-3">
              <p className="text-xs font-medium text-teal-700">01 / 原始资料</p>
              <h1 className="mt-1 text-lg font-semibold">导入案例资料</h1>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-3 rounded border border-slate-200 bg-slate-50 p-1">
                {(["网页链接", "粘贴原文", "本地文件"] as ImportMode[]).map((item) => (
                  <button
                    key={item}
                    onClick={() => setImportMode(item)}
                    className={`rounded px-2 py-1.5 text-xs ${importMode === item ? "bg-white font-medium text-slate-950 shadow-sm" : "text-slate-500"}`}
                  >
                    {item}
                  </button>
                ))}
              </div>

              {importMode === "网页链接" && (
                <label className="mt-4 block">
                  <span className="text-xs font-medium text-slate-600">资料网址</span>
                  <input
                    value={sourceUrl}
                    onChange={(event) => setSourceUrl(event.target.value)}
                    placeholder="https://..."
                    className="mt-1.5 h-10 w-full rounded border border-slate-200 px-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                  />
                  <p className="mt-2 text-xs leading-5 text-slate-500">原型阶段不抓取网页，填写后使用演示内容模拟解析。</p>
                </label>
              )}

              {importMode === "粘贴原文" && (
                <label className="mt-4 block">
                  <span className="text-xs font-medium text-slate-600">原始资料正文</span>
                  <textarea
                    value={sourceText}
                    onChange={(event) => setSourceText(event.target.value)}
                    placeholder="粘贴政策、招标公告、新闻稿或项目介绍……"
                    className="mt-1.5 h-64 w-full resize-none rounded border border-slate-200 p-3 text-sm leading-6 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                  />
                </label>
              )}

              {importMode === "本地文件" && (
                <label className="mt-4 flex min-h-44 cursor-pointer flex-col items-center justify-center rounded border border-dashed border-slate-300 bg-slate-50 p-5 text-center hover:border-teal-500">
                  <span className="text-2xl">⇧</span>
                  <span className="mt-2 text-sm font-medium">{fileName || "选择 PDF、Word、图片或文本"}</span>
                  <span className="mt-1 text-xs text-slate-500">本轮仅验证上传交互，不解析文件内容</span>
                  <input
                    type="file"
                    className="sr-only"
                    accept=".pdf,.doc,.docx,.txt,.md,.png,.jpg,.jpeg"
                    onChange={(event) => setFileName(event.target.files?.[0]?.name || "")}
                  />
                </label>
              )}

              <button onClick={loadDemo} className="mt-4 w-full rounded border border-slate-200 px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-50">
                载入演示资料
              </button>
              <button
                onClick={simulateParse}
                disabled={parsing}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded bg-slate-950 px-3 py-2.5 text-sm font-medium text-white disabled:cursor-wait disabled:opacity-60"
              >
                {parsing && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                {parsing ? "正在模拟解析…" : "开始AI结构化解析"}
              </button>

              <div className="mt-4 rounded bg-slate-50 p-3 text-xs leading-5 text-slate-500">
                <b className="text-slate-700">本地原型说明：</b>本轮不会调用大模型，也不会产生AI费用。
              </div>
            </div>
          </aside>

          <section className="admin-panel editor-panel rounded border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-2 border-b border-slate-200 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-medium text-teal-700">02 / 结构化结果</p>
                <h2 className="mt-1 text-lg font-semibold">人工复核编辑器</h2>
              </div>
              <StatusBadge status={caseItem.status} />
            </div>

            <div className="space-y-5 p-5">
              {!caseItem.title && (
                <div className="flex min-h-32 flex-col items-center justify-center rounded border border-dashed border-slate-300 bg-slate-50 text-center">
                  <div className="text-sm font-medium text-slate-700">等待解析结果</div>
                  <div className="mt-1 text-xs text-slate-500">左侧导入资料后，结构化字段将在这里生成</div>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <label className="md:col-span-2">
                  <span className="text-xs font-medium text-slate-600">案例名称 *</span>
                  <input value={caseItem.title} onChange={(event) => update("title", event.target.value)} className="admin-input" />
                </label>
                <label>
                  <span className="text-xs font-medium text-slate-600">应用分类</span>
                  <select value={caseItem.category} onChange={(event) => update("category", event.target.value as CaseCategory)} className="admin-input">
                    {categories.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>
                <label>
                  <span className="text-xs font-medium text-slate-600">项目阶段</span>
                  <select value={caseItem.projectStage} onChange={(event) => update("projectStage", event.target.value as SmartCityCase["projectStage"])} className="admin-input">
                    {projectStages.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>
                <label>
                  <span className="text-xs font-medium text-slate-600">省份</span>
                  <input value={caseItem.province} onChange={(event) => update("province", event.target.value)} className="admin-input" />
                </label>
                <label>
                  <span className="text-xs font-medium text-slate-600">城市</span>
                  <input value={caseItem.city} onChange={(event) => update("city", event.target.value)} className="admin-input" />
                </label>
                <label>
                  <span className="text-xs font-medium text-slate-600">区县 / 片区</span>
                  <input value={caseItem.district || ""} onChange={(event) => update("district", event.target.value)} className="admin-input" />
                </label>
                <label>
                  <span className="text-xs font-medium text-slate-600">案例年份</span>
                  <input type="number" value={caseItem.year} onChange={(event) => update("year", Number(event.target.value))} className="admin-input" />
                </label>
                <label className="md:col-span-2">
                  <span className="text-xs font-medium text-slate-600">建设 / 牵头主体</span>
                  <input value={caseItem.owner} onChange={(event) => update("owner", event.target.value)} className="admin-input" />
                </label>
                <label>
                  <span className="text-xs font-medium text-slate-600">项目投资</span>
                  <input value={caseItem.investmentAmount || ""} onChange={(event) => update("investmentAmount", event.target.value)} className="admin-input" />
                </label>
                <label>
                  <span className="text-xs font-medium text-slate-600">资金来源</span>
                  <input value={caseItem.fundingSource || ""} onChange={(event) => update("fundingSource", event.target.value)} className="admin-input" />
                </label>
              </div>

              <label className="block">
                <span className="text-xs font-medium text-slate-600">案例摘要 *</span>
                <textarea value={caseItem.summary} onChange={(event) => update("summary", event.target.value)} className="admin-textarea h-28" />
              </label>

              <div className="grid gap-4 lg:grid-cols-3">
                <label>
                  <span className="text-xs font-medium text-slate-600">痛点需求（每行一项）</span>
                  <textarea value={toText(caseItem.painPoints)} onChange={(event) => update("painPoints", lines(event.target.value))} className="admin-textarea h-44" />
                </label>
                <label>
                  <span className="text-xs font-medium text-slate-600">建设内容（每行一项）</span>
                  <textarea value={toText(caseItem.solution)} onChange={(event) => update("solution", lines(event.target.value))} className="admin-textarea h-44" />
                </label>
                <label>
                  <span className="text-xs font-medium text-slate-600">应用成效（每行一项）</span>
                  <textarea value={toText(caseItem.outcomes)} onChange={(event) => update("outcomes", lines(event.target.value))} className="admin-textarea h-44" />
                </label>
              </div>

              <label className="block">
                <span className="text-xs font-medium text-slate-600">专业判断 / 风险不足</span>
                <textarea value={caseItem.expertView} onChange={(event) => update("expertView", event.target.value)} className="admin-textarea h-24" />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-600">多维标签（换行或逗号分隔）</span>
                <textarea
                  value={caseItem.aiTags.join("、")}
                  onChange={(event) => update("aiTags", event.target.value.split(/[、,\n]/).map((item) => item.trim()).filter(Boolean))}
                  className="admin-textarea h-20"
                />
              </label>
            </div>
          </section>

          <aside className="quality-rail h-fit space-y-4">
            <section className="admin-panel rounded border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-4 py-3">
                <p className="text-xs font-medium text-teal-700">03 / 证据与发布</p>
                <h2 className="mt-1 text-lg font-semibold">质量控制</h2>
              </div>
              <div className="space-y-4 p-4">
                <div className="grid grid-cols-2 gap-3">
                  <label>
                    <span className="text-xs font-medium text-slate-600">来源类型</span>
                    <select value={caseItem.sourceType} onChange={(event) => update("sourceType", event.target.value as SmartCityCase["sourceType"])} className="admin-input">
                      {sourceTypes.map((item) => <option key={item}>{item}</option>)}
                    </select>
                  </label>
                  <label>
                    <span className="text-xs font-medium text-slate-600">证据等级</span>
                    <select value={caseItem.evidenceLevel} onChange={(event) => update("evidenceLevel", event.target.value as EvidenceLevel)} className="admin-input">
                      {evidenceLevels.map((item) => <option key={item}>{item}</option>)}
                    </select>
                  </label>
                </div>
                <label className="block">
                  <span className="text-xs font-medium text-slate-600">来源说明 *</span>
                  <textarea value={caseItem.sourceNote} onChange={(event) => update("sourceNote", event.target.value)} className="admin-textarea h-24" />
                </label>
                <div className="rounded border border-amber-200 bg-amber-50 p-3">
                  <div className="text-xs font-semibold text-amber-800">需要人工核验</div>
                  <ul className="mt-2 space-y-1 text-xs leading-5 text-amber-700">
                    <li>• 3,200万元投资金额是否来自正式公告</li>
                    <li>• 建设主体和运营主体尚未完全明确</li>
                    <li>• 预期成效暂无验收指标支撑</li>
                  </ul>
                </div>
              </div>
            </section>

            <section className="admin-panel rounded border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-4 py-3">
                <h2 className="text-sm font-semibold">地图位置确认</h2>
              </div>
              <div className="space-y-3 p-4">
                <div className="grid grid-cols-2 gap-3">
                  <label>
                    <span className="text-xs font-medium text-slate-600">空间层级</span>
                    <select value={caseItem.locationLevel} onChange={(event) => update("locationLevel", event.target.value as LocationLevel)} className="admin-input">
                      {locationLevels.map((item) => <option key={item}>{item}</option>)}
                    </select>
                  </label>
                  <label>
                    <span className="text-xs font-medium text-slate-600">覆盖类型</span>
                    <select value={caseItem.coverageType} onChange={(event) => update("coverageType", event.target.value as SmartCityCase["coverageType"])} className="admin-input">
                      {coverageTypes.map((item) => <option key={item}>{item}</option>)}
                    </select>
                  </label>
                  <label>
                    <span className="text-xs font-medium text-slate-600">经度</span>
                    <input type="number" step="0.0001" value={caseItem.lng} onChange={(event) => update("lng", Number(event.target.value))} className="admin-input" />
                  </label>
                  <label>
                    <span className="text-xs font-medium text-slate-600">纬度</span>
                    <input type="number" step="0.0001" value={caseItem.lat} onChange={(event) => update("lat", Number(event.target.value))} className="admin-input" />
                  </label>
                </div>
                <label className="block">
                  <span className="flex items-center justify-between text-xs font-medium text-slate-600">
                    <span>位置置信度</span><span>{Math.round(caseItem.locationConfidence * 100)}%</span>
                  </span>
                  <input
                    type="range"
                    min="0.3"
                    max="1"
                    step="0.01"
                    value={caseItem.locationConfidence}
                    onChange={(event) => update("locationConfidence", Number(event.target.value))}
                    className="mt-2 w-full accent-teal-600"
                  />
                </label>
                <p className="rounded bg-slate-50 p-2.5 text-xs leading-5 text-slate-500">
                  当前按“市级位置”入库。后续获得明确项目地址时，再升级为空间精确点位。
                </p>
              </div>
            </section>

            <section className="publish-panel rounded border border-slate-200 bg-white p-4 shadow-sm">
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => persist("草稿")} className="rounded border border-slate-200 px-3 py-2.5 text-sm hover:bg-slate-50">保存草稿</button>
                <button onClick={() => persist("待复核")} className="rounded border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-800 hover:bg-amber-100">提交复核</button>
              </div>
              <button onClick={() => persist("已发布")} className="mt-2 w-full rounded bg-teal-700 px-3 py-3 text-sm font-semibold text-white hover:bg-teal-800">
                确认发布入库
              </button>
              {caseItem.status === "已发布" && caseItem.slug && (
                <Link href={`/cases/${caseItem.slug}`} className="mt-2 block w-full rounded border border-teal-200 px-3 py-2.5 text-center text-sm font-medium text-teal-700 hover:bg-teal-50">
                  查看公开案例 →
                </Link>
              )}
            </section>
          </aside>
        </div>

        <section className="ledger-panel mt-5 rounded border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
            <div>
              <p className="text-xs font-medium text-teal-700">案例台账</p>
              <h2 className="mt-1 text-lg font-semibold">审核与发布队列</h2>
            </div>
            <span className="text-xs text-slate-500">本地新增 {localCases.length} 条</span>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[900px]">
              <div className="grid grid-cols-[minmax(300px,1.5fr)_140px_120px_110px_120px] bg-slate-50 px-5 py-2.5 text-xs font-medium text-slate-500">
                <span>案例名称</span><span>地区 / 年份</span><span>分类</span><span>状态</span><span>操作</span>
              </div>
              {combinedCases.slice(0, 14).map((item) => {
                const isLocal = item.id.startsWith("local-");
                return (
                  <div key={item.id} className="grid grid-cols-[minmax(300px,1.5fr)_140px_120px_110px_120px] items-center border-t border-slate-100 px-5 py-3 text-sm">
                    <span className="min-w-0 pr-5">
                      <span className="block truncate font-medium">{item.title}</span>
                      <span className="mt-1 block truncate text-xs text-slate-500">{item.sourceType} · {item.sourceNote}</span>
                    </span>
                    <span className="text-xs text-slate-600">{item.city} · {item.year}</span>
                    <span><span className="rounded px-2 py-1 text-xs text-white" style={{ backgroundColor: categoryColors[item.category] }}>{item.category}</span></span>
                    <span><StatusBadge status={item.status} /></span>
                    <span className="flex items-center gap-2">
                      {isLocal ? (
                        <>
                          <button onClick={() => editCase(item)} className="text-xs font-medium text-teal-700 hover:underline">编辑</button>
                          <button onClick={() => deleteCase(item.id)} className="text-xs text-slate-400 hover:text-red-600">删除</button>
                        </>
                      ) : (
                        <Link href={`/cases/${item.slug}`} className="text-xs text-slate-500 hover:text-teal-700">查看</Link>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <div className="mt-4 rounded border border-blue-200 bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-700">
          原型数据仅保存在当前浏览器，用于验证导入、复核、定位、发布和前台联动流程；清除浏览器数据或更换设备后不会同步。
        </div>
      </section>
    </main>
  );
}
