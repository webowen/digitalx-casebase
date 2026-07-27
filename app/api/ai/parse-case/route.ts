import {
  MAX_CASE_PDF_BYTES,
  MAX_CASE_SOURCE_CHARACTERS,
  type CaseParserResponse,
} from "@/lib/ai-case-parser";
import {
  AiProviderError,
  parseCaseWithProvider,
} from "@/lib/ai-case-parser-providers";

export const runtime = "edge";

function jsonError(message: string, status: number, code: string) {
  return Response.json({ error: { message, code } }, { status });
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
  const researchMode = String(formData.get("researchMode") || "") === "true";
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

  try {
    const parsed = await parseCaseWithProvider({ sourceText, sourceUrl, file, researchMode });
    const response: CaseParserResponse = {
      result: parsed.result,
      meta: {
        provider: parsed.provider,
        model: parsed.model,
        responseId: parsed.responseId,
        inputTokens: parsed.inputTokens,
        outputTokens: parsed.outputTokens,
        researchMode: parsed.researchMode,
        searchQueryCount: parsed.searchQueryCount,
        estimatedCostCny: parsed.estimatedCostCny,
        fallbackUsed: parsed.fallbackUsed,
        fallbackReason: parsed.fallbackReason,
      },
    };
    return Response.json(response);
  } catch (error) {
    if (error instanceof AiProviderError) {
      return jsonError(error.message, error.status, error.code);
    }
    return jsonError("AI 解析失败，请稍后重试。", 502, "ai_parser_error");
  }
}
