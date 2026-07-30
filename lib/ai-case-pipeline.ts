import type { CaseParserResponse } from "./ai-case-parser";
import {
  nativeIdentityPrompt,
  nativeIdentityToParserOutput,
  nativeArticlePrompt,
  nativeArticleToLegacy,
  nativeEvidencePrompt,
  normalizeNativeArticlePackage,
  normalizeNativeEvidencePackage,
  normalizeNativeIdentityPackage,
  type NativeArticlePackage,
  type NativeEvidencePackage,
} from "./ai-case-native-protocol";
import {
  parseCaseWithProvider,
  normalizeExternalParserOutput,
  requestDeepSeekJson,
  researchCaseSources,
  type CaseResearchBundle,
  type NativeJsonResult,
  type ProviderInput,
  type ProviderResult,
} from "./ai-case-parser-providers";
import {
  evaluateCaseQuality,
  normalizeCaseContentModel,
} from "./case-content-model";
import type {
  CaseContentModel,
  CaseContentSource,
  CasePipelineRun,
  CasePipelineStage,
  CasePipelineStageId,
  SmartCityCase,
} from "./case-model";

const stageLabels: Record<CasePipelineStageId, string> = {
  input_validation: "输入校验",
  source_extraction: "原始资料提取",
  project_identity: "项目身份核验",
  web_research: "联网资料研究",
  fact_evidence_extraction: "事实与证据抽取",
  article_generation: "规范化内容生成",
  quality_review: "质量规则检查",
  human_review_pending: "等待人工复核",
};

function stage(
  id: CasePipelineStageId,
  status: CasePipelineStage["status"],
  message: string,
  durationMs = 0,
  details: Partial<CasePipelineStage> = {},
): CasePipelineStage {
  return {
    id,
    label: stageLabels[id],
    status,
    message,
    durationMs,
    ...details,
  };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "阶段执行失败。";
}

function cleanProvisionalTitle(value: string) {
  let candidate = value
    .trim()
    .replace(/^#{1,6}\s*/, "")
    .replace(/^(?:案例名称|项目名称|来源标题|文章标题|标题)\s*[:：]\s*/i, "")
    .replace(/^["“‘']+|["”’']+$/g, "")
    .trim();
  const promotionalBreak = Math.max(
    candidate.lastIndexOf("！"),
    candidate.lastIndexOf("!"),
  );
  if (promotionalBreak >= 0 && promotionalBreak < candidate.length - 1) {
    candidate = candidate.slice(promotionalBreak + 1).trim();
  }
  candidate = candidate
    .replace(
      /(?:正式)?(?:上线|发布|启动|启用|亮相|获奖|入选)(?:[！!。.]*)$/,
      "",
    )
    .trim();
  if (
    candidate.length < 4 ||
    candidate.length > 100 ||
    !/(?:平台|系统|项目|工程|中心|应用)$/.test(candidate)
  ) {
    return "";
  }
  return candidate;
}

function provisionalTitleFromSource(
  input: ProviderInput,
  basic: ProviderResult,
) {
  const candidates = [
    ...basic.result.identity.candidates,
    basic.result.case.sourceTitle,
    ...input.sourceText.split(/\r?\n/).slice(0, 8),
  ];
  for (const item of candidates) {
    const normalized = cleanProvisionalTitle(item || "");
    if (normalized) return normalized;
  }
  return "";
}

function toDraftCase(
  result: ProviderResult,
  input: ProviderInput,
): SmartCityCase {
  const parsed = result.result.case;
  return {
    ...parsed,
    id: "pipeline-draft",
    slug: "pipeline-draft",
    status: "草稿",
    sourceNote: "由 AI 解析任务链生成，发布前必须完成人工复核。",
    sourceUrl: input.sourceUrl,
    researchSources: result.result.researchSources,
    researchQueries: result.result.researchQueries,
    identity: result.result.identity,
    article: result.result.article,
    media: [],
  };
}

function buildContentSources(
  basic: ProviderResult,
  input: ProviderInput,
  research: CaseResearchBundle | null,
): CaseContentSource[] {
  const sources: CaseContentSource[] = [];
  if (input.sourceText.trim() || input.file || input.sourceUrl) {
    sources.push({
      id: "source-original",
      title:
        basic.result.case.sourceTitle?.trim() ||
        input.file?.name ||
        "用户导入的原始资料",
      url: input.sourceUrl.trim(),
      publisher: "",
      publishedAt: "",
      sourceType: "原始资料",
      excerpt:
        basic.result.case.sourceExcerpt?.trim() ||
        input.sourceText.trim().slice(0, 600),
      evidenceLevel: basic.result.case.evidenceLevel,
      reviewed: false,
    });
  }
  for (const source of research?.sources || []) {
    if (!source.url.startsWith("http")) continue;
    if (sources.some((item) => item.url && item.url === source.url)) continue;
    sources.push({
      id: `source-${sources.filter((item) => /^source-\d+$/.test(item.id)).length + 1}`,
      title: source.title || source.url,
      url: source.url,
      publisher: "",
      publishedAt: "",
      sourceType: "其他",
      excerpt: "",
      evidenceLevel: basic.result.case.evidenceLevel,
      reviewed: false,
    });
  }
  return sources;
}

function nativeContentModel(
  item: SmartCityCase,
  sources: CaseContentSource[],
  evidence: NativeEvidencePackage,
  article: NativeArticlePackage,
): CaseContentModel {
  const withoutQuality: Omit<CaseContentModel, "quality"> = {
    schemaVersion: "1.0",
    generationMode: "native",
    contentLevel: article.contentLevel,
    editorialSections: article.sections,
    sources,
    claims: evidence.claims,
    organizations: evidence.organizations,
    dataAssets: evidence.dataAssets,
    scenarios: evidence.scenarios,
    metrics: evidence.metrics,
    milestones: evidence.milestones,
    limitations: evidence.limitations,
    replicationConditions: evidence.replicationConditions,
    manualReviewStatus: "pending",
  };
  return {
    ...withoutQuality,
    quality: evaluateCaseQuality(item, withoutQuality),
  };
}

function usageDetails(result: NativeJsonResult<unknown>) {
  return {
    provider: result.provider,
    model: result.model,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    estimatedCostCny: result.estimatedCostCny,
    attempts: 1,
    retryable: true,
  } satisfies Partial<CasePipelineStage>;
}

export async function runCaseParserPipeline(
  input: ProviderInput,
): Promise<CaseParserResponse> {
  const startedAt = new Date();
  const stages: CasePipelineStage[] = [
    stage(
      "input_validation",
      "completed",
      "资料类型、大小和输入长度已通过校验。",
      0,
      {
        inputSummary: input.file
          ? `PDF：${input.file.name}（${input.file.size} bytes）`
          : `正文：${input.sourceText.length.toLocaleString()} 字符`,
        outputSummary: "输入可进入解析任务链。",
        retryable: false,
      },
    ),
    stage(
      "source_extraction",
      "completed",
      input.sourceText.trim()
        ? "已接收浏览器提取或粘贴的正文。"
        : "扫描 PDF 将由视觉模型读取；原文件仍保留为来源。",
      0,
      {
        inputSummary: input.file ? "原始PDF" : "已提取文本",
        outputSummary: input.sourceText.trim()
          ? `${input.sourceText.length.toLocaleString()} 字符可供分析`
          : "等待视觉模型读取",
        retryable: Boolean(input.file),
      },
    ),
  ];

  const basicStartedAt = Date.now();
  let basicFallbackReason = "";
  let basic: ProviderResult;
  if (input.sourceText.trim()) {
    try {
      const identityResult = await requestDeepSeekJson<unknown>(
        nativeIdentityPrompt({
          sourceText: input.sourceText,
          sourceUrl: input.sourceUrl,
          mediaCandidates: input.mediaCandidates || [],
        }),
        8_000,
      );
      const identityPackage = normalizeNativeIdentityPackage(
        identityResult.value,
      );
      basic = {
        provider: identityResult.provider,
        model: identityResult.model,
        responseId: identityResult.responseId,
        inputTokens: identityResult.inputTokens,
        outputTokens: identityResult.outputTokens,
        researchMode: false,
        searchQueryCount: 0,
        estimatedCostCny: identityResult.estimatedCostCny,
        fallbackUsed: false,
        fallbackReason: "",
        result: normalizeExternalParserOutput(
          nativeIdentityToParserOutput(identityPackage),
        ),
      };
    } catch (error) {
      basicFallbackReason = `原生身份协议生成失败，已使用兼容解析：${errorMessage(error)}`;
      basic = await parseCaseWithProvider({
        ...input,
        researchMode: false,
      });
    }
  } else {
    basicFallbackReason =
      "扫描PDF需要先由视觉模型完成识别，身份阶段使用兼容视觉协议。";
    basic = await parseCaseWithProvider({
      ...input,
      researchMode: false,
    });
  }
  if (
    basic.result.compatible &&
    !basic.result.identity.canonicalTitle.trim() &&
    !basic.result.case.title.trim()
  ) {
    const provisionalTitle = provisionalTitleFromSource(input, basic);
    if (provisionalTitle) {
      basic.result.case.title = provisionalTitle;
      basic.result.identity = {
        ...basic.result.identity,
        canonicalTitle: provisionalTitle,
        candidates: Array.from(
          new Set([
            provisionalTitle,
            ...basic.result.identity.candidates,
          ]),
        ),
        confidence: Math.min(
          basic.result.identity.confidence || 0.45,
          0.45,
        ),
        needsReview: true,
        reason:
          basic.result.identity.reason ||
          "模型未确认正式名称，暂采用原始资料中的项目名称候选，必须通过联网证据或人工复核确认。",
      };
      basic.result.reviewItems = Array.from(
        new Set([
          ...basic.result.reviewItems,
          "核验原始资料候选名称是否为正式项目名称。",
        ]),
      );
    }
  }
  const basicDuration = Date.now() - basicStartedAt;
  const identity = basic.result.identity;
  stages.push(
    stage(
      "project_identity",
      identity.needsReview || basicFallbackReason ? "degraded" : "completed",
      basicFallbackReason
        ? `${basicFallbackReason} 当前候选名称为“${identity.canonicalTitle}”。`
        : identity.needsReview
        ? `已形成候选正式名称“${identity.canonicalTitle}”，仍需联网或人工确认。`
        : `已从原始资料识别项目名称“${identity.canonicalTitle}”。`,
      basicDuration,
      {
        provider: basic.provider,
        model: basic.model,
        inputTokens: basic.inputTokens,
        outputTokens: basic.outputTokens,
        estimatedCostCny: basic.estimatedCostCny,
        attempts: 1,
        inputSummary: "原始资料、来源网址和图片候选",
        outputSummary: `${identity.candidates.length} 个名称候选、基础字段草稿和 ${basic.result.mediaPlan.length} 个图片编排候选`,
        retryable: true,
      },
    ),
  );

  if (!basic.result.compatible) {
    const identityStage = stages.find(
      (item) => item.id === "project_identity",
    );
    if (identityStage) {
      identityStage.status = "blocked";
      identityStage.message = `兼容性判断未通过：${
        basic.result.incompatibilityReason || "资料不属于可入库的城市数智应用案例。"
      }`;
      identityStage.outputSummary = "未识别到可入库的有效项目名称";
    }
    stages.push(
      stage(
        "web_research",
        "skipped",
        "资料未通过案例兼容性判断，不继续产生联网搜索费用。",
        0,
        {
          inputSummary: "不兼容资料",
          outputSummary: "未执行联网请求",
          retryable: false,
        },
      ),
      stage(
        "fact_evidence_extraction",
        "skipped",
        "资料不属于可入库的城市数字化案例，未生成证据包。",
      ),
      stage(
        "article_generation",
        "skipped",
        "未生成案例正文。",
      ),
      stage(
        "quality_review",
        "blocked",
        basic.result.incompatibilityReason || "资料不符合案例库入库范围。",
      ),
      stage(
        "human_review_pending",
        "skipped",
        "请更换资料后重新解析。",
      ),
    );
    const rejectedDraft = normalizeCaseContentModel(
      toDraftCase(basic, input),
    );
    return {
      result: {
        ...basic.result,
        contentModel: rejectedDraft.contentModel,
      },
      meta: {
        provider: basic.provider,
        model: basic.model,
        responseId: basic.responseId,
        inputTokens: basic.inputTokens,
        outputTokens: basic.outputTokens,
        researchMode: false,
        searchQueryCount: 0,
        estimatedCostCny: basic.estimatedCostCny,
        fallbackUsed: Boolean(basicFallbackReason),
        fallbackReason: basicFallbackReason,
        pipeline: {
          version: "1.1",
          startedAt: startedAt.toISOString(),
          completedAt: new Date().toISOString(),
          status: "blocked",
          stages,
        },
      },
    };
  }

  let research: CaseResearchBundle | null = null;
  let researchFallbackReason = "";
  if (!input.researchMode) {
    stages.push(
      stage("web_research", "skipped", "本次未开启联网研究。", 0, {
        inputSummary: "联网研究关闭",
        outputSummary: "仅使用原始资料",
        retryable: true,
      }),
    );
  } else {
    const researchStartedAt = Date.now();
    try {
      research = await researchCaseSources(input, basic);
      stages.push(
        stage(
          "web_research",
          "completed",
          `已执行 ${research.queries.length} 组独立检索，并保留 ${research.sources.length} 个来源。`,
          Date.now() - researchStartedAt,
          {
            provider: research.provider,
            estimatedCostCny: research.estimatedCostCny,
            attempts: 1,
            inputSummary: `规范名称、地区、主体和建设内容；最多 ${research.queries.length} 组查询`,
            outputSummary: `${research.sources.length} 个去重来源及可引用摘要`,
            retryable: true,
          },
        ),
      );
    } catch (error) {
      researchFallbackReason = errorMessage(error);
      stages.push(
        stage(
          "web_research",
          "degraded",
          `联网研究暂不可用，后续阶段仅使用原始资料：${researchFallbackReason}`,
          Date.now() - researchStartedAt,
          {
            attempts: 1,
            inputSummary: "项目身份与证据检索计划",
            outputSummary: "未获得联网来源，保留基础解析草稿",
            retryable: true,
          },
        ),
      );
    }
  }

  const sources = buildContentSources(basic, input, research);
  const availableSources = sources.map(({ id, title, url }) => ({
    id,
    title,
    url,
  }));
  let evidenceResult: NativeJsonResult<unknown> | null = null;
  let evidence: NativeEvidencePackage | null = null;
  const evidenceStartedAt = Date.now();
  try {
    evidenceResult = await requestDeepSeekJson<unknown>(
      nativeEvidencePrompt({
        sourceText: input.sourceText,
        sourceUrl: input.sourceUrl,
        baseDraft: {
          case: basic.result.case,
          identity: basic.result.identity,
          fieldAssessments: basic.result.fieldAssessments,
        },
        researchContext: research?.context || "",
        availableSources,
      }),
      12_000,
    );
    evidence = normalizeNativeEvidencePackage(
      evidenceResult.value,
      sources.map((source) => source.id),
    );
    if (evidence.identityResolution.canonicalTitle) {
      const sourceById = new Map(sources.map((source) => [source.id, source]));
      basic.result.identity = {
        canonicalTitle: evidence.identityResolution.canonicalTitle,
        candidates: evidence.identityResolution.candidates,
        aliases: evidence.identityResolution.aliases,
        confidence: evidence.identityResolution.confidence,
        needsReview: evidence.identityResolution.needsReview,
        reason: evidence.identityResolution.reason,
        evidence: evidence.identityResolution.evidence.map((item) => ({
          title: sourceById.get(item.sourceId)?.title || item.sourceId,
          url: sourceById.get(item.sourceId)?.url || "",
          quote: item.quote,
        })),
      };
      basic.result.case.title = evidence.identityResolution.canonicalTitle;
      const identityStage = stages.find(
        (item) => item.id === "project_identity",
      );
      if (identityStage) {
        identityStage.status = evidence.identityResolution.needsReview
          ? "degraded"
          : "completed";
        identityStage.message = evidence.identityResolution.needsReview
          ? `联网证据仍不足以唯一确认名称，暂采用“${evidence.identityResolution.canonicalTitle}”。`
          : `已用原始资料与联网证据确认正式名称“${evidence.identityResolution.canonicalTitle}”。`;
        identityStage.outputSummary = `${evidence.identityResolution.evidence.length} 条名称证据，置信度 ${Math.round(evidence.identityResolution.confidence * 100)}%`;
      }
    }
    stages.push(
      stage(
        "fact_evidence_extraction",
        evidence.claims.some((claim) => claim.sourceIds.length > 0)
          ? "completed"
          : "degraded",
        `原生协议生成 ${evidence.claims.length} 条陈述、${evidence.organizations.length} 个主体、${evidence.dataAssets.length} 类数据和 ${evidence.metrics.length} 项指标。`,
        Date.now() - evidenceStartedAt,
        {
          ...usageDetails(evidenceResult),
          inputSummary: `${sources.length} 个可用来源、基础字段草稿和联网摘要`,
          outputSummary: `${evidence.claims.filter((claim) => claim.sourceIds.length > 0).length} 条陈述建立来源关联，${evidence.reviewItems.length} 项待核验`,
        },
      ),
    );
  } catch (error) {
    stages.push(
      stage(
        "fact_evidence_extraction",
        "degraded",
        `原生证据协议生成失败，已回退兼容提取：${errorMessage(error)}`,
        Date.now() - evidenceStartedAt,
        {
          attempts: 1,
          inputSummary: `${sources.length} 个可用来源和基础字段草稿`,
          outputSummary: "使用alpha.1兼容层生成证据候选",
          retryable: true,
        },
      ),
    );
  }

  let articleResult: NativeJsonResult<unknown> | null = null;
  let nativeArticle: NativeArticlePackage | null = null;
  if (evidence) {
    const articleStartedAt = Date.now();
    try {
      articleResult = await requestDeepSeekJson<unknown>(
        nativeArticlePrompt({
          baseDraft: {
            case: basic.result.case,
            identity: basic.result.identity,
          },
          evidence,
          availableSources,
          mediaCandidateIds: (input.mediaCandidates || []).map(
            (candidate) => candidate.id,
          ),
        }),
        16_000,
      );
      nativeArticle = normalizeNativeArticlePackage(
        articleResult.value,
        evidence.claims.map((claim) => claim.id),
      );
      const substantiveSectionCount = nativeArticle.sections.filter(
        (section) =>
          section.claimIds.length > 0 &&
          Boolean(
            section.summary.trim() ||
              section.paragraphs.some((paragraph) => paragraph.trim()) ||
              section.points.some((point) => point.trim()),
          ),
      ).length;
      stages.push(
        stage(
          "article_generation",
          substantiveSectionCount === 7 ? "completed" : "degraded",
          `已生成固定七章结构，其中 ${substantiveSectionCount} 章获得事实陈述支撑，内容等级为 ${nativeArticle.contentLevel}。`,
          Date.now() - articleStartedAt,
          {
            ...usageDetails(articleResult),
            inputSummary: `${evidence.claims.length} 条陈述、${evidence.scenarios.length} 个业务场景和 ${evidence.metrics.length} 项指标`,
            outputSummary: `7 个固定章节、${substantiveSectionCount} 个实质章节、${nativeArticle.keyFindings.length} 条关键结论`,
          },
        ),
      );
    } catch (error) {
      stages.push(
        stage(
          "article_generation",
          "degraded",
          `原生七章写作失败，已保留基础结构化文章：${errorMessage(error)}`,
          Date.now() - articleStartedAt,
          {
            attempts: 1,
            inputSummary: "原生事实证据包",
            outputSummary: `${basic.result.article.sections.length} 个兼容章节`,
            retryable: true,
          },
        ),
      );
    }
  } else {
    stages.push(
      stage(
        "article_generation",
        "degraded",
        "事实证据阶段已降级，正文保留基础模型结果，避免在无证据包时继续扩写。",
        0,
        {
          inputSummary: "兼容证据候选",
          outputSummary: `${basic.result.article.sections.length} 个兼容章节`,
          retryable: true,
        },
      ),
    );
  }

  const researchSources = research?.sources || [];
  const researchQueries = research?.queries || [];
  const article =
    evidence && nativeArticle
      ? nativeArticleToLegacy(nativeArticle, evidence.claims)
      : basic.result.article;
  const draftBase: SmartCityCase = {
    ...toDraftCase(basic, input),
    article,
    researchSources,
    researchQueries,
  };
  let finalDraft: SmartCityCase;
  if (evidence && nativeArticle) {
    finalDraft = {
      ...draftBase,
      contentModel: nativeContentModel(
        draftBase,
        sources,
        evidence,
        nativeArticle,
      ),
    };
  } else {
    finalDraft = normalizeCaseContentModel(draftBase);
  }
  const contentModel = finalDraft.contentModel;
  if (!contentModel) throw new Error("案例内容模型生成失败。");

  stages.push(
    stage(
      "quality_review",
      contentModel.quality.score >= 70 ? "completed" : "degraded",
      `规范质量评分 ${contentModel.quality.score}/100；发现 ${contentModel.quality.blockingIssues.length} 项发布阻断和 ${contentModel.quality.warnings.length} 项改进建议。`,
      0,
      {
        inputSummary: `${contentModel.claims.length} 条陈述、${contentModel.editorialSections.length} 个章节和 ${contentModel.sources.length} 个来源`,
        outputSummary: `${contentModel.quality.blockingIssues.length} 项阻断、${contentModel.quality.warnings.length} 项建议`,
        retryable: false,
      },
    ),
    stage(
      "human_review_pending",
      "pending",
      "AI 只生成待复核草稿；正式名称、证据、图片、指标和位置需人工确认。",
      0,
      {
        inputSummary: "AI规范草稿",
        outputSummary: "等待人工复核与发布决定",
        retryable: false,
      },
    ),
  );

  const status: CasePipelineRun["status"] = stages.some(
    (item) => item.status === "blocked",
  )
    ? "blocked"
    : stages.some((item) => item.status === "degraded")
      ? "degraded"
      : "completed";
  const pipeline: CasePipelineRun = {
    version: "1.1",
    startedAt: startedAt.toISOString(),
    completedAt: new Date().toISOString(),
    status,
    stages,
  };
  const nativeResults = [evidenceResult, articleResult].filter(
    (item): item is NativeJsonResult<unknown> => Boolean(item),
  );
  const inputTokens =
    basic.inputTokens +
    nativeResults.reduce((total, item) => total + item.inputTokens, 0);
  const outputTokens =
    basic.outputTokens +
    nativeResults.reduce((total, item) => total + item.outputTokens, 0);
  const estimatedCostCny = Number(
    (
      basic.estimatedCostCny +
      (research?.estimatedCostCny || 0) +
      nativeResults.reduce(
        (total, item) => total + item.estimatedCostCny,
        0,
      )
    ).toFixed(4),
  );
  const fallbackReasons = [
    basicFallbackReason,
    researchFallbackReason,
    evidence ? "" : "事实证据阶段使用兼容提取",
    nativeArticle ? "" : "正文阶段保留基础结构化文章",
  ].filter(Boolean);

  return {
    result: {
      ...basic.result,
      case: {
        ...basic.result.case,
        researchReport: "",
      },
      article,
      reviewItems: Array.from(
        new Set([
          ...basic.result.reviewItems,
          ...(evidence?.reviewItems || []),
          ...contentModel.quality.blockingIssues,
        ]),
      ),
      researchSources,
      researchQueries,
      contentModel,
    },
    meta: {
      provider: basic.provider,
      model: [
        basic.model,
        ...Array.from(new Set(nativeResults.map((item) => item.model))),
      ].join(" → "),
      responseId:
        articleResult?.responseId ||
        evidenceResult?.responseId ||
        basic.responseId,
      inputTokens,
      outputTokens,
      researchMode: input.researchMode,
      searchQueryCount: researchQueries.length,
      estimatedCostCny,
      fallbackUsed: fallbackReasons.length > 0,
      fallbackReason: fallbackReasons.join("；"),
      pipeline,
    },
  };
}
