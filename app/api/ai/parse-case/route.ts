import {
  CASE_PARSER_MODEL,
  MAX_CASE_PDF_BYTES,
  MAX_CASE_SOURCE_CHARACTERS,
  caseParserJsonSchema,
  type CaseParserOutput,
  type CaseParserResponse,
} from "@/lib/ai-case-parser";

export const runtime = "edge";

const parserInstructions = `你是 DigitalX 城市数智应用案例库的资料解析器。你的任务是从用户提供的原始资料中提取可复核的智慧城市案例草稿。

必须遵守：
1. 只根据原始资料提取，不得用常识补齐资料没有提供的事实。
2. 未明确的信息使用空字符串、空数组或 year=0，不得猜测单位、金额、成效和时间。
3. title、summary、painPoints、solution、outcomes 应使用简洁准确的中文。
4. sourceExcerpt 和每项 evidence 必须是原始资料中可定位的短摘录，不得改写成不存在的引文。
5. “成效”必须区分已实现成果和预期目标；只有明确的验收数据或已发生结果才可作为强证据。
6. expertView 只写需要进一步核验的专业判断，不得把推测写成结论。
7. fieldAssessments 覆盖关键字段，confidence 为 0 到 1；证据不足时 needsReview=true。
8. 如果输入不是智慧城市、城市治理或城市数字化项目资料，compatible=false，并说明原因；仍按 schema 返回空白案例对象。
9. AI 只生成草稿，最终内容必须由人工复核后发布。`;

function jsonError(message: string, status: number, code: string) {
  return Response.json({ error: { message, code } }, { status });
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

function extractOutputText(payload: unknown) {
  if (!payload || typeof payload !== "object" || !("output" in payload) || !Array.isArray(payload.output)) {
    return "";
  }

  for (const item of payload.output) {
    if (!item || typeof item !== "object" || !("content" in item) || !Array.isArray(item.content)) continue;
    for (const content of item.content) {
      if (
        content &&
        typeof content === "object" &&
        "type" in content &&
        content.type === "output_text" &&
        "text" in content &&
        typeof content.text === "string"
      ) {
        return content.text;
      }
    }
  }

  return "";
}

function getUsage(payload: unknown) {
  if (!payload || typeof payload !== "object" || !("usage" in payload) || !payload.usage || typeof payload.usage !== "object") {
    return { inputTokens: 0, outputTokens: 0 };
  }

  const usage = payload.usage as Record<string, unknown>;
  return {
    inputTokens: typeof usage.input_tokens === "number" ? usage.input_tokens : 0,
    outputTokens: typeof usage.output_tokens === "number" ? usage.output_tokens : 0,
  };
}

function getResponseId(payload: unknown) {
  return payload && typeof payload === "object" && "id" in payload && typeof payload.id === "string" ? payload.id : "";
}

function getOpenAiError(payload: unknown) {
  if (!payload || typeof payload !== "object" || !("error" in payload) || !payload.error || typeof payload.error !== "object") {
    return "";
  }
  const error = payload.error as Record<string, unknown>;
  return typeof error.message === "string" ? error.message : "";
}

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError("无法读取提交的资料。", 400, "invalid_form_data");
  }

  const sourceText = String(formData.get("sourceText") || "").trim();
  const sourceUrl = String(formData.get("sourceUrl") || "").trim();
  const fileValue = formData.get("file");
  const file = fileValue instanceof File && fileValue.size > 0 ? fileValue : null;

  if (!sourceText && !file) {
    return jsonError("请粘贴原始资料正文，或选择一个 PDF 文件。", 400, "missing_source");
  }
  if (sourceText.length > MAX_CASE_SOURCE_CHARACTERS) {
    return jsonError(`原始正文不能超过 ${MAX_CASE_SOURCE_CHARACTERS.toLocaleString()} 个字符。`, 413, "text_too_large");
  }
  if (file && file.type !== "application/pdf") {
    return jsonError("第一版真实解析仅支持 PDF 文件。", 415, "unsupported_file_type");
  }
  if (file && file.size > MAX_CASE_PDF_BYTES) {
    return jsonError("PDF 文件不能超过 8MB。", 413, "file_too_large");
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return jsonError("AI 服务尚未配置，请先设置 OPENAI_API_KEY。", 503, "missing_api_key");
  }

  const content: Array<Record<string, unknown>> = [];
  if (file) {
    const fileData = arrayBufferToBase64(await file.arrayBuffer());
    content.push({
      type: "input_file",
      filename: file.name || "case-source.pdf",
      file_data: `data:application/pdf;base64,${fileData}`,
      detail: "low",
    });
  }

  const sourceContext = [
    sourceUrl ? `来源网址（仅作元数据，不代表已抓取网页）：${sourceUrl}` : "",
    sourceText ? `原始资料正文：\n${sourceText}` : "请解析随请求附带的 PDF 原始资料。",
  ]
    .filter(Boolean)
    .join("\n\n");

  content.push({
    type: "input_text",
    text: `请把以下资料解析为智慧城市案例草稿，并返回严格符合 schema 的结果。\n\n${sourceContext}`,
  });

  const model = process.env.OPENAI_CASE_PARSER_MODEL?.trim() || CASE_PARSER_MODEL;
  let openAiResponse: Response;

  try {
    openAiResponse = await fetch("https://api.openai.com/v1/responses", {
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
        instructions: parserInstructions,
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
    return jsonError("暂时无法连接 AI 服务，请稍后重试。", 502, "openai_unreachable");
  }

  let payload: unknown;
  try {
    payload = await openAiResponse.json();
  } catch {
    return jsonError("AI 服务返回了无法识别的响应。", 502, "invalid_openai_response");
  }

  if (!openAiResponse.ok) {
    const upstreamMessage = getOpenAiError(payload);
    const message =
      openAiResponse.status === 401
        ? "AI API Key 无效或已失效。"
        : openAiResponse.status === 429
          ? "AI 调用额度不足或请求过于频繁，请检查 Platform 账单与限额。"
          : upstreamMessage || "AI 解析失败，请稍后重试。";
    return jsonError(message, openAiResponse.status === 429 ? 429 : 502, "openai_error");
  }

  const outputText = extractOutputText(payload);
  if (!outputText) {
    return jsonError("AI 没有返回可用的结构化结果，请重试。", 502, "empty_ai_output");
  }

  let result: CaseParserOutput;
  try {
    result = JSON.parse(outputText) as CaseParserOutput;
  } catch {
    return jsonError("AI 返回的结构化结果无法解析，请重试。", 502, "invalid_ai_output");
  }

  const usage = getUsage(payload);
  const response: CaseParserResponse = {
    result,
    meta: {
      model,
      responseId: getResponseId(payload),
      ...usage,
    },
  };

  return Response.json(response);
}
