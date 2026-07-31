"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  categories,
  categoryColors,
  type CaseCategory,
  type CaseArticleSection,
  type CaseMediaAsset,
  type CaseMediaCandidate,
  type CaseMediaKind,
  type CaseMediaPlanItem,
  type CaseReviewGateId,
  type EvidenceLevel,
  type LocationLevel,
  type PublishStatus,
  type SmartCityCase,
} from "@/lib/case-model";
import { smartCityCases } from "@/lib/mock-cases";
import { canApproveContentMigration } from "@/lib/benchmark-cases";
import { createSlug, getLocalCases, removeLocalCase, saveLocalCase } from "@/lib/local-cases";
import { extractPdfContent } from "@/lib/client-pdf-text";
import {
  MAX_CASE_PDF_BYTES,
  MAX_CASE_SOURCE_CHARACTERS,
  assessmentLabels,
  type CaseFieldAssessment,
  type CaseParserResponse,
} from "@/lib/ai-case-parser";
import {
  articleCharacterCount,
  articleQualityIssues,
  articleSectionOrder,
  articleSectionTitles,
} from "@/lib/case-editorial";
import {
  approveCaseContentModel,
  normalizeCaseContentModel,
} from "@/lib/case-content-model";
import {
  advanceProduction,
  canAdvanceProduction,
  productionReadiness,
  productionStageLabels,
} from "@/lib/case-production";
import { ContentProductionBoard } from "@/components/content-production-board";

type ImportMode = "网页链接" | "粘贴原文" | "本地文件";
type WorkflowStep = "导入资料" | "AI解析" | "人工复核" | "位置确认" | "发布入库";

const providerLabels: Record<CaseParserResponse["meta"]["provider"], string> = {
  deepseek: "DeepSeek",
  qwen: "千问",
  gemini: "Gemini",
  openai: "OpenAI",
};

const workflowSteps: WorkflowStep[] = ["导入资料", "AI解析", "人工复核", "位置确认", "发布入库"];
const sourceTypes: SmartCityCase["sourceType"][] = ["政策文件", "新闻报道", "招投标公告", "企业案例", "会议材料", "研究报告"];
const locationLevels: LocationLevel[] = ["省级", "市级", "区县级", "园区/项目点"];
const evidenceLevels: EvidenceLevel[] = ["强", "中", "弱"];
const coverageTypes: SmartCityCase["coverageType"][] = ["单点项目", "城市级平台", "区县级场景", "省域统筹", "园区示范"];
const projectStages: NonNullable<SmartCityCase["projectStage"]>[] = ["前期谋划", "采购招标", "建设实施", "验收运营", "持续运维"];
const mediaKindLabels: Record<CaseMediaKind, string> = {
  platform_ui: "平台界面",
  dashboard: "驾驶舱 / 大屏",
  architecture: "架构 / 流程图",
  map: "地图 / 空间成果",
  site_photo: "现场 / 实景照片",
  document: "原始资料页",
  other: "其他图片",
};

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
  locationMethod: "city_center_inferred",
  locationReason: "新建案例默认使用深圳市中心作为地图展示锚点。",
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
  researchReport: "",
  researchSources: [],
  researchQueries: [],
  identity: {
    canonicalTitle: "",
    candidates: [],
    aliases: [],
    confidence: 0,
    needsReview: true,
    reason: "等待AI核验正式项目名称。",
    evidence: [],
  },
  article: {
    standfirst: "",
    keyFindings: [],
    sections: [],
  },
  media: [],
};

type PendingMediaCandidate = CaseMediaCandidate & {
  blob?: Blob;
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

function paragraphs(value: string) {
  return value
    .split(/\n\s*\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function toParagraphText(value: string[]) {
  return value.join("\n\n");
}

function fallbackMediaPlan(candidates: PendingMediaCandidate[]): CaseMediaPlanItem[] {
  return [...candidates]
    .sort((left, right) => right.visualScore - left.visualScore)
    .slice(0, 3)
    .map((candidate) => ({
      candidateId: candidate.id,
      kind: "document",
      sectionId: "overview",
      caption:
        candidate.sourceKind === "pdf_page"
          ? `原始资料第${candidate.pageNumber}页图像，建议人工判断其展示内容和章节位置。`
          : `原始网页中的案例配图，建议人工确认其展示对象。`,
      alt:
        candidate.sourceKind === "pdf_page"
          ? `原始资料第${candidate.pageNumber}页`
          : candidate.nearbyText || "原始网页案例图片",
      confidence: 0.4,
      needsReview: true,
      reason: "AI未形成可靠图片编排，系统按视觉密度保留为人工候选。",
    }));
}

async function materializeMediaAssets(
  caseId: string,
  plans: CaseMediaPlanItem[],
  candidates: PendingMediaCandidate[],
) {
  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const activePlans = plans.length > 0 ? plans : fallbackMediaPlan(candidates);
  const assets: CaseMediaAsset[] = [];

  for (const plan of activePlans.slice(0, 6)) {
    const candidate = byId.get(plan.candidateId);
    if (!candidate) continue;
    try {
      let response: Response;
      if (candidate.sourceKind === "pdf_page" && candidate.blob) {
        const upload = new FormData();
        upload.set(
          "file",
          new File([candidate.blob], `${candidate.id}.jpg`, {
            type: candidate.blob.type || "image/jpeg",
          }),
        );
        upload.set("caseId", caseId);
        upload.set("candidateId", candidate.id);
        response = await fetch("/api/media/upload", { method: "POST", body: upload });
      } else {
        response = await fetch("/api/media/import-web", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            url: candidate.sourceUrl,
            caseId,
            candidateId: candidate.id,
          }),
        });
      }
      const payload = (await response.json()) as { url?: string };
      if (!response.ok || !payload.url) continue;
      assets.push({
        ...plan,
        id: `${caseId}-${candidate.id}`,
        url: payload.url,
        sourceKind: candidate.sourceKind,
        sourceUrl: candidate.sourceUrl,
        pageNumber: candidate.pageNumber,
        included: true,
        reviewed: false,
        needsReview: true,
      });
    } catch {
      // 单张图片失败不应阻断案例正文生成。
    }
  }

  return assets;
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
  const [researchMode, setResearchMode] = useState(true);
  const [localCases, setLocalCases] = useState<SmartCityCase[]>([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [parsing, setParsing] = useState(false);
  const [notice, setNotice] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [manualMediaUrl, setManualMediaUrl] = useState("");
  const [manualMediaCaption, setManualMediaCaption] = useState("");
  const [addingMedia, setAddingMedia] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setLocalCases(getLocalCases()));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const combinedCases = useMemo(() => {
    const localIds = new Set(localCases.map((item) => item.id));
    return [...localCases, ...smartCityCases.filter((item) => !localIds.has(item.id))];
  }, [localCases]);
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
    setNotice("已载入一份测试资料。点击解析后会真实调用当前配置的AI服务；是否收费取决于所选服务商及账户套餐。");
  }

  async function parseCase() {
    let activeText = importMode === "本地文件" ? "" : sourceText.trim();
    let activeFile = importMode === "本地文件" ? sourceFile : null;
    const importedFile = activeFile;
    let mediaCandidates: PendingMediaCandidate[] = [];

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

    if (activeFile) {
      setNotice("正在本地提取PDF文字并识别含图页面；原图只在入选后保存。");
      try {
        const extracted = await extractPdfContent(activeFile);
        mediaCandidates = extracted.mediaCandidates;
        if (!extracted.needsOcr) {
          activeText = extracted.text.slice(0, MAX_CASE_SOURCE_CHARACTERS);
          activeFile = null;
          setNotice(
            `已提取 ${extracted.pageCount} 页、${extracted.characterCount.toLocaleString()} 个字符和 ${mediaCandidates.length} 个图片候选，正在由AI编排。`,
          );
        } else {
          setNotice("该文件疑似扫描PDF，本地未提取到足够文字，将尝试使用已配置的视觉模型识别。");
        }
      } catch {
        setNotice("本地PDF文字提取失败，将尝试使用已配置的视觉模型识别。");
      }
    } else if (importMode === "网页链接" && sourceUrl.trim()) {
      setNotice("正在读取网页中的原始配图，并与粘贴正文一起交给AI编排。");
      try {
        const response = await fetch("/api/media/web-candidates", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ url: sourceUrl.trim() }),
        });
        const payload = (await response.json()) as {
          candidates?: CaseMediaCandidate[];
        };
        if (response.ok && Array.isArray(payload.candidates)) {
          mediaCandidates = payload.candidates;
        }
      } catch {
        // 网页拒绝抓取时仍继续解析用户粘贴的正文。
      }
    }

    const formData = new FormData();
    formData.set("sourceText", activeText);
    formData.set("sourceUrl", sourceUrl);
    formData.set("researchMode", String(researchMode));
    formData.set(
      "mediaCandidates",
      JSON.stringify(
        mediaCandidates.map(({ id, sourceKind, pageNumber, sourceUrl: candidateUrl, nearbyText, visualScore }) => ({
          id,
          sourceKind,
          pageNumber,
          sourceUrl: candidateUrl,
          nearbyText,
          visualScore,
        })),
      ),
    );
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
      const caseId = `local-${Date.now()}`;
      const media = await materializeMediaAssets(
        caseId,
        payload.result.mediaPlan,
        mediaCandidates,
      );
      const locationAssessment = payload.result.fieldAssessments.find((item) => item.field === "location");
      const nextCase: SmartCityCase = {
        ...emptyCase,
        ...parsed,
        id: caseId,
        slug: createSlug(parsed.title || "case"),
        year: parsed.year || new Date().getFullYear(),
        status: "草稿",
        lng: parsed.lng,
        lat: parsed.lat,
        locationConfidence: parsed.locationConfidence || locationAssessment?.confidence || 0,
        locationMethod: parsed.locationMethod,
        locationReason: parsed.locationReason,
        researchSources: payload.result.researchSources,
        researchQueries: payload.result.researchQueries,
        identity: payload.result.identity,
        article: payload.result.article,
        media,
        contentModel: payload.result.contentModel,
        parsePipeline: payload.meta.pipeline,
        sourceUrl,
        sourceNote: `由 AI 从${importedFile ? `文件“${importedFile.name}”` : "粘贴正文"}生成草稿；所有字段需人工复核后发布。`,
        sourceExcerpt: parsed.sourceExcerpt || activeText.slice(0, 420),
        importedAt: now,
        updatedAt: now,
      };

      setCaseItem(normalizeCaseContentModel(nextCase));
      setAssessments(payload.result.fieldAssessments);
      setReviewItems(payload.result.reviewItems);
      setParseMeta(payload.meta);
      setParsing(false);
      setStepIndex(2);
      setNotice(
        payload.meta.fallbackUsed
          ? `原生解析任务链已完成，但部分阶段发生降级：${payload.meta.fallbackReason}`
          : payload.meta.researchMode
          ? `原生解析完成：已生成独立证据包、七章文章、${media.length} 张待复核图片和 ${payload.result.researchSources.length} 个可追溯来源。`
          : `真实 AI 解析完成：生成了可编辑草稿，并标记 ${payload.result.reviewItems.length} 项人工核验事项。`,
      );
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

  function updateCanonicalTitle(value: string) {
    setCaseItem((current) => ({
      ...current,
      title: value,
      identity: current.identity
        ? {
            ...current.identity,
            canonicalTitle: value,
            needsReview: true,
            reason: "正式名称已人工修改，请再次确认后发布。",
          }
        : undefined,
      updatedAt: new Date().toISOString(),
    }));
  }

  function confirmCanonicalTitle(confirmed: boolean) {
    setCaseItem((current) => {
      if (!current.identity) return current;
      return {
        ...current,
        identity: {
          ...current.identity,
          canonicalTitle: current.title.trim(),
          confidence: confirmed ? Math.max(current.identity.confidence, 0.85) : current.identity.confidence,
          needsReview: !confirmed,
          reason: confirmed
            ? `已由人工依据原始资料及联网证据确认：${current.title.trim()}`
            : "正式项目名称仍需人工确认。",
        },
        updatedAt: new Date().toISOString(),
      };
    });
  }

  function updateArticleSection(index: number, patch: Partial<CaseArticleSection>) {
    setCaseItem((current) => {
      if (!current.article) return current;
      const sections = current.article.sections.map((section, sectionIndex) =>
        sectionIndex === index ? { ...section, ...patch } : section,
      );
      return {
        ...current,
        article: { ...current.article, sections },
        updatedAt: new Date().toISOString(),
      };
    });
  }

  function updateMediaAsset(index: number, patch: Partial<CaseMediaAsset>) {
    setCaseItem((current) => ({
      ...current,
      media: (current.media || []).map((asset, assetIndex) =>
        assetIndex === index ? { ...asset, ...patch } : asset,
      ),
      updatedAt: new Date().toISOString(),
    }));
  }

  function updateMigrationReviewGate(
    gateId: CaseReviewGateId,
    status: "needs_work" | "approved",
  ) {
    setCaseItem((current) => {
      if (!current.contentMigration) return current;
      return {
        ...current,
        contentMigration: {
          ...current.contentMigration,
          reviewStatus: "in_review",
          reviewGates: current.contentMigration.reviewGates.map((gate) =>
            gate.id === gateId
              ? {
                  ...gate,
                  status,
                  issueCount: status === "approved" ? 0 : Math.max(1, gate.issueCount),
                  approvedAt: status === "approved" ? new Date().toISOString() : undefined,
                  reviewer: status === "approved" ? "内容负责人" : undefined,
                }
              : gate,
          ),
        },
        updatedAt: new Date().toISOString(),
      };
    });
  }

  function advanceCurrentProduction() {
    const check = canAdvanceProduction(caseItem);
    if (!check.allowed) {
      setErrors([check.reason]);
      return;
    }
    const next = advanceProduction(caseItem);
    setCaseItem(next);
    setLocalCases(saveLocalCase(next));
    setErrors([]);
    setNotice(
      `案例已推进至“${
        productionStageLabels[next.contentMigration?.production?.stage || "queued"]
      }”，进度保存在当前浏览器。`,
    );
  }

  async function addManualMediaEvidence() {
    const url = manualMediaUrl.trim();
    const caption = manualMediaCaption.trim();
    if (!caseItem.title.trim()) {
      setErrors(["请先选择或创建案例，再补充图片证据。"]);
      return;
    }
    if (!/^https?:\/\//i.test(url) || !caption) {
      setErrors(["请填写完整的 http(s) 图片地址和图注。"]);
      return;
    }

    setAddingMedia(true);
    setErrors([]);
    try {
      const candidateId = `manual-${Date.now()}`;
      const response = await fetch("/api/media/import-web", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          url,
          caseId: caseItem.id || caseItem.slug || "draft",
          candidateId,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { url?: string; error?: string }
        | null;
      if (!response.ok || !payload?.url) {
        throw new Error(payload?.error || "图片证据导入失败。");
      }
      const asset: CaseMediaAsset = {
        id: `${candidateId}-asset`,
        candidateId,
        kind: "other",
        sectionId: "overview",
        caption,
        alt: caption,
        confidence: 1,
        needsReview: true,
        reason: "由内容负责人补充的网页图片，仍需核对版权、来源、图注与插入章节。",
        url: payload.url,
        sourceKind: "web_image",
        sourceUrl: url,
        pageNumber: 0,
        included: true,
        reviewed: false,
      };
      setCaseItem((current) => ({
        ...current,
        media: [...(current.media || []), asset],
        updatedAt: new Date().toISOString(),
      }));
      setManualMediaUrl("");
      setManualMediaCaption("");
      setNotice("图片已保存为证据候选；发布前请核对来源、图注和插入章节。");
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "图片证据导入失败。"]);
    } finally {
      setAddingMedia(false);
    }
  }

  function validateForPublish(item: SmartCityCase) {
    const next: string[] = [];
    if (!item.title.trim()) next.push("案例名称不能为空。");
    if (!item.city.trim()) next.push("城市不能为空。");
    if (!item.summary.trim()) next.push("案例摘要不能为空。");
    if (!item.sourceNote.trim()) next.push("请填写来源说明。");
    if (item.identity || item.article) {
      next.push(...articleQualityIssues(item));
    }
    for (const [index, asset] of (item.media || []).entries()) {
      if (!asset.included) continue;
      if (!asset.reviewed) next.push(`第${index + 1}张入选图片尚未完成人工确认。`);
      if (!asset.caption.trim()) next.push(`第${index + 1}张入选图片缺少图注。`);
      if (!asset.alt.trim()) next.push(`第${index + 1}张入选图片缺少无障碍说明。`);
    }
    if (
      !Number.isFinite(item.lng) ||
      !Number.isFinite(item.lat) ||
      item.lng < -180 ||
      item.lng > 180 ||
      item.lat < -90 ||
      item.lat > 90 ||
      (item.lng === 0 && item.lat === 0)
    ) {
      next.push("请人工确认有效的地图经纬度；AI 不会猜测精确坐标。");
    }
    if (item.contentModel) {
      next.push(...item.contentModel.quality.blockingIssues);
      if (item.contentModel.quality.score < 70) {
        next.push(`案例规范质量评分为 ${item.contentModel.quality.score}/100，达到70分后才可发布。`);
      }
    }
    if (item.contentMigration && !canApproveContentMigration(item)) {
      next.push("V1.5 内容迁移的六项终审门槛尚未全部批准。");
    }
    setErrors(next);
    return next.length === 0;
  }

  function persist(status: PublishStatus) {
    if (!caseItem.title.trim()) {
      setErrors(["请先完成 AI 解析或填写案例名称。"]);
      return;
    }

    const now = new Date().toISOString();
    const normalized =
      status === "已发布"
        ? approveCaseContentModel(caseItem)
        : normalizeCaseContentModel(caseItem);
    if (status === "已发布" && !validateForPublish(normalized)) return;
    const migrationApproved =
      status === "已发布" &&
      normalized.contentMigration &&
      canApproveContentMigration(normalized);
    const item: SmartCityCase = {
      ...normalized,
      id: caseItem.id || `local-${Date.now()}`,
      slug: caseItem.slug || createSlug(caseItem.title),
      status,
      contentMigration: normalized.contentMigration
        ? {
            ...normalized.contentMigration,
            status: migrationApproved ? "approved" : normalized.contentMigration.status,
            reviewStatus: migrationApproved ? "approved" : normalized.contentMigration.reviewStatus,
          }
        : undefined,
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
    setManualMediaUrl("");
    setManualMediaCaption("");
    setResearchMode(true);
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
    setResearchMode(true);
    setStepIndex(0);
    setErrors([]);
    setNotice("");
  }

  async function deleteCase(id: string) {
    const target = localCases.find((item) => item.id === id);
    await Promise.allSettled(
      (target?.media || []).map((asset) =>
        fetch(asset.url, { method: "DELETE" }),
      ),
    );
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
              DeepSeek基础解析 · Tavily联网研究 · 人工复核后发布
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
                  <p className="text-xs leading-5 text-slate-500">正文仍以你粘贴的内容为准；系统会尝试读取网页原图，受反爬限制的网站可能需要改用PDF。</p>
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
                  <span className="mt-1 text-xs text-slate-500">同时提取文字和高信息密度页面；扫描件仍需要视觉模型，最大8MB</span>
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

              <label className="mt-3 flex items-start gap-2 rounded border border-teal-100 bg-teal-50/70 p-3">
                <input
                  type="checkbox"
                  checked={researchMode}
                  onChange={(event) => setResearchMode(event.target.checked)}
                  className="mt-0.5 accent-teal-700"
                />
                <span className="text-xs leading-5 text-teal-900">
                  <b>联网核验并生成案例文章</b>
                  <span className="block text-teal-700">
                    先用Tavily核验正式项目名称并补充权威资料，再由DeepSeek按统一业务框架生成文章；失败时自动降级为基础解析。
                  </span>
                </span>
              </label>

              <div className="mt-4 rounded bg-slate-50 p-3 text-xs leading-5 text-slate-500">
                <b className="text-slate-700">低成本模式：</b>项目识别与文章整理使用DeepSeek，联网资料由Tavily Basic Search检索，每个案例最多2次；免费额度内不产生搜索费。文本PDF先在浏览器本地提取，结果只生成待复核草稿。
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
                  <span className="text-xs font-medium text-slate-600">正式项目 / 平台名称 *</span>
                  <input value={caseItem.title} onChange={(event) => updateCanonicalTitle(event.target.value)} className="admin-input" />
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

              {caseItem.identity && caseItem.title && (
                <section className={`rounded border p-4 ${caseItem.identity.needsReview ? "border-amber-200 bg-amber-50/60" : "border-emerald-200 bg-emerald-50/60"}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold text-slate-800">项目身份核验</div>
                      <div className="mt-1 text-xs text-slate-500">
                        原始资料标题：{caseItem.sourceTitle || "未识别"}
                      </div>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${caseItem.identity.needsReview ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
                      名称置信度 {Math.round(caseItem.identity.confidence * 100)}%
                    </span>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-slate-600">{caseItem.identity.reason}</p>
                  {(caseItem.identity.candidates.length > 0 || caseItem.identity.aliases.length > 0) && (
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div>
                        <div className="text-[11px] font-semibold text-slate-500">候选正式名称</div>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {caseItem.identity.candidates.map((candidate) => (
                            <button
                              type="button"
                              key={candidate}
                              onClick={() => updateCanonicalTitle(candidate)}
                              className="rounded border border-slate-200 bg-white px-2 py-1 text-left text-xs text-slate-700 hover:border-teal-400"
                            >
                              {candidate}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] font-semibold text-slate-500">简称 / 别名</div>
                        <div className="mt-1 text-xs leading-5 text-slate-600">
                          {caseItem.identity.aliases.join("、") || "暂无"}
                        </div>
                      </div>
                    </div>
                  )}
                  {caseItem.identity.evidence.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      {caseItem.identity.evidence.map((evidence) => (
                        <a
                          key={`${evidence.url}-${evidence.title}`}
                          href={evidence.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block text-xs leading-5 text-teal-700 hover:underline"
                        >
                          {evidence.title || "名称核验证据"}：{evidence.quote || evidence.url}
                        </a>
                      ))}
                    </div>
                  )}
                  <label className="mt-3 flex items-start gap-2 rounded bg-white/80 p-2.5 text-xs leading-5 text-slate-700">
                    <input
                      type="checkbox"
                      checked={!caseItem.identity.needsReview}
                      onChange={(event) => confirmCanonicalTitle(event.target.checked)}
                      className="mt-0.5 accent-teal-700"
                    />
                    我已对照原始资料和联网证据，确认上方名称是项目、平台或系统的正式名称，不是文件名或文章标题。
                  </label>
                </section>
              )}

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

              {caseItem.article && (
                <section className="rounded border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-slate-800">公开案例文章</div>
                      <div className="mt-1 text-xs text-slate-500">固定业务框架、去重分层，发布后按此结构进入阅读器。</div>
                    </div>
                    <span className="text-xs text-slate-400">
                      {articleCharacterCount(caseItem.article).toLocaleString()} 字符 · {caseItem.article.sections.length} 章
                    </span>
                  </div>
                  <label className="mt-4 block">
                    <span className="text-xs font-medium text-slate-600">导读</span>
                    <textarea
                      value={caseItem.article.standfirst}
                      onChange={(event) => update("article", { ...caseItem.article!, standfirst: event.target.value })}
                      className="admin-textarea mt-1 h-28 bg-white"
                    />
                  </label>
                  <label className="mt-3 block">
                    <span className="text-xs font-medium text-slate-600">关键结论（每行一项）</span>
                    <textarea
                      value={toText(caseItem.article.keyFindings)}
                      onChange={(event) => update("article", { ...caseItem.article!, keyFindings: lines(event.target.value) })}
                      className="admin-textarea mt-1 h-28 bg-white"
                    />
                  </label>
                  <div className="mt-4 space-y-4">
                    {caseItem.article.sections.map((section, index) => (
                      <article key={`${section.id}-${index}`} className="rounded border border-slate-200 bg-white p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-teal-700">{section.id}</div>
                            <h3 className="mt-0.5 text-sm font-semibold text-slate-900">{articleSectionTitles[section.id]}</h3>
                          </div>
                          <button
                            type="button"
                            onClick={() => update("article", { ...caseItem.article!, sections: caseItem.article!.sections.filter((_, sectionIndex) => sectionIndex !== index) })}
                            className="text-xs text-slate-400 hover:text-rose-600"
                          >
                            删除本章
                          </button>
                        </div>
                        <label className="mt-3 block">
                          <span className="text-xs font-medium text-slate-500">本章摘要</span>
                          <input
                            value={section.summary}
                            onChange={(event) => updateArticleSection(index, { summary: event.target.value })}
                            className="admin-input mt-1"
                          />
                        </label>
                        <label className="mt-3 block">
                          <span className="text-xs font-medium text-slate-500">正文段落（空行分段）</span>
                          <textarea
                            value={toParagraphText(section.paragraphs)}
                            onChange={(event) => updateArticleSection(index, { paragraphs: paragraphs(event.target.value) })}
                            className="admin-textarea mt-1 min-h-48"
                          />
                        </label>
                        <label className="mt-3 block">
                          <span className="text-xs font-medium text-slate-500">要点（每行一项）</span>
                          <textarea
                            value={toText(section.points)}
                            onChange={(event) => updateArticleSection(index, { points: lines(event.target.value) })}
                            className="admin-textarea mt-1 h-24"
                          />
                        </label>
                        {section.evidenceRefs.length > 0 && (
                          <div className="mt-2 text-[11px] text-slate-400">证据引用：{section.evidenceRefs.join("、")}</div>
                        )}
                      </article>
                    ))}
                  </div>
                </section>
              )}

              {caseItem.title.trim() && (
                <section className="rounded border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-slate-800">图片证据复核</div>
                      <div className="mt-1 text-xs text-slate-500">
                        AI只根据页码和附近文字完成初步编排；必须查看原图、修改图注并人工确认。
                      </div>
                    </div>
                    <span className="text-xs text-slate-400">
                      {(caseItem.media || []).filter((asset) => asset.included).length} / {caseItem.media?.length} 张入选
                    </span>
                  </div>
                  <div className="mt-4 grid gap-2 rounded border border-sky-100 bg-sky-50/60 p-3 lg:grid-cols-[1fr_1fr_auto]">
                    <label>
                      <span className="text-[11px] font-medium text-slate-600">网页原图地址</span>
                      <input
                        value={manualMediaUrl}
                        onChange={(event) => setManualMediaUrl(event.target.value)}
                        placeholder="https://…/platform-dashboard.jpg"
                        className="admin-input mt-1 bg-white"
                      />
                    </label>
                    <label>
                      <span className="text-[11px] font-medium text-slate-600">图片图注</span>
                      <input
                        value={manualMediaCaption}
                        onChange={(event) => setManualMediaCaption(event.target.value)}
                        placeholder="说明画面内容、时间与来源"
                        className="admin-input mt-1 bg-white"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={addingMedia}
                      onClick={addManualMediaEvidence}
                      className="self-end rounded bg-sky-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      {addingMedia ? "正在保存…" : "加入证据候选"}
                    </button>
                  </div>
                  {(caseItem.media || []).length === 0 && (
                    <p className="mt-3 rounded border border-dashed border-slate-200 p-3 text-xs leading-5 text-slate-500">
                      当前没有图片证据。可从权威网页补充平台界面、驾驶舱、架构图或现场图片；系统会保存原始地址，且必须人工核对后才能发布。
                    </p>
                  )}
                  <div className="mt-4 grid gap-4 xl:grid-cols-2">
                    {caseItem.media?.map((asset, index) => (
                      <article
                        key={asset.id}
                        className={`overflow-hidden rounded border ${asset.included ? "border-slate-200" : "border-slate-200 opacity-55"}`}
                      >
                        <div className="aspect-[16/10] bg-slate-100">
                          <Image
                            src={asset.url}
                            alt={asset.alt || asset.caption}
                            width={1600}
                            height={1000}
                            unoptimized
                            className="h-full w-full object-contain"
                          />
                        </div>
                        <div className="space-y-3 p-3">
                          <div className="flex items-center justify-between gap-3 text-[11px]">
                            <span className="font-medium text-teal-700">
                              {asset.sourceKind === "pdf_page"
                                ? `PDF 第${asset.pageNumber}页`
                                : "网页原图"}
                            </span>
                            <span className="text-slate-400">
                              AI置信度 {Math.round(asset.confidence * 100)}%
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <label>
                              <span className="text-[11px] font-medium text-slate-500">图片类型</span>
                              <select
                                value={asset.kind}
                                onChange={(event) => updateMediaAsset(index, { kind: event.target.value as CaseMediaKind, reviewed: false })}
                                className="admin-input mt-1"
                              >
                                {Object.entries(mediaKindLabels).map(([value, label]) => (
                                  <option key={value} value={value}>{label}</option>
                                ))}
                              </select>
                            </label>
                            <label>
                              <span className="text-[11px] font-medium text-slate-500">插入章节</span>
                              <select
                                value={asset.sectionId}
                                onChange={(event) => updateMediaAsset(index, { sectionId: event.target.value as CaseMediaPlanItem["sectionId"], reviewed: false })}
                                className="admin-input mt-1"
                              >
                                {articleSectionOrder.map((sectionId) => (
                                  <option key={sectionId} value={sectionId}>{articleSectionTitles[sectionId]}</option>
                                ))}
                              </select>
                            </label>
                          </div>
                          <label className="block">
                            <span className="text-[11px] font-medium text-slate-500">图注</span>
                            <textarea
                              value={asset.caption}
                              onChange={(event) => updateMediaAsset(index, { caption: event.target.value, reviewed: false })}
                              className="admin-textarea mt-1 h-20"
                            />
                          </label>
                          <label className="block">
                            <span className="text-[11px] font-medium text-slate-500">图片内容说明（无障碍文本）</span>
                            <input
                              value={asset.alt}
                              onChange={(event) => updateMediaAsset(index, { alt: event.target.value, reviewed: false })}
                              className="admin-input mt-1"
                            />
                          </label>
                          <p className="rounded bg-slate-50 p-2 text-[11px] leading-5 text-slate-500">{asset.reason}</p>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <label className="flex items-center gap-2 text-xs text-slate-600">
                              <input
                                type="checkbox"
                                checked={asset.included}
                                onChange={(event) => updateMediaAsset(index, { included: event.target.checked, reviewed: false })}
                                className="accent-teal-700"
                              />
                              收录到公开文章
                            </label>
                            <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                              <input
                                type="checkbox"
                                checked={asset.reviewed}
                                disabled={!asset.included}
                                onChange={(event) => updateMediaAsset(index, { reviewed: event.target.checked, needsReview: !event.target.checked })}
                                className="accent-teal-700"
                              />
                              已核对原图、图注与章节
                            </label>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              )}

              {caseItem.researchReport && (
                <details className="rounded border border-slate-200 p-4">
                  <summary className="cursor-pointer text-xs font-medium text-slate-600">旧版 Markdown 研究报告（兼容内容）</summary>
                  <textarea
                    value={caseItem.researchReport}
                    onChange={(event) => update("researchReport", event.target.value)}
                    className="admin-textarea mt-3 min-h-72"
                  />
                </details>
              )}
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
                      {parseMeta && (
                        <div className="text-[11px] text-slate-400">
                          {providerLabels[parseMeta.provider]} · {parseMeta.model}
                        </div>
                      )}
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
                {caseItem.parsePipeline && (
                  <div className="rounded border border-sky-200 bg-sky-50/60 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs font-semibold text-sky-900">AI 解析任务链</div>
                      <div className="text-[11px] text-sky-700">
                        {caseItem.parsePipeline.status === "completed" ? "完整完成" : "已降级完成"}
                      </div>
                    </div>
                    <ol className="mt-2 space-y-2">
                      {caseItem.parsePipeline.stages.map((stage, index) => (
                        <li key={stage.id} className="flex gap-2 text-xs leading-5">
                          <span
                            className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold ${
                              stage.status === "completed"
                                ? "bg-emerald-500 text-white"
                                : stage.status === "degraded"
                                  ? "bg-amber-500 text-white"
                                  : stage.status === "pending"
                                    ? "bg-sky-500 text-white"
                                    : "bg-slate-300 text-slate-700"
                            }`}
                          >
                            {index + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center justify-between gap-x-2">
                              <div className="font-medium text-slate-700">{stage.label}</div>
                              {(stage.provider || stage.durationMs > 0) && (
                                <div className="text-[10px] text-slate-400">
                                  {[stage.provider, stage.model, stage.durationMs > 0 ? `${(stage.durationMs / 1000).toFixed(1)}s` : ""]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </div>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500">{stage.message}</div>
                            {(stage.inputSummary || stage.outputSummary) && (
                              <div className="mt-1 rounded border border-sky-100 bg-white/70 px-2 py-1 text-[10px] leading-4 text-slate-500">
                                {stage.inputSummary && <div>输入：{stage.inputSummary}</div>}
                                {stage.outputSummary && <div>输出：{stage.outputSummary}</div>}
                              </div>
                            )}
                            {((stage.inputTokens || 0) > 0 || (stage.estimatedCostCny || 0) > 0) && (
                              <div className="mt-1 text-[10px] text-slate-400">
                                输入 {(stage.inputTokens || 0).toLocaleString()} · 输出 {(stage.outputTokens || 0).toLocaleString()} tokens
                                {` · 估算 ¥${(stage.estimatedCostCny || 0).toFixed(4)}`}
                              </div>
                            )}
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
                {caseItem.contentModel && (
                  <div className="rounded border border-indigo-200 bg-indigo-50/50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold text-indigo-900">Digital X 内容规范质量</div>
                        <div className="mt-0.5 text-[10px] text-indigo-600">
                          {caseItem.contentModel.generationMode === "native"
                            ? "V1.0 原生解析协议"
                            : "兼容模型转换"}
                        </div>
                      </div>
                      <div className="text-sm font-bold text-indigo-700">
                        {caseItem.contentModel.quality.score}/100
                      </div>
                    </div>
                    <div className="mt-2 text-[11px] leading-5 text-slate-600">
                      七章内容 {caseItem.contentModel.editorialSections.length} · 事实陈述 {caseItem.contentModel.claims.length} ·
                      来源 {caseItem.contentModel.sources.length} · 主体 {caseItem.contentModel.organizations.length} ·
                      数据 {caseItem.contentModel.dataAssets.length} · 场景 {caseItem.contentModel.scenarios.length} ·
                      指标 {caseItem.contentModel.metrics.length}
                    </div>
                    {caseItem.contentModel.quality.blockingIssues.length > 0 && (
                      <ul className="mt-2 space-y-1 text-[11px] leading-4 text-rose-700">
                        {caseItem.contentModel.quality.blockingIssues.map((issue) => (
                          <li key={issue}>• {issue}</li>
                        ))}
                      </ul>
                    )}
                    {caseItem.contentModel.quality.warnings.length > 0 && (
                      <ul className="mt-2 space-y-1 text-[11px] leading-4 text-amber-700">
                        {caseItem.contentModel.quality.warnings.map((warning) => (
                          <li key={warning}>• {warning}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
                {caseItem.contentMigration && (
                  <div className="rounded border border-cyan-200 bg-cyan-50/50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold text-cyan-950">V1.5 内容终审门槛</div>
                        <div className="mt-0.5 text-[10px] text-cyan-700">
                          {caseItem.contentMigration.batchId} · {caseItem.contentMigration.benchmark ? "标杆案例" : "批量迁移案例"}
                        </div>
                      </div>
                      <span className="rounded bg-white px-2 py-1 text-[10px] font-semibold text-cyan-800">
                        {caseItem.contentMigration.reviewGates.filter((gate) => gate.status === "approved").length}/6 已批准
                      </span>
                    </div>
                    <div className="mt-3 space-y-2">
                      {caseItem.contentMigration.reviewGates.map((gate) => (
                        <div key={gate.id} className="rounded border border-cyan-100 bg-white p-2.5">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-[11px] font-semibold text-slate-700">{gate.label}</div>
                              <div className="mt-0.5 text-[10px] leading-4 text-slate-500">{gate.note}</div>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                updateMigrationReviewGate(
                                  gate.id,
                                  gate.status === "approved" ? "needs_work" : "approved",
                                )
                              }
                              className={`shrink-0 rounded px-2 py-1 text-[10px] font-semibold ${
                                gate.status === "approved"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {gate.status === "approved" ? "已批准" : `待处理 ${gate.issueCount || ""}`}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-[10px] leading-4 text-cyan-800">
                      六项门槛全部批准后才能形成 approved 版本；按钮代表内容负责人已完成核对，不由 AI 自动代签。
                    </p>
                    {caseItem.contentMigration.production && (() => {
                      const production = caseItem.contentMigration.production;
                      const readiness = productionReadiness(caseItem);
                      const advance = canAdvanceProduction(caseItem);
                      return (
                        <div className="mt-3 rounded border border-cyan-100 bg-white p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <div className="text-[10px] font-semibold text-cyan-900">
                                {production.release} · {production.waveLabel}
                              </div>
                              <div className="mt-1 text-xs font-semibold text-slate-800">
                                {productionStageLabels[production.stage]}
                              </div>
                            </div>
                            <span className="rounded bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">
                              {production.priority}
                            </span>
                          </div>
                          <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                            <div className="rounded bg-slate-50 p-2">
                              <strong className="block text-xs">{readiness.sourceCount}/{production.targetSourceCount}</strong>
                              <span className="text-[9px] text-slate-500">来源</span>
                            </div>
                            <div className="rounded bg-slate-50 p-2">
                              <strong className="block text-xs">{readiness.characters}/{production.targetCharacterCount}</strong>
                              <span className="text-[9px] text-slate-500">正文</span>
                            </div>
                            <div className="rounded bg-slate-50 p-2">
                              <strong className="block text-xs">{readiness.qualityScore}</strong>
                              <span className="text-[9px] text-slate-500">质量分</span>
                            </div>
                          </div>
                          <p className="mt-2 text-[10px] leading-4 text-slate-600">
                            下一步：{production.nextAction}
                          </p>
                          {!advance.allowed && (
                            <p className="mt-2 rounded bg-amber-50 px-2 py-1.5 text-[10px] leading-4 text-amber-800">
                              当前阻断：{advance.reason}
                            </p>
                          )}
                          {production.stage !== "approved" && (
                            <button
                              type="button"
                              onClick={advanceCurrentProduction}
                              className="mt-2 w-full rounded border border-cyan-200 px-3 py-2 text-[11px] font-semibold text-cyan-800 hover:bg-cyan-50"
                            >
                              推进到下一生产阶段
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
                {parseMeta && (
                  <div className="rounded bg-slate-50 p-2.5 text-[11px] leading-5 text-slate-500">
                    本次调用：输入 {parseMeta.inputTokens.toLocaleString()} tokens · 输出 {parseMeta.outputTokens.toLocaleString()} tokens
                    {parseMeta.researchMode ? ` · 联网检索 ${parseMeta.searchQueryCount} 组` : ""}
                    {` · 估算费用 ¥${parseMeta.estimatedCostCny.toFixed(4)}`}
                    {parseMeta.fallbackUsed ? " · 部分阶段已降级" : " · 原生任务链完整完成"}
                  </div>
                )}
                {(caseItem.researchSources?.length || 0) > 0 && (
                  <div className="rounded border border-slate-200 p-3">
                    <div className="text-xs font-semibold text-slate-700">
                      联网来源（{caseItem.researchSources?.length}）
                    </div>
                    <ul className="mt-2 space-y-2 text-xs leading-5">
                      {caseItem.researchSources?.map((source) => (
                        <li key={source.url}>
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-teal-700 underline decoration-teal-200 underline-offset-2 hover:text-teal-900"
                          >
                            {source.title || source.url}
                          </a>
                        </li>
                      ))}
                    </ul>
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
                  AI 会优先采用原文位置；只明确省份时，以省会城市中心作为地图展示锚点。所有推断位置仍需人工确认。
                  {caseItem.locationReason ? ` 当前说明：${caseItem.locationReason}` : ""}
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

        <ContentProductionBoard cases={combinedCases} onEdit={editCase} />

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
              {combinedCases.map((item) => {
                const isLocal = localCases.some((local) => local.id === item.id);
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
                      ) : item.contentMigration ? (
                        <button onClick={() => editCase(item)} className="text-xs font-medium text-cyan-700 hover:underline">
                          {item.contentMigration.benchmark ? "进入终审" : "审核迁移"}
                        </button>
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
