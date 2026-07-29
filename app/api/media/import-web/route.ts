import {
  getMediaBucket,
  mediaObjectUrl,
  parsePublicHttpUrl,
  safeMediaPart,
} from "@/lib/server-media-storage";

export const runtime = "edge";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    url?: string;
    caseId?: string;
    candidateId?: string;
  } | null;
  const sourceUrl = parsePublicHttpUrl(body?.url || "");
  if (!sourceUrl) {
    return Response.json({ error: "图片地址无效。" }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  let response: Response;
  try {
    response = await fetch(sourceUrl, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "DigitalXCasebase/1.0 (+case research image import)",
        accept: "image/jpeg,image/png,image/webp",
      },
    });
  } catch {
    clearTimeout(timeout);
    return Response.json({ error: "原网页图片无法下载。" }, { status: 422 });
  }
  clearTimeout(timeout);
  if (!response.ok) {
    return Response.json({ error: `图片返回 ${response.status}。` }, { status: 422 });
  }
  if (!parsePublicHttpUrl(response.url)) {
    return Response.json({ error: "图片重定向到了不允许访问的地址。" }, { status: 422 });
  }
  const contentType = (response.headers.get("content-type") || "").split(";")[0];
  if (!["image/jpeg", "image/png", "image/webp"].includes(contentType)) {
    return Response.json({ error: "网页资源不是支持的图片格式。" }, { status: 415 });
  }
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > MAX_IMAGE_BYTES) {
    return Response.json({ error: "网页图片超过4MB。" }, { status: 413 });
  }
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength <= 0 || buffer.byteLength > MAX_IMAGE_BYTES) {
    return Response.json({ error: "网页图片为空或超过4MB。" }, { status: 413 });
  }

  const caseId = safeMediaPart(body?.caseId || "", "draft");
  const candidateId = safeMediaPart(body?.candidateId || "", crypto.randomUUID());
  const extension = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  const key = `cases/${caseId}/${candidateId}-${crypto.randomUUID()}.${extension}`;
  const mediaBucket = await getMediaBucket();
  await mediaBucket.put(key, buffer, {
    httpMetadata: {
      contentType,
      cacheControl: "public, max-age=31536000, immutable",
    },
    customMetadata: {
      sourceUrl: sourceUrl.href.slice(0, 900),
      candidateId,
    },
  });

  return Response.json({ key, url: mediaObjectUrl(key) });
}
