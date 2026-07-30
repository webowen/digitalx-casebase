import {
  DEEPSEEK_CASE_PARSER_MODEL,
  DEFAULT_AI_CASE_PARSER_PROVIDER,
  GEMINI_CASE_PARSER_MODEL,
  MAX_RESEARCH_SEARCH_CALLS,
  OPENAI_CASE_PARSER_MODEL,
  QWEN_CASE_PARSER_MODEL,
  caseParserJsonSchema,
  type AiCaseParserProvider,
  type CaseParserOutput,
} from "./ai-case-parser";
import {
  articleCharacterCount,
  normalizeArticle,
  normalizeIdentity,
} from "./case-editorial";
import type {
  CaseArticle,
  CaseMediaCandidate,
  CaseMediaPlanItem,
} from "./case-model";
import { applyLocationFallback } from "./location-resolution";

export const parserInstructions = `你是 DigitalX 城市数智应用案例库的资料解析器。你的任务是从用户提供的原始资料中提取可复核的智慧城市案例草稿。

必须遵守：
1. 原始资料明确提供的事实优先；联网研究资料只能作为补充，并必须保留可验证来源。
2. 未明确的信息使用空字符串、空数组或 year=0，不得猜测单位、金额、成效和时间。
3. sourceTitle 是资料、文件或网页的原始标题；title 必须是案例对应的具体项目、平台或系统正式名称，绝不能直接照抄文件名、文章标题、宣传标题或“某某案例”等泛称。
4. sourceExcerpt 和每项 evidence 必须是原始资料中可定位的短摘录，不得改写成不存在的引文。
5. “成效”必须区分已实现成果和预期目标；只有明确的验收数据或已发生结果才可作为强证据。
6. expertView 只写需要进一步核验的专业判断，不得把推测写成结论。
7. fieldAssessments 覆盖关键字段，confidence 为 0 到 1；证据不足时 needsReview=true。
8. 如果输入不是智慧城市、城市治理或城市数字化项目资料，compatible=false，并说明原因；仍按 schema 返回空白案例对象。
9. AI 只生成草稿，最终内容必须由人工复核后发布。`;

const identityInstructions = `项目身份核验规则：
1. identity.canonicalTitle 必须填写现有证据支持的具体项目、平台或系统名称，并与 case.title 保持一致。
2. identity.candidates 返回从原文、单位、地区、产品名和搜索结果识别出的候选正式名称；identity.aliases 返回简称、曾用名或宣传称呼。
3. 原始资料标题只写入 case.sourceTitle，不能自动成为案例名称。
4. 开启联网研究时，必须利用政府官网、招投标、建设单位或权威媒体结果交叉核验名称；identity.evidence 只填写实际使用的来源网址和短证据。
5. 名称存在歧义、只有泛称、证据互相冲突或无法找到官方名称时，needsReview=true、confidence 不高于0.69，并在 reason 中列明歧义，不得虚构正式名称。
6. 资料明确写出正式全称且与联网来源一致时，confidence 才可达到0.85以上。`;

const articleInstructions = `结构化文章规则：
1. article 是公开案例正文的唯一主结构；researchReport 仅为旧版兼容字段，本次返回空字符串。
2. article.standfirst 写150—300字导读；keyFindings 返回3—6条最重要结论。
3. sections 只能使用约定的 id，并按以下业务顺序组织：overview、background、objectives、architecture、capabilities、delivery、investment、outcomes、boundaries、lessons、timeline。
4. 没有可靠信息的章节直接省略，禁止十几个空标题；每个有效章节应有明确主旨，paragraphs 写完整论述，points 只放适合列举的事项。
5. 总体架构、数据体系、功能模块、实施机制、成效证据必须分清主次，禁止在多个章节重复同一段话。
6. evidenceRefs 使用“来源1”“来源2”这样的编号关联实际联网来源；没有证据时不要伪造编号。
7. 公开资料充分时，全文目标为3000—8000个中文字符；资料不足时明确缺口，不通过重复、空话或编造凑字数。`;

const mediaInstructions = `图片证据编排规则：
1. mediaPlan 只能从输入提供的图片候选中选择，candidateId 必须完全一致，不得虚构图片。
2. 优先选择真正承载案例信息的平台界面、驾驶舱大屏、总体架构图、业务流程图、地图和现场照片；封面、Logo、二维码、纯文字页、装饰图一般不选。
3. 每个候选根据页码、附近文字和视觉密度判断 kind 及最合适的 article sectionId；无法确认画面内容时 needsReview=true、confidence 不高于0.6。
4. caption 说明图片展示对象及其案例意义，不能只写“系统截图”；alt 客观描述画面。
5. 最多选择6张，避免同类重复。图片只能作为待复核证据，不能据此推导原文未说明的建设成效。
6. 没有候选或候选明显无关时返回空数组。`;

const locationInstructions = `位置补全规则：
1. province、city、lng、lat 都必须返回可用值。
2. 原文明确到市或区县时，按原文行政区划定位；没有项目点坐标时，可使用城市中心作为地图展示锚点，并设置 locationMethod=city_center_inferred。
3. 原文只明确省份且项目属于省级范围时，city 使用省会城市，lng/lat 使用省会中心作为展示锚点，locationMethod=province_capital_default，locationConfidence 不高于 0.55。
4. 例如原文只有“湖北省”，应返回 province=湖北省、city=武汉市，并明确说明武汉只是省级项目的地图展示锚点。
5. 原文给出可核验的精确城市或项目位置时，locationMethod=source_exact。
6. 坐标用于高德地图展示，请尽量返回 GCJ-02 坐标；任何推断位置都必须 needsReview=true，绝不能冒充原文事实。`;

const researchInstructions = `联网研究规则：
1. 围绕项目名称、建设单位、实施单位、产品名称和关键技术组合生成多组检索词，优先搜索政府官网、公共资源交易平台、招投标公告、建设或运营单位官网、权威媒体和可追溯公众号文章。
2. 对同一事实进行交叉核验，区分“原始资料明确”“联网来源补充”“案例库分析判断”。
3. 联网结果首先用于核验正式项目名称，然后用于补充 article 的结构化章节。
4. 公开资料不足时宁可明确写“未检索到”，不能重复灌水或编造内容。
5. researchSources 只填写本次实际检索并用于文章的来源；researchQueries 填写实际检索词。`;

export type ProviderInput = {
  sourceText: string;
  sourceUrl: string;
  file: File | null;
  researchMode: boolean;
  researchContext?: string;
  researchQueries?: string[];
  researchSources?: Array<{ title: string; url: string }>;
  mediaCandidates?: CaseMediaCandidate[];
};

export type ProviderResult = {
  provider: AiCaseParserProvider;
  model: string;
  responseId: string;
  inputTokens: number;
  outputTokens: number;
  researchMode: boolean;
  searchQueryCount: number;
  estimatedCostCny: number;
  fallbackUsed: boolean;
  fallbackReason: string;
  result: CaseParserOutput;
};

export type NativeJsonResult<T> = {
  provider: "deepseek";
  model: string;
  responseId: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostCny: number;
  value: T;
};

export type CaseResearchBundle = {
  provider: "tavily" | "zhipu" | "tencent_wsa" | "qwen";
  queries: string[];
  sources: Array<{ title: string; url: string }>;
  context: string;
  estimatedCostCny: number;
};

export class AiProviderError extends Error {
  provider: AiCaseParserProvider;
  status: number;
  code: string;

  constructor(provider: AiCaseParserProvider, message: string, status: number, code: string) {
    super(message);
    this.name = "AiProviderError";
    this.provider = provider;
    this.status = status;
    this.code = code;
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary);
}

function sourcePrompt(
  sourceText: string,
  sourceUrl: string,
  hasFile: boolean,
  researchMode: boolean,
  researchContext = "",
  mediaCandidates: CaseMediaCandidate[] = [],
) {
  const sourceContext = [
    sourceUrl ? `来源网址（仅作元数据，不代表已抓取网页）：${sourceUrl}` : "",
    sourceText ? `原始资料正文：\n${sourceText}` : hasFile ? "请解析随请求附带的 PDF 原始资料。" : "",
    researchContext
      ? `联网检索结果（仅作为补充证据，必须保留来源链接，不能冒充原始资料）：\n${researchContext}`
      : "",
    mediaCandidates.length > 0
      ? `图片候选（模型看不到原图，只能根据页码、附近文字和视觉密度进行初步编排，必须标记人工复核）：\n${JSON.stringify(mediaCandidates)}`
      : "本次没有图片候选，mediaPlan 返回空数组。",
  ]
    .filter(Boolean)
    .join("\n\n");

  return `${parserInstructions}

${identityInstructions}

${locationInstructions}

${articleInstructions}

${mediaInstructions}

${researchMode ? researchInstructions : "本次不开启联网研究：researchReport、researchSources、researchQueries 返回空值。"}

请把以下资料解析为智慧城市案例草稿，并返回严格符合 JSON Schema 的结果。

${sourceContext}`;
}

function objectValue(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function errorDetails(payload: unknown) {
  const root = objectValue(payload);
  const error = objectValue(root?.error);
  return {
    message:
      (typeof error?.message === "string" && error.message) ||
      (typeof root?.message === "string" && root.message) ||
      "",
    status:
      (typeof error?.status === "string" && error.status) ||
      (typeof root?.status === "string" && root.status) ||
      "",
    code:
      (typeof error?.code === "string" || typeof error?.code === "number"
        ? String(error.code)
        : typeof root?.code === "string" || typeof root?.code === "number"
          ? String(root.code)
          : ""),
  };
}

function classifyProviderError(
  provider: AiCaseParserProvider,
  status: number,
  payload: unknown,
) {
  const upstream = errorDetails(payload);
  const diagnostic = `${upstream.status} ${upstream.code} ${upstream.message}`.toLowerCase();

  if (status === 401 || diagnostic.includes("api key not valid") || diagnostic.includes("invalid_api_key")) {
    return new AiProviderError(provider, `${providerLabel(provider)} API Key 无效或已失效。`, 502, `${provider}_invalid_key`);
  }
  if (status === 403) {
    return new AiProviderError(provider, `${providerLabel(provider)} 项目没有调用该模型或联网服务的权限。`, 502, `${provider}_forbidden`);
  }
  if (status === 429) {
    const quotaExhausted =
      diagnostic.includes("insufficient_quota") ||
      diagnostic.includes("billing") ||
      diagnostic.includes("quota") ||
      diagnostic.includes("resource_exhausted");
    return new AiProviderError(
      provider,
      quotaExhausted
        ? `${providerLabel(provider)}余额、免费额度或当前项目限额不足。`
        : `${providerLabel(provider)}请求过于频繁，请稍后重试。`,
      429,
      quotaExhausted ? `${provider}_quota_exhausted` : `${provider}_rate_limited`,
    );
  }

  return new AiProviderError(
    provider,
    upstream.message || `${providerLabel(provider)}解析失败，请稍后重试。`,
    status >= 400 && status < 500 ? 400 : 502,
    `${provider}_error`,
  );
}

function providerLabel(provider: AiCaseParserProvider) {
  const labels: Record<AiCaseParserProvider, string> = {
    deepseek: "DeepSeek",
    qwen: "千问",
    gemini: "Gemini",
    openai: "OpenAI",
  };
  return labels[provider];
}

function parseJsonResult(provider: AiCaseParserProvider, text: string) {
  if (!text) {
    throw new AiProviderError(provider, "AI 没有返回可用的结构化结果，请重试。", 502, `${provider}_empty_output`);
  }

  try {
    return normalizeParserOutput(JSON.parse(text) as CaseParserOutput);
  } catch {
    const fencedJson = text
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "");
    try {
      return normalizeParserOutput(JSON.parse(fencedJson) as CaseParserOutput);
    } catch {
      throw new AiProviderError(provider, "AI 返回的结构化结果无法解析，请重试。", 502, `${provider}_invalid_output`);
    }
  }
}

function normalizeParserOutput(parsed: CaseParserOutput): CaseParserOutput {
  const identity = normalizeIdentity(parsed.identity, parsed.case.title);
  const article = normalizeArticle(parsed.article, parsed.case);
  const mediaPlan = Array.isArray(parsed.mediaPlan)
    ? parsed.mediaPlan
        .filter(
          (item): item is CaseMediaPlanItem =>
            Boolean(
              item &&
                typeof item.candidateId === "string" &&
                typeof item.caption === "string" &&
                typeof item.alt === "string",
            ),
        )
        .slice(0, 6)
        .map((item) => ({
          ...item,
          confidence: Math.min(1, Math.max(0, item.confidence || 0)),
          needsReview: true,
        }))
    : [];
  const titleAssessment = parsed.fieldAssessments.find(
    (assessment) => assessment.field === "title",
  );
  return {
    ...parsed,
    case: {
      ...parsed.case,
      title: identity.canonicalTitle || parsed.case.title,
    },
    identity,
    article,
    mediaPlan,
    fieldAssessments: [
      {
        field: "title",
        confidence: identity.confidence,
        evidence:
          identity.evidence.map((item) => item.quote).filter(Boolean).join("；") ||
          titleAssessment?.evidence ||
          "",
        needsReview: identity.needsReview,
        reason: identity.reason || titleAssessment?.reason || "",
      },
      ...parsed.fieldAssessments.filter(
        (assessment) => assessment.field !== "title",
      ),
    ],
  };
}

export function normalizeExternalParserOutput(
  parsed: CaseParserOutput,
): CaseParserOutput {
  return applyLocationFallback(normalizeParserOutput(parsed));
}

function extractGeminiText(payload: unknown) {
  const root = objectValue(payload);
  if (typeof root?.output_text === "string") return root.output_text;

  if (Array.isArray(root?.candidates)) {
    for (const rawCandidate of root.candidates) {
      const candidate = objectValue(rawCandidate);
      const content = objectValue(candidate?.content);
      if (!Array.isArray(content?.parts)) continue;
      const text = content.parts
        .map((rawPart) => objectValue(rawPart))
        .map((part) => (typeof part?.text === "string" ? part.text : ""))
        .join("");
      if (text) return text;
    }
  }

  if (!Array.isArray(root?.steps)) return "";

  for (let index = root.steps.length - 1; index >= 0; index -= 1) {
    const step = objectValue(root.steps[index]);
    if (!Array.isArray(step?.content)) continue;
    for (const item of step.content) {
      const content = objectValue(item);
      if (typeof content?.text === "string") return content.text;
    }
  }
  return "";
}

function extractGeminiGrounding(payload: unknown) {
  const root = objectValue(payload);
  if (!Array.isArray(root?.steps)) return { queries: [] as string[], sources: [] as Array<{ title: string; url: string }> };

  const queries: string[] = [];
  const sources: Array<{ title: string; url: string }> = [];

  for (const rawStep of root.steps) {
    const step = objectValue(rawStep);
    if (step?.type === "google_search_call") {
      const argumentsValue = objectValue(step.arguments);
      if (Array.isArray(argumentsValue?.queries)) {
        for (const query of argumentsValue.queries) {
          if (typeof query === "string" && query.trim()) queries.push(query.trim());
        }
      }
    }
    if (step?.type !== "model_output" || !Array.isArray(step.content)) continue;
    for (const rawContent of step.content) {
      const content = objectValue(rawContent);
      if (!Array.isArray(content?.annotations)) continue;
      for (const rawAnnotation of content.annotations) {
        const annotation = objectValue(rawAnnotation);
        if (
          annotation?.type === "url_citation" &&
          typeof annotation.url === "string" &&
          annotation.url.startsWith("http")
        ) {
          sources.push({
            title: typeof annotation.title === "string" ? annotation.title : annotation.url,
            url: annotation.url,
          });
        }
      }
    }
  }

  return {
    queries: Array.from(new Set(queries)),
    sources: Array.from(new Map(sources.map((item) => [item.url, item])).values()),
  };
}

function geminiUsage(payload: unknown) {
  const root = objectValue(payload);
  const usage =
    objectValue(root?.usageMetadata) ||
    objectValue(root?.usage_metadata) ||
    objectValue(root?.usage);
  const directInput =
    typeof usage?.promptTokenCount === "number"
      ? usage.promptTokenCount
      : typeof usage?.total_input_tokens === "number"
      ? usage.total_input_tokens
      : typeof usage?.input_token_count === "number"
        ? usage.input_token_count
        : typeof usage?.input_tokens === "number"
          ? usage.input_tokens
          : 0;
  const directOutput =
    typeof usage?.candidatesTokenCount === "number"
      ? usage.candidatesTokenCount
      : typeof usage?.total_output_tokens === "number"
      ? usage.total_output_tokens
      : typeof usage?.output_token_count === "number"
        ? usage.output_token_count
        : typeof usage?.output_tokens === "number"
          ? usage.output_tokens
          : 0;
  const thoughtTokens =
    typeof usage?.thoughtsTokenCount === "number"
      ? usage.thoughtsTokenCount
      : typeof usage?.total_thought_tokens === "number"
        ? usage.total_thought_tokens
        : 0;

  return {
    inputTokens: directInput,
    outputTokens: directOutput + thoughtTokens,
  };
}

async function callGemini(input: ProviderInput): Promise<ProviderResult> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new AiProviderError("gemini", "Gemini 服务尚未配置，请设置 GEMINI_API_KEY。", 503, "gemini_missing_key");
  }

  const primaryModel = process.env.GEMINI_CASE_PARSER_MODEL?.trim() || GEMINI_CASE_PARSER_MODEL;
  const fallbackModel =
    process.env.GEMINI_CASE_PARSER_FALLBACK_MODEL?.trim() || "gemini-3.5-flash-lite";
  const models = Array.from(new Set([primaryModel, fallbackModel].filter(Boolean)));
  const parts: Array<Record<string, unknown>> = [];
  if (input.file) {
    parts.push({
      inline_data: {
        mime_type: "application/pdf",
        data: arrayBufferToBase64(await input.file.arrayBuffer()),
      },
    });
  }
  parts.push({
    text: sourcePrompt(
      input.sourceText,
      input.sourceUrl,
      Boolean(input.file),
      input.researchMode,
      "",
      input.mediaCandidates,
    ),
  });

  let lastTransientError: AiProviderError | null = null;

  for (const [modelIndex, model] of models.entries()) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      let response: Response;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 105_000);
      try {
        const normalizedModel = model.replace(/^models\//, "");
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(normalizedModel)}:generateContent`,
          {
            method: "POST",
            signal: controller.signal,
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": apiKey,
            },
            body: JSON.stringify({
              contents: [{ role: "user", parts }],
              tools: input.researchMode ? [{ google_search: {} }] : undefined,
              generationConfig: {
                responseMimeType: "application/json",
                responseJsonSchema: caseParserJsonSchema,
                maxOutputTokens: 16_000,
                thinkingConfig: {
                  thinkingLevel: input.researchMode ? "MEDIUM" : "LOW",
                },
              },
            }),
          },
        );
      } catch (error) {
        clearTimeout(timeoutId);
        if (objectValue(error)?.name === "AbortError") {
          lastTransientError = new AiProviderError(
            "gemini",
            "扫描 PDF 识别超时，系统已尝试备用模型仍未完成。请稍后重试，或先对 PDF 做 OCR 后再上传。",
            504,
            "gemini_timeout",
          );
        } else {
          lastTransientError = new AiProviderError(
            "gemini",
            "暂时无法连接 Gemini 扫描识别服务，系统将自动重试。",
            502,
            "gemini_unreachable",
          );
        }
        if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 800));
        continue;
      } finally {
        clearTimeout(timeoutId);
      }

      const responseText = await response.text();
      let payload: unknown;
      try {
        payload = JSON.parse(responseText);
      } catch {
        if (!response.ok && (response.status === 503 || response.status === 529)) {
          lastTransientError = new AiProviderError(
            "gemini",
            "Gemini 扫描识别当前请求量过高，系统正在自动重试。",
            503,
            "gemini_high_demand",
          );
          if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 800));
          continue;
        }
        if (!response.ok) {
          throw new AiProviderError(
            "gemini",
            `Gemini 上游服务返回了异常响应（HTTP ${response.status}），请稍后重试。`,
            response.status === 429 ? 429 : 502,
            "gemini_upstream_invalid_response",
          );
        }
        throw new AiProviderError(
          "gemini",
          "Gemini 已响应，但结果格式无法识别。请重试；若持续出现，请检查所选模型是否支持 PDF。",
          502,
          "gemini_invalid_response",
        );
      }

      if (!response.ok) {
        const upstream = errorDetails(payload);
        const diagnostic = `${upstream.status} ${upstream.code} ${upstream.message}`.toLowerCase();
        const isHighDemand =
          response.status === 503 ||
          response.status === 529 ||
          diagnostic.includes("high demand") ||
          diagnostic.includes("overloaded") ||
          diagnostic.includes("service unavailable") ||
          diagnostic.includes("temporarily unavailable");
        if (isHighDemand) {
          lastTransientError = new AiProviderError(
            "gemini",
            "Gemini 扫描识别当前请求量过高，系统正在自动重试。",
            503,
            "gemini_high_demand",
          );
          if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 800));
          continue;
        }
        throw classifyProviderError("gemini", response.status, payload);
      }

      const root = objectValue(payload);
      const grounding = extractGeminiGrounding(payload);
      const parsed = parseJsonResult("gemini", extractGeminiText(payload));
      const groundedResult = applyLocationFallback({
        ...parsed,
        researchQueries: grounding.queries.length > 0 ? grounding.queries : parsed.researchQueries,
        researchSources: grounding.sources.length > 0 ? grounding.sources : parsed.researchSources,
      });
      return {
        provider: "gemini",
        model,
        responseId: typeof root?.id === "string" ? root.id : "",
        ...geminiUsage(payload),
        researchMode: input.researchMode,
        searchQueryCount: grounding.queries.length,
        estimatedCostCny: 0,
        fallbackUsed: modelIndex > 0,
        fallbackReason:
          modelIndex > 0
            ? `${primaryModel} 请求量过高，已自动切换到 ${model} 完成扫描件识别。`
            : "",
        result: groundedResult,
      };
    }
  }

  throw new AiProviderError(
    "gemini",
    "Gemini 扫描识别当前请求量过高。系统已自动重试并切换备用模型，但仍未成功；请稍后再试，或先对 PDF 做 OCR。",
    lastTransientError?.status === 504 ? 504 : 503,
    lastTransientError?.code || "gemini_high_demand",
  );
}

function extractOpenAiText(payload: unknown) {
  const root = objectValue(payload);
  if (!Array.isArray(root?.output)) return "";
  for (const item of root.output) {
    const output = objectValue(item);
    if (!Array.isArray(output?.content)) continue;
    for (const itemContent of output.content) {
      const content = objectValue(itemContent);
      if (content?.type === "output_text" && typeof content.text === "string") return content.text;
    }
  }
  return "";
}

function openAiUsage(payload: unknown) {
  const root = objectValue(payload);
  const usage = objectValue(root?.usage);
  return {
    inputTokens: typeof usage?.input_tokens === "number" ? usage.input_tokens : 0,
    outputTokens: typeof usage?.output_tokens === "number" ? usage.output_tokens : 0,
  };
}

function schemaConstrainedPrompt(input: ProviderInput) {
  return `${sourcePrompt(
    input.sourceText,
    input.sourceUrl,
    Boolean(input.file),
    input.researchMode,
    input.researchContext,
    input.mediaCandidates,
  )}

只返回一个 JSON 对象，不要使用 Markdown 代码块，不要在 JSON 前后添加解释。JSON 必须符合以下 Schema：
${JSON.stringify(caseParserJsonSchema)}`;
}

function extractChatCompletionText(payload: unknown) {
  const root = objectValue(payload);
  if (!Array.isArray(root?.choices)) return "";
  const first = objectValue(root.choices[0]);
  const message = objectValue(first?.message);
  return typeof message?.content === "string" ? message.content : "";
}

function chatCompletionUsage(payload: unknown) {
  const root = objectValue(payload);
  const usage = objectValue(root?.usage);
  return {
    inputTokens: typeof usage?.prompt_tokens === "number" ? usage.prompt_tokens : 0,
    outputTokens: typeof usage?.completion_tokens === "number" ? usage.completion_tokens : 0,
  };
}

function estimateDeepSeekCostCny(inputTokens: number, outputTokens: number) {
  const usd = (inputTokens / 1_000_000) * 0.14 + (outputTokens / 1_000_000) * 0.28;
  return Number((usd * 7.2).toFixed(4));
}

function estimateQwenCostCny(inputTokens: number, outputTokens: number, searches: number) {
  const modelCost = (inputTokens / 1_000_000) * 0.8 + (outputTokens / 1_000_000) * 8;
  const searchCost = searches * 0.003;
  return Number((modelCost + searchCost).toFixed(4));
}

const TENCENT_WSA_LITE_SEARCH_COST_CNY = 0.018;
const MAX_TENCENT_WSA_QUERIES = 6;
const MAX_TENCENT_WSA_RESULTS = 24;
const ZHIPU_SEARCH_STD_COST_CNY = 0.01;
const MAX_ZHIPU_SEARCH_QUERIES = 2;
const MAX_ZHIPU_SEARCH_RESULTS = 24;
const TAVILY_PAYG_SEARCH_COST_CNY = 0.0576;
const MAX_TAVILY_SEARCH_QUERIES = 2;
const MAX_TAVILY_SEARCH_RESULTS = 20;
const MIN_STRUCTURED_ARTICLE_CHARACTERS = 3_000;

type TencentWsaSearchResult = {
  title: string;
  url: string;
  passage: string;
  site: string;
  date: string;
  score: number;
};

class TencentWsaError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "TencentWsaError";
    this.code = code;
  }
}

function buildTencentWsaQueries(result: CaseParserOutput) {
  const caseItem = result.case;
  const title = caseItem.title.trim();
  const region = [caseItem.province, caseItem.city].filter(Boolean).join(" ");
  const owner = caseItem.owner.trim();
  const implementationUnit = caseItem.implementationUnit?.trim() || "";
  const candidates = [
    title,
    title ? `${title} 招标 采购 公告` : "",
    title ? `${title} 建设单位 中标` : "",
    title ? `${title} 平台 功能 架构` : "",
    title ? `${title} 验收 运营 成效` : "",
    [region, title].filter(Boolean).join(" "),
    [owner, title].filter(Boolean).join(" "),
    [implementationUnit, title].filter(Boolean).join(" "),
  ];

  return Array.from(
    new Set(
      candidates
        .map((query) => query.replace(/\s+/g, " ").trim())
        .filter((query) => query.length >= 2),
    ),
  ).slice(0, MAX_TENCENT_WSA_QUERIES);
}

function parseTencentWsaPayload(payload: unknown) {
  const root = objectValue(payload);
  const response = objectValue(root?.Response) || objectValue(root?.response);
  const error = objectValue(response?.Error) || objectValue(root?.error);
  if (error) {
    const code = typeof error.Code === "string" ? error.Code : "TencentWsaError";
    const message = typeof error.Message === "string" ? error.Message : "";
    throw new TencentWsaError(message || "腾讯联网搜索返回错误。", code);
  }

  const pages = Array.isArray(response?.Pages) ? response.Pages : [];
  const results: TencentWsaSearchResult[] = [];
  for (const rawPage of pages) {
    let page: Record<string, unknown> | null = null;
    if (typeof rawPage === "string") {
      try {
        page = objectValue(JSON.parse(rawPage));
      } catch {
        continue;
      }
    } else {
      page = objectValue(rawPage);
    }
    const url = typeof page?.url === "string" ? page.url.trim() : "";
    if (!url.startsWith("http")) continue;
    results.push({
      title:
        typeof page?.title === "string" && page.title.trim()
          ? page.title.trim()
          : url,
      url,
      passage:
        typeof page?.passage === "string"
          ? page.passage.trim()
          : typeof page?.content === "string"
            ? page.content.trim()
            : "",
      site: typeof page?.site === "string" ? page.site.trim() : "",
      date: typeof page?.date === "string" ? page.date.trim() : "",
      score: typeof page?.score === "number" ? page.score : 0,
    });
  }

  return {
    results,
    requestId: typeof response?.RequestId === "string" ? response.RequestId : "",
    version: typeof response?.Version === "string" ? response.Version : "",
  };
}

function friendlyTencentWsaError(error: unknown) {
  if (error instanceof AiProviderError) return error.message;
  if (!(error instanceof TencentWsaError)) {
    return "腾讯联网搜索暂时不可用，请稍后重试。";
  }
  const diagnostic = `${error.code} ${error.message}`.toLowerCase();
  if (diagnostic.includes("unauthorized")) return "腾讯联网搜索API Key无效或没有权限。";
  if (diagnostic.includes("resourcenotfound")) return "腾讯联网搜索服务尚未开通。";
  if (diagnostic.includes("resourceunavailable")) return "腾讯联网搜索套餐不可用或账户欠费。";
  if (diagnostic.includes("requestlimit")) return "腾讯联网搜索请求过于频繁，请稍后重试。";
  return error.message || "腾讯联网搜索暂时不可用，请稍后重试。";
}

async function searchTencentWsa(query: string) {
  const apiKey = process.env.WSA_API_KEY?.trim();
  if (!apiKey) {
    throw new TencentWsaError("腾讯联网搜索尚未配置，请设置WSA_API_KEY。", "MissingApiKey");
  }

  let response: Response;
  try {
    response = await fetch("https://api.wsa.cloud.tencent.com/SearchPro", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({ Query: query, Mode: 0 }),
    });
  } catch {
    throw new TencentWsaError("暂时无法连接腾讯联网搜索服务。", "Unreachable");
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new TencentWsaError(
      `腾讯联网搜索返回了无法识别的响应（HTTP ${response.status}）。`,
      "InvalidResponse",
    );
  }
  if (!response.ok) {
    const details = errorDetails(payload);
    throw new TencentWsaError(
      details.message || `腾讯联网搜索请求失败（HTTP ${response.status}）。`,
      details.code || "HttpError",
    );
  }
  return parseTencentWsaPayload(payload);
}

async function gatherTencentWsaResearch(queries: string[]) {
  const settled = await Promise.allSettled(queries.map((query) => searchTencentWsa(query)));
  const successfulQueries: string[] = [];
  const combined: TencentWsaSearchResult[] = [];
  let firstFailure: unknown = null;

  settled.forEach((item, index) => {
    if (item.status === "fulfilled") {
      successfulQueries.push(queries[index]);
      combined.push(...item.value.results);
    } else if (!firstFailure) {
      firstFailure = item.reason;
    }
  });

  if (successfulQueries.length === 0) {
    throw firstFailure || new TencentWsaError("腾讯联网搜索没有返回结果。", "EmptyResult");
  }

  const ranked = Array.from(
    new Map(
      combined
        .sort((a, b) => b.score - a.score)
        .map((item) => [item.url, item]),
    ).values(),
  ).slice(0, MAX_TENCENT_WSA_RESULTS);

  if (ranked.length === 0) {
    throw new TencentWsaError("腾讯联网搜索没有找到可用网页。", "EmptyResult");
  }

  return {
    queries: successfulQueries,
    results: ranked,
    sources: ranked.map(({ title, url }) => ({ title, url })),
  };
}

function formatTencentWsaResearch(results: TencentWsaSearchResult[]) {
  return results
    .map((item, index) => {
      const metadata = [
        item.site ? `网站：${item.site}` : "",
        item.date ? `日期：${item.date}` : "",
        `链接：${item.url}`,
      ]
        .filter(Boolean)
        .join("；");
      return `[${index + 1}] ${item.title}\n${metadata}\n摘要：${item.passage.slice(0, 1_200) || "搜索结果未提供摘要"}`;
    })
    .join("\n\n");
}

type ZhipuSearchResult = {
  title: string;
  url: string;
  content: string;
  media: string;
  date: string;
};

class ZhipuSearchError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "ZhipuSearchError";
    this.status = status;
    this.code = code;
  }
}

function buildResearchQueries(result: CaseParserOutput, sourceText: string) {
  const caseItem = result.case;
  const title = caseItem.title.trim();
  const region = [caseItem.province, caseItem.city].filter(Boolean).join(" ");
  const owner = caseItem.owner.trim();
  const implementationUnit = caseItem.implementationUnit?.trim() || "";
  const sourceClue = sourceText
    .replace(/\s+/g, " ")
    .slice(0, 180)
    .trim();
  const candidateNames = result.identity.candidates
    .filter((candidate) => candidate !== title)
    .slice(0, 2)
    .join(" ");
  const identityQuery = [
    region,
    owner,
    implementationUnit,
    candidateNames || title,
    sourceClue.slice(0, 72),
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
  const evidenceQuery = [
    region,
    title,
    "招标 中标 建设单位 实施单位 功能 架构 验收 运营 成效",
    title.length < 8 ? sourceClue : "",
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  return Array.from(
    new Set([identityQuery, evidenceQuery].filter((query) => query.length >= 2)),
  ).slice(0, Math.max(MAX_ZHIPU_SEARCH_QUERIES, MAX_TAVILY_SEARCH_QUERIES));
}

function parseZhipuSearchPayload(payload: unknown) {
  const root = objectValue(payload);
  const rawResults = Array.isArray(root?.search_result) ? root.search_result : [];
  const results: ZhipuSearchResult[] = [];

  for (const rawResult of rawResults) {
    const item = objectValue(rawResult);
    const url = typeof item?.link === "string" ? item.link.trim() : "";
    if (!url.startsWith("http")) continue;
    results.push({
      title:
        typeof item?.title === "string" && item.title.trim()
          ? item.title.trim()
          : url,
      url,
      content: typeof item?.content === "string" ? item.content.trim() : "",
      media: typeof item?.media === "string" ? item.media.trim() : "",
      date:
        typeof item?.publish_date === "string"
          ? item.publish_date.trim()
          : "",
    });
  }

  return results;
}

function friendlyZhipuSearchError(error: unknown) {
  if (error instanceof AiProviderError) return error.message;
  if (!(error instanceof ZhipuSearchError)) {
    return "智谱联网搜索暂时不可用，请稍后重试。";
  }
  const diagnostic = `${error.code} ${error.message}`.toLowerCase();
  if (error.status === 401 || error.status === 403 || diagnostic.includes("auth")) {
    return "智谱API Key无效或没有联网搜索权限。";
  }
  if (
    error.status === 402 ||
    diagnostic.includes("余额") ||
    diagnostic.includes("balance") ||
    diagnostic.includes("quota")
  ) {
    return "智谱账户余额或联网搜索额度不足。";
  }
  if (error.status === 429 || diagnostic.includes("rate")) {
    return "智谱联网搜索请求过于频繁，请稍后重试。";
  }
  return error.message || "智谱联网搜索暂时不可用，请稍后重试。";
}

async function searchZhipu(query: string) {
  const apiKey = process.env.ZHIPU_API_KEY?.trim();
  if (!apiKey) {
    throw new ZhipuSearchError(
      "智谱联网搜索尚未配置，请设置ZHIPU_API_KEY。",
      503,
      "MissingApiKey",
    );
  }

  let response: Response;
  try {
    response = await fetch("https://open.bigmodel.cn/api/paas/v4/web_search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        search_query: query,
        search_engine: "search_std",
        search_intent: true,
        count: 15,
        search_recency_filter: "noLimit",
        content_size: "high",
      }),
    });
  } catch {
    throw new ZhipuSearchError(
      "暂时无法连接智谱联网搜索服务。",
      502,
      "Unreachable",
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ZhipuSearchError(
      `智谱联网搜索返回了无法识别的响应（HTTP ${response.status}）。`,
      response.status,
      "InvalidResponse",
    );
  }
  if (!response.ok) {
    const details = errorDetails(payload);
    throw new ZhipuSearchError(
      details.message || `智谱联网搜索请求失败（HTTP ${response.status}）。`,
      response.status,
      details.code || "HttpError",
    );
  }
  return parseZhipuSearchPayload(payload);
}

async function gatherZhipuResearch(queries: string[]) {
  const settled = await Promise.allSettled(
    queries.map((query) => searchZhipu(query)),
  );
  const successfulQueries: string[] = [];
  const combined: ZhipuSearchResult[] = [];
  let firstFailure: unknown = null;

  settled.forEach((item, index) => {
    if (item.status === "fulfilled") {
      successfulQueries.push(queries[index]);
      combined.push(...item.value);
    } else if (!firstFailure) {
      firstFailure = item.reason;
    }
  });

  if (successfulQueries.length === 0) {
    throw (
      firstFailure ||
      new ZhipuSearchError("智谱联网搜索没有返回结果。", 502, "EmptyResult")
    );
  }

  const results = Array.from(
    new Map(combined.map((item) => [item.url, item])).values(),
  ).slice(0, MAX_ZHIPU_SEARCH_RESULTS);

  if (results.length === 0) {
    throw new ZhipuSearchError(
      "智谱联网搜索没有找到可用网页。",
      502,
      "EmptyResult",
    );
  }

  return {
    queries: successfulQueries,
    results,
    sources: results.map(({ title, url }) => ({ title, url })),
  };
}

function formatZhipuResearch(results: ZhipuSearchResult[]) {
  return results
    .map((item, index) => {
      const metadata = [
        item.media ? `网站：${item.media}` : "",
        item.date ? `日期：${item.date}` : "",
        `链接：${item.url}`,
      ]
        .filter(Boolean)
        .join("；");
      return `[${index + 1}] ${item.title}\n${metadata}\n摘要：${item.content.slice(0, 1_500) || "搜索结果未提供摘要"}`;
    })
    .join("\n\n");
}

type TavilySearchResult = {
  title: string;
  url: string;
  content: string;
  score: number;
};

class TavilySearchError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "TavilySearchError";
    this.status = status;
    this.code = code;
  }
}

function tavilyErrorMessage(payload: unknown) {
  const root = objectValue(payload);
  const detail = objectValue(root?.detail);
  return (
    (typeof detail?.error === "string" && detail.error) ||
    (typeof root?.message === "string" && root.message) ||
    ""
  );
}

function friendlyTavilySearchError(error: unknown) {
  if (error instanceof AiProviderError) return error.message;
  if (!(error instanceof TavilySearchError)) {
    return "Tavily联网搜索暂时不可用，请稍后重试。";
  }
  const diagnostic = `${error.code} ${error.message}`.toLowerCase();
  if (error.status === 401 || diagnostic.includes("unauthorized")) {
    return "Tavily API Key无效或已失效。";
  }
  if (
    error.status === 432 ||
    error.status === 433 ||
    diagnostic.includes("usage limit") ||
    diagnostic.includes("credit")
  ) {
    return "Tavily免费额度或当前用量上限已用尽。";
  }
  if (error.status === 429 || diagnostic.includes("excessive requests")) {
    return "Tavily请求过于频繁，请稍后重试。";
  }
  return error.message || "Tavily联网搜索暂时不可用，请稍后重试。";
}

async function searchTavily(query: string) {
  const apiKey = process.env.TAVILY_API_KEY?.trim();
  if (!apiKey) {
    throw new TavilySearchError(
      "Tavily联网搜索尚未配置，请设置TAVILY_API_KEY。",
      503,
      "MissingApiKey",
    );
  }

  let response: Response;
  try {
    response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        search_depth: "basic",
        max_results: 10,
        topic: "general",
        include_answer: false,
        include_raw_content: false,
        include_images: false,
        include_favicon: false,
        country: "china",
        auto_parameters: false,
        include_usage: true,
      }),
    });
  } catch {
    throw new TavilySearchError(
      "暂时无法连接Tavily联网搜索服务。",
      502,
      "Unreachable",
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new TavilySearchError(
      `Tavily联网搜索返回了无法识别的响应（HTTP ${response.status}）。`,
      response.status,
      "InvalidResponse",
    );
  }
  if (!response.ok) {
    throw new TavilySearchError(
      tavilyErrorMessage(payload) ||
        `Tavily联网搜索请求失败（HTTP ${response.status}）。`,
      response.status,
      "HttpError",
    );
  }

  const root = objectValue(payload);
  const rawResults = Array.isArray(root?.results) ? root.results : [];
  const results: TavilySearchResult[] = [];
  for (const rawResult of rawResults) {
    const item = objectValue(rawResult);
    const url = typeof item?.url === "string" ? item.url.trim() : "";
    if (!url.startsWith("http")) continue;
    results.push({
      title:
        typeof item?.title === "string" && item.title.trim()
          ? item.title.trim()
          : url,
      url,
      content: typeof item?.content === "string" ? item.content.trim() : "",
      score: typeof item?.score === "number" ? item.score : 0,
    });
  }
  return results;
}

async function gatherTavilyResearch(queries: string[]) {
  const settled = await Promise.allSettled(
    queries.map((query) => searchTavily(query)),
  );
  const successfulQueries: string[] = [];
  const combined: TavilySearchResult[] = [];
  let firstFailure: unknown = null;

  settled.forEach((item, index) => {
    if (item.status === "fulfilled") {
      successfulQueries.push(queries[index]);
      combined.push(...item.value);
    } else if (!firstFailure) {
      firstFailure = item.reason;
    }
  });

  if (successfulQueries.length === 0) {
    throw (
      firstFailure ||
      new TavilySearchError(
        "Tavily联网搜索没有返回结果。",
        502,
        "EmptyResult",
      )
    );
  }

  const results = Array.from(
    new Map(
      combined
        .sort((a, b) => b.score - a.score)
        .map((item) => [item.url, item]),
    ).values(),
  ).slice(0, MAX_TAVILY_SEARCH_RESULTS);

  if (results.length === 0) {
    throw new TavilySearchError(
      "Tavily联网搜索没有找到可用网页。",
      502,
      "EmptyResult",
    );
  }

  return {
    queries: successfulQueries,
    results,
    sources: results.map(({ title, url }) => ({ title, url })),
  };
}

function formatTavilyResearch(results: TavilySearchResult[]) {
  return results
    .map(
      (item, index) =>
        `[${index + 1}] ${item.title}\n链接：${item.url}\n相关度：${item.score.toFixed(3)}\n摘要：${item.content.slice(0, 1_500) || "搜索结果未提供摘要"}`,
    )
    .join("\n\n");
}

const DEEPSEEK_RETRY_DELAYS_MS = [1_200, 2_500];

function deepSeekHighDemand(status: number, payload: unknown) {
  const upstream = errorDetails(payload);
  const diagnostic =
    `${upstream.status} ${upstream.code} ${upstream.message}`.toLowerCase();
  return (
    status === 503 ||
    status === 529 ||
    diagnostic.includes("high demand") ||
    diagnostic.includes("temporarily unavailable") ||
    diagnostic.includes("overloaded") ||
    diagnostic.includes("server busy") ||
    diagnostic.includes("try again later")
  );
}

function waitForRetry(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function requestDeepSeekCompletion(prompt: string, maxTokens: number) {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) {
    throw new AiProviderError(
      "deepseek",
      "DeepSeek 服务尚未配置，请设置 DEEPSEEK_API_KEY。",
      503,
      "deepseek_missing_key",
    );
  }
  const model =
    process.env.DEEPSEEK_CASE_PARSER_MODEL?.trim() ||
    DEEPSEEK_CASE_PARSER_MODEL;

  for (
    let attempt = 0;
    attempt <= DEEPSEEK_RETRY_DELAYS_MS.length;
    attempt += 1
  ) {
    let response: Response;
    try {
      response = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          thinking: { type: "disabled" },
          stream: false,
          max_tokens: maxTokens,
        }),
      });
    } catch {
      if (attempt < DEEPSEEK_RETRY_DELAYS_MS.length) {
        await waitForRetry(DEEPSEEK_RETRY_DELAYS_MS[attempt]);
        continue;
      }
      throw new AiProviderError(
        "deepseek",
        "暂时无法连接DeepSeek服务，系统自动重试后仍未恢复，请稍后再试。",
        502,
        "deepseek_unreachable",
      );
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new AiProviderError(
        "deepseek",
        "DeepSeek返回了无法识别的响应。",
        502,
        "deepseek_invalid_response",
      );
    }
    if (response.ok) return { model, payload };

    if (deepSeekHighDemand(response.status, payload)) {
      if (attempt < DEEPSEEK_RETRY_DELAYS_MS.length) {
        const retryAfterSeconds = Number(response.headers.get("Retry-After"));
        const delay = Number.isFinite(retryAfterSeconds)
          ? Math.min(Math.max(retryAfterSeconds * 1_000, 500), 4_000)
          : DEEPSEEK_RETRY_DELAYS_MS[attempt];
        await waitForRetry(delay);
        continue;
      }
      throw new AiProviderError(
        "deepseek",
        "DeepSeek当前请求量过高，系统已自动重试2次，仍未成功。请稍后再试；Tavily联网搜索配置正常。",
        503,
        "deepseek_high_demand",
      );
    }

    throw classifyProviderError("deepseek", response.status, payload);
  }

  throw new AiProviderError(
    "deepseek",
    "DeepSeek暂时不可用，请稍后重试。",
    503,
    "deepseek_unavailable",
  );
}

export async function requestDeepSeekJson<T>(
  prompt: string,
  maxTokens: number,
): Promise<NativeJsonResult<T>> {
  const { model, payload } = await requestDeepSeekCompletion(prompt, maxTokens);
  const root = objectValue(payload);
  const usage = chatCompletionUsage(payload);
  const rawText = extractChatCompletionText(payload);
  const jsonText = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  let value: T;
  try {
    value = JSON.parse(jsonText) as T;
  } catch {
    throw new AiProviderError(
      "deepseek",
      "DeepSeek返回的阶段性结构化结果无法解析，请重试。",
      502,
      "deepseek_native_invalid_output",
    );
  }
  return {
    provider: "deepseek",
    model,
    responseId: typeof root?.id === "string" ? root.id : "",
    ...usage,
    estimatedCostCny: estimateDeepSeekCostCny(
      usage.inputTokens,
      usage.outputTokens,
    ),
    value,
  };
}

async function callDeepSeek(input: ProviderInput): Promise<ProviderResult> {
  if (input.file && !input.sourceText.trim()) {
    throw new AiProviderError(
      "deepseek",
      "该PDF未提取到足够文字。DeepSeek不能直接识别扫描PDF，请改用文字版PDF或配置Gemini进行扫描件识别。",
      422,
      "deepseek_pdf_text_required",
    );
  }

  const { model, payload } = await requestDeepSeekCompletion(
    schemaConstrainedPrompt(input),
    16_000,
  );

  const root = objectValue(payload);
  const usage = chatCompletionUsage(payload);
  const parsed = parseJsonResult("deepseek", extractChatCompletionText(payload));
  const result = applyLocationFallback({
    ...parsed,
    researchQueries:
      input.researchQueries && input.researchQueries.length > 0
        ? input.researchQueries
        : parsed.researchQueries,
    researchSources:
      input.researchSources && input.researchSources.length > 0
        ? input.researchSources
        : parsed.researchSources,
  });
  return {
    provider: "deepseek",
    model,
    responseId: typeof root?.id === "string" ? root.id : "",
    ...usage,
    researchMode: input.researchMode,
    searchQueryCount: input.researchQueries?.length || 0,
    estimatedCostCny: estimateDeepSeekCostCny(usage.inputTokens, usage.outputTokens),
    fallbackUsed: false,
    fallbackReason: "",
    result,
  };
}

async function expandStructuredArticleWithDeepSeek(input: {
  sourceText: string;
  researchContext: string;
  result: CaseParserOutput;
}) {
  const prompt = `你是 DigitalX 城市数智应用案例库的资深案例研究员。现有结构化解析已经完成，但结构化案例文章过短。请只重写 article，不要修改项目身份和其他字段。

写作要求：
1. article.standfirst 写150—300字导读，keyFindings 写3—6条关键结论。
2. sections 只使用 overview、background、objectives、architecture、capabilities、delivery、investment、outcomes、boundaries、lessons、timeline，并按这个顺序返回。
3. 文章目标为3500—8000个中文字符，除非公开证据确实不足，否则不得少于 ${MIN_STRUCTURED_ARTICLE_CHARACTERS} 个字符。
4. 没有事实支撑的章节省略；同一内容不得在多个章节重复；paragraphs 写完整论述，points 只写适合列表呈现的事项。
5. 只能使用原始资料、现有结构化草稿和联网搜索摘要中的信息。不得虚构单位、金额、日期、技术参数或成效。
6. 对不确定信息明确说明“尚未从公开资料核实”，通过信息缺口和核验路径补充边界，不得重复灌水。
7. evidenceRefs 使用“来源1”这样的编号关联搜索结果；没有实际来源不得伪造编号。
8. 只返回符合下列结构的 JSON，不要使用 Markdown 代码块或添加解释：
{"article":{"standfirst":"...","keyFindings":["..."],"sections":[{"id":"overview","title":"项目概况","summary":"...","paragraphs":["..."],"points":["..."],"evidenceRefs":["来源1"]}]}}

原始资料：
${input.sourceText}

现有结构化草稿：
${JSON.stringify(input.result.case)}

联网搜索结果：
${input.researchContext}`;

  const { model, payload } = await requestDeepSeekCompletion(prompt, 12_000);

  const text = extractChatCompletionText(payload)
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = objectValue(JSON.parse(text));
  } catch {
    throw new AiProviderError(
      "deepseek",
      "DeepSeek返回的结构化文章扩写结果无法解析。",
      502,
      "deepseek_invalid_output",
    );
  }
  const article = normalizeArticle(
    objectValue(parsed?.article) as unknown as CaseArticle,
    input.result.case,
  );
  if (articleCharacterCount(article) === 0) {
    throw new AiProviderError(
      "deepseek",
      "DeepSeek没有返回可用的结构化文章扩写结果。",
      502,
      "deepseek_empty_output",
    );
  }

  const usage = chatCompletionUsage(payload);
  return {
    model,
    article,
    ...usage,
    estimatedCostCny: estimateDeepSeekCostCny(
      usage.inputTokens,
      usage.outputTokens,
    ),
  };
}

function extractQwenOutput(payload: unknown) {
  const root = objectValue(payload);
  const output = objectValue(root?.output);
  if (!Array.isArray(output?.choices)) return "";
  const first = objectValue(output.choices[0]);
  const message = objectValue(first?.message);
  return typeof message?.content === "string" ? message.content : "";
}

function extractQwenResearch(payload: unknown) {
  const root = objectValue(payload);
  const output = objectValue(root?.output);
  const searchInfo = objectValue(output?.search_info) || objectValue(root?.search_info);
  const results = Array.isArray(searchInfo?.search_results) ? searchInfo.search_results : [];
  const sources: Array<{ title: string; url: string }> = [];

  for (const raw of results.slice(0, MAX_RESEARCH_SEARCH_CALLS * 5)) {
    const item = objectValue(raw);
    const url = typeof item?.url === "string" ? item.url : "";
    if (!url.startsWith("http")) continue;
    sources.push({
      title: typeof item?.title === "string" && item.title.trim() ? item.title : url,
      url,
    });
  }

  const rawQueries =
    (Array.isArray(searchInfo?.search_queries) && searchInfo.search_queries) ||
    (Array.isArray(searchInfo?.queries) && searchInfo.queries) ||
    [];
  const queries = rawQueries.filter((value): value is string => typeof value === "string" && Boolean(value.trim()));

  return {
    sources: Array.from(new Map(sources.map((item) => [item.url, item])).values()),
    queries: Array.from(new Set(queries.map((item) => item.trim()))).slice(0, MAX_RESEARCH_SEARCH_CALLS),
  };
}

function qwenUsage(payload: unknown) {
  const root = objectValue(payload);
  const usage = objectValue(root?.usage);
  return {
    inputTokens: typeof usage?.input_tokens === "number" ? usage.input_tokens : 0,
    outputTokens: typeof usage?.output_tokens === "number" ? usage.output_tokens : 0,
  };
}

async function callQwen(input: ProviderInput): Promise<ProviderResult> {
  const apiKey = process.env.DASHSCOPE_API_KEY?.trim();
  if (!apiKey) {
    throw new AiProviderError("qwen", "千问服务尚未配置，请设置DASHSCOPE_API_KEY。", 503, "qwen_missing_key");
  }
  if (input.file && !input.sourceText.trim()) {
    throw new AiProviderError(
      "qwen",
      "该PDF未提取到足够文字。当前低成本模式不能直接识别扫描PDF，请改用文字版PDF或配置Gemini进行扫描件识别。",
      422,
      "qwen_pdf_text_required",
    );
  }

  const model = process.env.QWEN_CASE_PARSER_MODEL?.trim() || QWEN_CASE_PARSER_MODEL;
  const searchStrategy = process.env.QWEN_SEARCH_STRATEGY?.trim() === "max" ? "max" : "turbo";
  const supportsSearchStrategy =
    model.startsWith("qwen3.5-") ||
    model === "qwen3-max" ||
    model.startsWith("qwen3-max-") ||
    model.startsWith("qwen3.7-");
  let response: Response;
  try {
    response = await fetch("https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-DashScope-SSE": "disable",
      },
      body: JSON.stringify({
        model,
        input: {
          messages: [{ role: "user", content: schemaConstrainedPrompt({ ...input, researchMode: true }) }],
        },
        parameters: {
          result_format: "message",
          response_format: { type: "json_object" },
          max_tokens: 16_000,
          enable_search: true,
          search_options: {
            forced_search: true,
            enable_source: true,
            ...(supportsSearchStrategy ? { search_strategy: searchStrategy } : {}),
          },
        },
      }),
    });
  } catch {
    throw new AiProviderError("qwen", "暂时无法连接千问服务，请稍后重试。", 502, "qwen_unreachable");
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new AiProviderError("qwen", "千问返回了无法识别的响应。", 502, "qwen_invalid_response");
  }
  if (!response.ok) throw classifyProviderError("qwen", response.status, payload);

  const root = objectValue(payload);
  const usage = qwenUsage(payload);
  const research = extractQwenResearch(payload);
  const parsed = parseJsonResult("qwen", extractQwenOutput(payload));
  const result = applyLocationFallback({
    ...parsed,
    researchQueries: research.queries.length > 0 ? research.queries : parsed.researchQueries,
    researchSources: research.sources.length > 0 ? research.sources : parsed.researchSources,
  });

  return {
    provider: "qwen",
    model,
    responseId: typeof root?.request_id === "string" ? root.request_id : "",
    ...usage,
    researchMode: true,
    searchQueryCount: research.queries.length || Math.min(result.researchQueries.length, MAX_RESEARCH_SEARCH_CALLS),
    estimatedCostCny: estimateQwenCostCny(
      usage.inputTokens,
      usage.outputTokens,
      research.queries.length || Math.min(result.researchQueries.length, MAX_RESEARCH_SEARCH_CALLS),
    ),
    fallbackUsed: false,
    fallbackReason: "",
    result,
  };
}

async function callOpenAi(input: ProviderInput): Promise<ProviderResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new AiProviderError("openai", "OpenAI 服务尚未配置，请设置 OPENAI_API_KEY。", 503, "openai_missing_key");
  }

  const model = process.env.OPENAI_CASE_PARSER_MODEL?.trim() || OPENAI_CASE_PARSER_MODEL;
  const content: Array<Record<string, unknown>> = [];
  if (input.file) {
    content.push({
      type: "input_file",
      filename: input.file.name || "case-source.pdf",
      file_data: `data:application/pdf;base64,${arrayBufferToBase64(await input.file.arrayBuffer())}`,
      detail: "low",
    });
  }
  content.push({
    type: "input_text",
    text: sourcePrompt(
      input.sourceText,
      input.sourceUrl,
      Boolean(input.file),
      false,
      "",
      input.mediaCandidates,
    ),
  });

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        store: false,
        reasoning: { effort: "low" },
        max_output_tokens: 8_000,
        input: [{ role: "user", content }],
        text: {
          format: {
            type: "json_schema",
            name: "digitalx_case_extraction",
            strict: true,
            schema: caseParserJsonSchema,
          },
        },
      }),
    });
  } catch {
    throw new AiProviderError("openai", "暂时无法连接 OpenAI 服务，请稍后重试。", 502, "openai_unreachable");
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new AiProviderError("openai", "OpenAI 返回了无法识别的响应。", 502, "openai_invalid_response");
  }
  if (!response.ok) throw classifyProviderError("openai", response.status, payload);

  const root = objectValue(payload);
  return {
    provider: "openai",
    model,
    responseId: typeof root?.id === "string" ? root.id : "",
    ...openAiUsage(payload),
    researchMode: false,
    searchQueryCount: 0,
    estimatedCostCny: 0,
    fallbackUsed: false,
    fallbackReason: "",
    result: applyLocationFallback(parseJsonResult("openai", extractOpenAiText(payload))),
  };
}

async function callTencentWsaResearch(
  input: ProviderInput,
  basicResult?: ProviderResult,
): Promise<ProviderResult> {
  const basic =
    basicResult ||
    (await callDeepSeek({
      ...input,
      file: null,
      researchMode: false,
      researchContext: "",
      researchQueries: [],
      researchSources: [],
    }));
  const queries = buildTencentWsaQueries(basic.result);
  if (queries.length === 0) {
    throw new TencentWsaError("基础解析没有形成可用于联网检索的项目名称。", "MissingQuery");
  }

  const research = await gatherTencentWsaResearch(queries);
  const sourceText =
    input.sourceText.trim() ||
    `扫描PDF视觉识别形成的基础草稿（仍需结合原文件人工复核）：\n${JSON.stringify(basic.result.case)}`;
  const synthesis = await callDeepSeek({
    sourceText,
    sourceUrl: input.sourceUrl,
    file: null,
    researchMode: true,
    researchContext: formatTencentWsaResearch(research.results),
    researchQueries: research.queries,
    researchSources: research.sources,
    mediaCandidates: input.mediaCandidates,
  });

  return {
    ...synthesis,
    model:
      basic.provider === "deepseek"
        ? `${synthesis.model} + Tencent WSA Lite`
        : `${basic.model} → ${synthesis.model} + Tencent WSA Lite`,
    inputTokens: basic.inputTokens + synthesis.inputTokens,
    outputTokens: basic.outputTokens + synthesis.outputTokens,
    searchQueryCount: research.queries.length,
    estimatedCostCny: Number(
      (
        basic.estimatedCostCny +
        synthesis.estimatedCostCny +
        research.queries.length * TENCENT_WSA_LITE_SEARCH_COST_CNY
      ).toFixed(4),
    ),
    fallbackUsed: false,
    fallbackReason: "",
  };
}

async function callZhipuResearch(
  input: ProviderInput,
  basicResult?: ProviderResult,
): Promise<ProviderResult> {
  const basic =
    basicResult ||
    (await callDeepSeek({
      ...input,
      file: null,
      researchMode: false,
      researchContext: "",
      researchQueries: [],
      researchSources: [],
    }));
  const queries = buildResearchQueries(basic.result, input.sourceText);
  if (queries.length === 0) {
    throw new ZhipuSearchError(
      "基础解析没有形成可用于联网检索的项目信息。",
      422,
      "MissingQuery",
    );
  }

  const research = await gatherZhipuResearch(queries);
  const sourceText =
    input.sourceText.trim() ||
    `扫描PDF视觉识别形成的基础草稿（仍需结合原文件人工复核）：\n${JSON.stringify(basic.result.case)}`;
  const synthesis = await callDeepSeek({
    sourceText,
    sourceUrl: input.sourceUrl,
    file: null,
    researchMode: true,
    researchContext: formatZhipuResearch(research.results),
    researchQueries: research.queries,
    researchSources: research.sources,
    mediaCandidates: input.mediaCandidates,
  });

  return {
    ...synthesis,
    model:
      basic.provider === "deepseek"
        ? `${synthesis.model} + Zhipu Search Std`
        : `${basic.model} → ${synthesis.model} + Zhipu Search Std`,
    inputTokens: basic.inputTokens + synthesis.inputTokens,
    outputTokens: basic.outputTokens + synthesis.outputTokens,
    searchQueryCount: research.queries.length,
    estimatedCostCny: Number(
      (
        basic.estimatedCostCny +
        synthesis.estimatedCostCny +
        research.queries.length * ZHIPU_SEARCH_STD_COST_CNY
      ).toFixed(4),
    ),
    fallbackUsed: false,
    fallbackReason: "",
  };
}

async function callTavilyResearch(
  input: ProviderInput,
  basicResult?: ProviderResult,
): Promise<ProviderResult> {
  const basic =
    basicResult ||
    (await callDeepSeek({
      ...input,
      file: null,
      researchMode: false,
      researchContext: "",
      researchQueries: [],
      researchSources: [],
    }));
  const queries = buildResearchQueries(basic.result, input.sourceText).slice(
    0,
    MAX_TAVILY_SEARCH_QUERIES,
  );
  if (queries.length === 0) {
    throw new TavilySearchError(
      "基础解析没有形成可用于联网检索的项目信息。",
      422,
      "MissingQuery",
    );
  }

  const research = await gatherTavilyResearch(queries);
  const researchContext = formatTavilyResearch(research.results);
  const sourceText =
    input.sourceText.trim() ||
    `扫描PDF视觉识别形成的基础草稿（仍需结合原文件人工复核）：\n${JSON.stringify(basic.result.case)}`;
  let synthesis = await callDeepSeek({
    sourceText,
    sourceUrl: input.sourceUrl,
    file: null,
    researchMode: true,
    researchContext,
    researchQueries: research.queries,
    researchSources: research.sources,
    mediaCandidates: input.mediaCandidates,
  });
  if (
    articleCharacterCount(synthesis.result.article) <
    MIN_STRUCTURED_ARTICLE_CHARACTERS
  ) {
    try {
      const expansion = await expandStructuredArticleWithDeepSeek({
        sourceText,
        researchContext,
        result: synthesis.result,
      });
      if (
        articleCharacterCount(expansion.article) >
        articleCharacterCount(synthesis.result.article)
      ) {
        synthesis = {
          ...synthesis,
          model: `${synthesis.model} + article expansion`,
          inputTokens: synthesis.inputTokens + expansion.inputTokens,
          outputTokens: synthesis.outputTokens + expansion.outputTokens,
          estimatedCostCny: Number(
            (
              synthesis.estimatedCostCny + expansion.estimatedCostCny
            ).toFixed(4),
          ),
          result: {
            ...synthesis.result,
            article: expansion.article,
          },
        };
      }
    } catch {
      // 保留已生成的短文章，避免一次扩写失败让整个联网解析降级。
    }
  }

  return {
    ...synthesis,
    model:
      basic.provider === "deepseek"
        ? `${synthesis.model} + Tavily Basic Search`
        : `${basic.model} → ${synthesis.model} + Tavily Basic Search`,
    inputTokens: basic.inputTokens + synthesis.inputTokens,
    outputTokens: basic.outputTokens + synthesis.outputTokens,
    searchQueryCount: research.queries.length,
    estimatedCostCny: Number(
      (
        basic.estimatedCostCny +
        synthesis.estimatedCostCny +
        research.queries.length * TAVILY_PAYG_SEARCH_COST_CNY
      ).toFixed(4),
    ),
    fallbackUsed: false,
    fallbackReason: "",
  };
}

export function configuredProvider(): AiCaseParserProvider {
  const value = process.env.AI_CASE_PARSER_PROVIDER?.trim().toLowerCase();
  return value === "openai" || value === "gemini" || value === "qwen" || value === "deepseek"
    ? value
    : DEFAULT_AI_CASE_PARSER_PROVIDER;
}

function configuredResearchProvider() {
  const value = process.env.AI_CASE_RESEARCH_PROVIDER?.trim().toLowerCase();
  if (value === "tavily" || value === "zhipu" || value === "tencent_wsa") return value;
  return "qwen";
}

type SearchResearchProvider = "tavily" | "zhipu" | "tencent_wsa";

function callSearchResearch(
  provider: SearchResearchProvider,
  input: ProviderInput,
  basic: ProviderResult,
) {
  if (provider === "tavily") return callTavilyResearch(input, basic);
  if (provider === "zhipu") return callZhipuResearch(input, basic);
  return callTencentWsaResearch(input, basic);
}

function friendlySearchResearchError(provider: SearchResearchProvider, error: unknown) {
  if (provider === "tavily") return friendlyTavilySearchError(error);
  if (provider === "zhipu") return friendlyZhipuSearchError(error);
  return friendlyTencentWsaError(error);
}

export async function researchCaseSources(
  input: ProviderInput,
  basic: ProviderResult,
): Promise<CaseResearchBundle> {
  const provider = configuredResearchProvider();
  if (provider === "tavily") {
    const queries = buildResearchQueries(basic.result, input.sourceText).slice(
      0,
      MAX_TAVILY_SEARCH_QUERIES,
    );
    const research = await gatherTavilyResearch(queries);
    return {
      provider,
      queries: research.queries,
      sources: research.sources,
      context: formatTavilyResearch(research.results),
      estimatedCostCny: Number(
        (research.queries.length * TAVILY_PAYG_SEARCH_COST_CNY).toFixed(4),
      ),
    };
  }
  if (provider === "zhipu") {
    const queries = buildResearchQueries(basic.result, input.sourceText).slice(
      0,
      MAX_ZHIPU_SEARCH_QUERIES,
    );
    const research = await gatherZhipuResearch(queries);
    return {
      provider,
      queries: research.queries,
      sources: research.sources,
      context: formatZhipuResearch(research.results),
      estimatedCostCny: Number(
        (research.queries.length * ZHIPU_SEARCH_STD_COST_CNY).toFixed(4),
      ),
    };
  }
  if (provider === "tencent_wsa") {
    const queries = buildTencentWsaQueries(basic.result);
    const research = await gatherTencentWsaResearch(queries);
    return {
      provider,
      queries: research.queries,
      sources: research.sources,
      context: formatTencentWsaResearch(research.results),
      estimatedCostCny: Number(
        (research.queries.length * TENCENT_WSA_LITE_SEARCH_COST_CNY).toFixed(4),
      ),
    };
  }

  const qwen = await callQwen({ ...input, researchMode: true });
  return {
    provider: "qwen",
    queries: qwen.result.researchQueries,
    sources: qwen.result.researchSources,
    context: [
      "千问联网研究形成的结构化草稿：",
      JSON.stringify({
        identity: qwen.result.identity,
        case: qwen.result.case,
        article: qwen.result.article,
      }),
    ].join("\n"),
    estimatedCostCny: qwen.estimatedCostCny,
  };
}

export async function parseCaseWithProvider(input: ProviderInput) {
  if (input.file && !input.sourceText.trim()) {
    const basic = await callGemini({ ...input, researchMode: false });
    if (!input.researchMode) return basic;
    const researchProvider = configuredResearchProvider();
    if (researchProvider === "qwen") {
      return {
        ...basic,
        fallbackUsed: true,
        fallbackReason: "扫描PDF已使用Gemini完成基础识别；当前研究服务商不支持继续执行联网长文研究。",
      };
    }
    try {
      return await callSearchResearch(researchProvider, input, basic);
    } catch (error) {
      return {
        ...basic,
        fallbackUsed: true,
        fallbackReason: `扫描PDF已完成基础识别，但联网研究暂不可用：${friendlySearchResearchError(researchProvider, error)}`,
      };
    }
  }

  if (input.researchMode) {
    const researchProvider = configuredResearchProvider();
    if (researchProvider !== "qwen") {
      const basic = await callDeepSeek({ ...input, researchMode: false });
      try {
        return await callSearchResearch(researchProvider, input, basic);
      } catch (error) {
        return {
          ...basic,
          fallbackUsed: true,
          fallbackReason: `联网研究暂不可用，已保留DeepSeek基础解析结果：${friendlySearchResearchError(researchProvider, error)}`,
        };
      }
    }
    try {
      return await callQwen(input);
    } catch (error) {
      if (!(error instanceof AiProviderError)) throw error;
      const fallback = await callDeepSeek({ ...input, researchMode: false });
      return {
        ...fallback,
        fallbackUsed: true,
        fallbackReason: `联网研究暂不可用，已自动使用DeepSeek完成基础解析：${error.message}`,
      };
    }
  }

  const provider = configuredProvider();
  if (provider === "openai") return callOpenAi(input);
  if (provider === "gemini") return callGemini(input);
  if (provider === "qwen") return callQwen({ ...input, researchMode: false });
  return callDeepSeek(input);
}
