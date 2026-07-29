import type { CaseMediaCandidate } from "@/lib/case-model";
import { parsePublicHttpUrl } from "@/lib/server-media-storage";

export const runtime = "edge";

const MAX_HTML_CHARACTERS = 2_000_000;

function attribute(tag: string, name: string) {
  const match = tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i"));
  return match?.[1]?.trim() || "";
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { url?: string } | null;
  const pageUrl = parsePublicHttpUrl(body?.url || "");
  if (!pageUrl) {
    return Response.json({ error: "请输入可公开访问的网页地址。" }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  let response: Response;
  try {
    response = await fetch(pageUrl, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "DigitalXCasebase/1.0 (+case research image extraction)",
        accept: "text/html,application/xhtml+xml",
      },
    });
  } catch {
    clearTimeout(timeout);
    return Response.json({ error: "网页无法访问或拒绝自动读取。" }, { status: 422 });
  }
  clearTimeout(timeout);
  if (!response.ok) {
    return Response.json({ error: `网页返回 ${response.status}，无法提取图片。` }, { status: 422 });
  }
  if (!parsePublicHttpUrl(response.url)) {
    return Response.json({ error: "网页重定向到了不允许访问的地址。" }, { status: 422 });
  }
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) {
    return Response.json({ error: "该地址不是可解析的网页。" }, { status: 415 });
  }
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > MAX_HTML_CHARACTERS * 2) {
    return Response.json({ error: "网页体积过大，无法安全提取图片。" }, { status: 413 });
  }
  const html = (await response.text()).slice(0, MAX_HTML_CHARACTERS);
  const candidates: CaseMediaCandidate[] = [];
  const seen = new Set<string>();

  const addCandidate = (rawUrl: string, nearbyText: string, score: number) => {
    let resolved: URL;
    try {
      resolved = new URL(rawUrl, pageUrl);
    } catch {
      return;
    }
    if (!parsePublicHttpUrl(resolved.href)) return;
    if (/(\.svg|\.gif|favicon|logo|avatar|qrcode|qr-code)(?:[?#]|$)/i.test(resolved.href)) return;
    if (seen.has(resolved.href)) return;
    seen.add(resolved.href);
    candidates.push({
      id: `web-image-${candidates.length + 1}`,
      sourceKind: "web_image",
      pageNumber: 0,
      sourceUrl: resolved.href,
      nearbyText: nearbyText.slice(0, 520),
      visualScore: score,
    });
  };

  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const property = attribute(tag, "property") || attribute(tag, "name");
    if (/^(og:image|twitter:image)$/i.test(property)) {
      addCandidate(attribute(tag, "content"), "网页分享主图", 0.82);
    }
  }
  for (const tag of html.match(/<img\b[^>]*>/gi) || []) {
    const src =
      attribute(tag, "data-original") ||
      attribute(tag, "data-src") ||
      attribute(tag, "data-lazy-src") ||
      attribute(tag, "src");
    const alt = attribute(tag, "alt");
    const width = Number(attribute(tag, "width")) || 0;
    const height = Number(attribute(tag, "height")) || 0;
    if ((width > 0 && width < 240) || (height > 0 && height < 140)) continue;
    const keywordBoost = /平台|系统|驾驶舱|大屏|架构|流程|地图|模型|BIM|CIM|孪生|现场/i.test(alt)
      ? 0.2
      : 0;
    addCandidate(src, alt || "网页正文图片", Math.min(0.9, 0.55 + keywordBoost));
    if (candidates.length >= 12) break;
  }

  return Response.json({ candidates: candidates.slice(0, 12) });
}
