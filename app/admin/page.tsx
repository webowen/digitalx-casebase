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
import {
  MAX_CASE_PDF_BYTES,
  MAX_CASE_SOURCE_CHARACTERS,
  assessmentLabels,
  type CaseFieldAssessment,
  type CaseParserResponse,
} from "@/lib/ai-case-parser";

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
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [caseItem, setCaseItem] = useState<SmartCityCase>(emptyCase);
  const [assessments, setAssessments] = useState<CaseFieldAssessment[]>([]);
  const [reviewItems, setReviewItems] = useState<string[]>([]);
  const [parseMeta, setParseMeta] = useState<CaseParserResponse["meta"] | null>(null);
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
    setSourceFile(null);
    setStepIndex(0);
    setNotice("已载入一份测试资料。点击解析后会真实调用 OpenAI API，并产生少量费用。");
  }

  async function parseCase() {
    const activeText = importMode === "本地文件" ? "" : sourceText.trim();
    const activeFile = importMode === "本地文件" ? sourceFile : null;

    if (!activeText && !activeFile) {
      setErrors(["请先粘贴原始资料正文，或选择一个 PDF 文件。网页链接暂时只作为来源记录。"]);
      return;
    }
    if (activeText.length > MAX_CASE_SOURCE_CHARACTERS) {
      setErrors([`原始正文不能超过 ${MAX_CASE_SOURCE_CHARACTERS.toLocaleString()} 个字符。`]);
      return;
    }
    if (activeFile && activeFile.size > MAX_CASE_PDF_BYTES) {
      setErrors(["PDF 文件不能超过 8MB。"]);
      return;
    }

    setErrors([]);
    setNotice("");
    setParsing(true);
    setStepIndex(1);

    const formData = new FormData();
    formData.set("sourceText", activeText);
    formData.set("sourceUrl", sourceUrl);
    if (activeFile) formData.set("file", activeFile);

    try {
      const response = await fetch("/api/ai/parse-case", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as CaseParserResponse | { error?: { message?: string } };
      if (!response.ok || !("result" in payload)) {
        const message = "error" in payload ? payload.error?.message : "";
        throw new Error(message || "AI 解析失败，请稍后重试。");
      }
      if (!payload.result.compatible) {
        setStepIndex(0);
        setErrors([payload.result.incompatibilityReason || "这份资料不像可入库的城市数字化案例，请更换资料。"]);
        return;
      }

      const now = new Date().toISOString();
      const parsed = payload.result.case;
      const locationAssessment = payload.result.fieldAssessments.find((item) => item.field === "location");
      const nextCase: SmartCityCase = {
        ...emptyCase,
        ...parsed,
        id: `local-${Date.now()}`,
        slug: createSlug(parsed.title || "case"),
        year: parsed.year || new Date().getFullYear(),
        status: "草稿",
        lng: 0,
        lat: 0,
        locationConfidence: locationAssessment?.confidence || 0,
        sourceUrl,
        sourceNote: `由 AI 从${activeFile ? `文件“${activeFile.name}”` : "粘贴正文"}生成草稿；所有字段需人工复核后发布。`,
        sourceExcerpt: parsed.sourceExcerpt || activeText.slice(0, 420),
        importedAt: now,
        updatedAt: now,
      };

      setCaseItem(nextCase);
      setAssessments(payload.result.fieldAssessments);
      setReviewItems(payload.result.reviewItems);
      setParseMeta(payload.meta);
      setParsing(false);
      setStepIndex(2);
      setNotice(`真实 AI 解析完成：生成了可编辑草稿，并标记 ${payload.result.reviewItems.length} 项人工核验事项。`);
    } catch (error) {
      setStepIndex(0);
      setErrors([error instanceof Error ? error.message : "AI 解析失败，请稍后重试。"]);
    } finally {
      setParsing(false);
    }
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
    if (
      !Number.isFinite(caseItem.lng) ||
      !Number.isFinite(caseItem.lat) ||
      caseItem.lng < -180 ||
      caseItem.lng > 180 ||
      caseItem.lat < -90 ||
      caseItem.lat > 90 ||
      (caseItem.lng === 0 && caseItem.lat === 0)
    ) {
      next.push("请人工确认有效的地图经纬度；AI 不会猜测精确坐标。");
    }
    setErrors(next);
    return next.length === 0;
  }

  function persist(status: PublishStatus) {
    if (status === "已发布" && !validateForPublish()) return;
    if (!caseItem.title.trim()) {
      setErrors(["请先完成 AI 解析或填写案例名称。"]);
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
    setSourceFile(null);
    setFileName("");
    setAssessments([]);
    setReviewItems([]);
    setParseMeta(null);
    setStepIndex(item.status === "已发布" ? 4 : item.status === "待复核" ? 3 : 2);
    setNotice(`正在编辑：${item.title}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function newCase() {
    setImportMode("网页链接");
    setCaseItem(emptyCase);
    setSourceUrl("");
    setSourceText("");
    setFileName("");
    setSourceFile(null);
    setAssessments([]);
    setReviewItems([]);
    setParseMeta(null);
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
            <span className="hidden rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-700 md:inline-flex">
              OpenAI 已接入 · 人工复核后发布
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
                <div className="mt-4 space-y-3">
                  <label className="block">
                    <span className="text-xs font-medium text-slate-600">资料网址</span>
                    <input
                      value={sourceUrl}
                      onChange={(event) => setSourceUrl(event.target.value)}
                      placeholder="https://..."
                      className="mt-1.5 h-10 w-full rounded border border-slate-200 px-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-slate-600">网页正文 *</span>
                    <textarea
                      value={sourceText}
                      onChange={(event) => setSourceText(event.target.value)}
                      placeholder="复制并粘贴网页中的项目正文……"
                      className="mt-1.5 h-48 w-full resize-none rounded border border-slate-200 p-3 text-sm leading-6 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                    />
                  </label>
                  <p className="text-xs leading-5 text-slate-500">第一版不自动抓取网页。网址用于来源追溯，AI 解析粘贴的正文。</p>
                </div>
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
                  <span className="mt-2 text-sm font-medium">{fileName || "选择 PDF 文件"}</span>
                  <span className="mt-1 text-xs text-slate-500">支持文本型或扫描型 PDF，最大 8MB</span>
                  <input
                    type="file"
                    className="sr-only"
                    accept="application/pdf,.pdf"
                    onChange={(event) => {
                      const nextFile = event.target.files?.[0] || null;
                      setSourceFile(nextFile);
                      setFileName(nextFile?.name || "");
                    }}
                  />
                </label>
              )}

              <button onClick={loadDemo} className="mt-4 w-full rounded border border-slate-200 px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-50">
                载入演示资料
              </button>
              <button
                onClick={parseCase}
                disabled={parsing}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded bg-slate-950 px-3 py-2.5 text-sm font-medium text-white disabled:cursor-wait disabled:opacity-60"
              >
                {parsing && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                {parsing ? "AI 正在阅读与提取…" : "开始真实AI结构化解析"}
              </button>

              <div className="mt-4 rounded bg-slate-50 p-3 text-xs leading-5 text-slate-500">
                <b className="text-slate-700">真实调用说明：</b>点击解析会调用 OpenAI API 并产生费用。原始资料不会被用于自动发布，解析结果只生成待复核草稿。
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
                {assessments.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold text-slate-700">AI 字段证据</div>
                      {parseMeta && <div className="text-[11px] text-slate-400">{parseMeta.model}</div>}
                    </div>
                    {assessments.map((assessment) => (
                      <div
                        key={assessment.field}
                        className={`rounded border p-3 ${assessment.needsReview ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-semibold text-slate-800">{assessmentLabels[assessment.field]}</span>
                          <span className="text-xs font-medium text-slate-600">{Math.round(assessment.confidence * 100)}%</span>
                        </div>
                        <div className="mt-1.5 text-xs leading-5 text-slate-600">
                          {assessment.evidence || "资料中没有找到直接证据"}
                        </div>
                        {assessment.reason && <div className="mt-1 text-[11px] leading-4 text-slate-500">{assessment.reason}</div>}
                      </div>
                    ))}
                  </div>
                )}
                {reviewItems.length > 0 && (
                  <div className="rounded border border-amber-200 bg-amber-50 p-3">
                    <div className="text-xs font-semibold text-amber-800">需要人工核验</div>
                    <ul className="mt-2 space-y-1 text-xs leading-5 text-amber-700">
                      {reviewItems.map((item) => <li key={item}>• {item}</li>)}
                    </ul>
                  </div>
                )}
                {parseMeta && (
                  <div className="rounded bg-slate-50 p-2.5 text-[11px] leading-5 text-slate-500">
                    本次调用：输入 {parseMeta.inputTokens.toLocaleString()} tokens · 输出 {parseMeta.outputTokens.toLocaleString()} tokens
                  </div>
                )}
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
                  AI 只提取文字中的行政区划，不猜测经纬度。发布前请人工确认地图坐标；未确认时保持 0, 0。
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
          AI 解析已真实接入；解析后的草稿仍只保存在当前浏览器。清除浏览器数据或更换设备后不会同步，正式数据库与账号权限将在后续阶段接入。
        </div>
      </section>
    </main>
  );
}
