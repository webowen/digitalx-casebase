import {
  DEFAULT_AI_CASE_PARSER_PROVIDER,
  GEMINI_CASE_PARSER_MODEL,
  OPENAI_CASE_PARSER_MODEL,
  caseParserJsonSchema,
  type AiCaseParserProvider,
  type CaseParserOutput,
} from "./ai-case-parser";
import { applyLocationFallback } from "./location-resolution";

export const parserInstructions = `你是 DigitalX 城市数智应用案例库的资料解析器。你的任务是从用户提供的原始资料中提取可复核的智慧城市案例草稿。

必须遵守：
1. 原始资料明确提供的事实优先；联网研究资料只能作为补充，并必须保留可验证来源。
2. 未明确的信息使用空字符串、空数组或 year=0，不得猜测单位、金额、成效和时间。
3. title、summary、painPoints、solution、outcomes 应使用简洁准确的中文。
4. sourceExcerpt 和每项 evidence 必须是原始资料中可定位的短摘录，不得改写成不存在的引文。
5. “成效”必须区分已实现成果和预期目标；只有明确的验收数据或已发生结果才可作为强证据。
6. expertView 只写需要进一步核验的专业判断，不得把推测写成结论。
7. fieldAssessments 覆盖关键字段，confidence 为 0 到 1；证据不足时 needsReview=true。
8. 如果输入不是智慧城市、城市治理或城市数字化项目资料，compatible=false，并说明原因；仍按 schema 返回空白案例对象。
9. AI 只生成草稿，最终内容必须由人工复核后发布。`;

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
3. researchReport 写成完整中文案例研究，使用 Markdown 二级标题组织，优先覆盖：项目背景、建设目标、组织与投资、总体架构、数据体系、功能模块、实施过程、运营机制、成效证据、问题边界、可复制经验、时间线和待核验事项。
4. 公开资料充分时目标为 3000—12000 个中文字符；资料不足时宁可明确写“未检索到”，不能重复灌水或编造内容。
5. researchSources 只填写本次实际检索并用于报告的来源；researchQueries 填写实际检索词。`;

type ProviderInput = {
  sourceText: string;
  sourceUrl: string;
  file: File | null;
  researchMode: boolean;
};

export type ProviderResult = {
  provider: AiCaseParserProvider;
  model: string;
  responseId: string;
  inputTokens: number;
  outputTokens: number;
  researchMode: boolean;
  searchQueryCount: number;
  result: CaseParserOutput;
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

function sourcePrompt(sourceText: string, sourceUrl: string, hasFile: boolean, researchMode: boolean) {
  const sourceContext = [
    sourceUrl ? `来源网址（仅作元数据，不代表已抓取网页）：${sourceUrl}` : "",
    sourceText ? `原始资料正文：\n${sourceText}` : hasFile ? "请解析随请求附带的 PDF 原始资料。" : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return `${parserInstructions}

${locationInstructions}

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
    message: typeof error?.message === "string" ? error.message : "",
    status: typeof error?.status === "string" ? error.status : "",
    code: typeof error?.code === "string" || typeof error?.code === "number" ? String(error.code) : "",
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
    return new AiProviderError(provider, `${provider === "gemini" ? "Gemini" : "OpenAI"} API Key 无效或已失效。`, 502, `${provider}_invalid_key`);
  }
  if (status === 403) {
    return new AiProviderError(provider, `${provider === "gemini" ? "Gemini" : "OpenAI"} 项目没有调用该模型的权限。`, 502, `${provider}_forbidden`);
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
        ? `${provider === "gemini" ? "Gemini 免费额度" : "OpenAI API 余额"}已用尽或当前项目限额不足。`
        : `${provider === "gemini" ? "Gemini" : "OpenAI"} 请求过于频繁，请稍后重试。`,
      429,
      quotaExhausted ? `${provider}_quota_exhausted` : `${provider}_rate_limited`,
    );
  }

  return new AiProviderError(
    provider,
    upstream.message || `${provider === "gemini" ? "Gemini" : "OpenAI"} 解析失败，请稍后重试。`,
    status >= 400 && status < 500 ? 400 : 502,
    `${provider}_error`,
  );
}

function parseJsonResult(provider: AiCaseParserProvider, text: string) {
  if (!text) {
    throw new AiProviderError(provider, "AI 没有返回可用的结构化结果，请重试。", 502, `${provider}_empty_output`);
  }

  try {
    return JSON.parse(text) as CaseParserOutput;
  } catch {
    throw new AiProviderError(provider, "AI 返回的结构化结果无法解析，请重试。", 502, `${provider}_invalid_output`);
  }
}

function extractGeminiText(payload: unknown) {
  const root = objectValue(payload);
  if (typeof root?.output_text === "string") return root.output_text;
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
  const usage = objectValue(root?.usage_metadata) || objectValue(root?.usage);
  const directInput =
    typeof usage?.total_input_tokens === "number"
      ? usage.total_input_tokens
      : typeof usage?.input_token_count === "number"
        ? usage.input_token_count
        : typeof usage?.input_tokens === "number"
          ? usage.input_tokens
          : 0;
  const directOutput =
    typeof usage?.total_output_tokens === "number"
      ? usage.total_output_tokens
      : typeof usage?.output_token_count === "number"
        ? usage.output_token_count
        : typeof usage?.output_tokens === "number"
          ? usage.output_tokens
          : 0;
  const thoughtTokens = typeof usage?.total_thought_tokens === "number" ? usage.total_thought_tokens : 0;

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

  const model = process.env.GEMINI_CASE_PARSER_MODEL?.trim() || GEMINI_CASE_PARSER_MODEL;
  const content: Array<Record<string, unknown>> = [];
  if (input.file) {
    content.push({
      type: "document",
      data: arrayBufferToBase64(await input.file.arrayBuffer()),
      mime_type: "application/pdf",
    });
  }
  content.push({ type: "text", text: sourcePrompt(input.sourceText, input.sourceUrl, Boolean(input.file), input.researchMode) });

  let response: Response;
  try {
    response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        model,
        store: false,
        input: content,
        tools: input.researchMode ? [{ type: "google_search" }] : undefined,
        generation_config: input.researchMode ? { thinking_level: "medium" } : { thinking_level: "low" },
        response_format: {
          type: "text",
          mime_type: "application/json",
          schema: caseParserJsonSchema,
        },
      }),
    });
  } catch {
    throw new AiProviderError("gemini", "暂时无法连接 Gemini 服务，请稍后重试。", 502, "gemini_unreachable");
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new AiProviderError("gemini", "Gemini 返回了无法识别的响应。", 502, "gemini_invalid_response");
  }
  if (!response.ok) throw classifyProviderError("gemini", response.status, payload);

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
    result: groundedResult,
  };
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
    text: sourcePrompt(input.sourceText, input.sourceUrl, Boolean(input.file), false),
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
    result: applyLocationFallback(parseJsonResult("openai", extractOpenAiText(payload))),
  };
}

export function configuredProvider(): AiCaseParserProvider {
  return process.env.AI_CASE_PARSER_PROVIDER?.trim().toLowerCase() === "openai"
    ? "openai"
    : DEFAULT_AI_CASE_PARSER_PROVIDER;
}

export async function parseCaseWithProvider(input: ProviderInput) {
  return configuredProvider() === "openai" ? callOpenAi(input) : callGemini(input);
}
