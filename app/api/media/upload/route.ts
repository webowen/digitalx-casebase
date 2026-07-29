import {
  getMediaBucket,
  mediaObjectUrl,
  safeMediaPart,
} from "@/lib/server-media-storage";

export const runtime = "edge";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "无法读取图片。" }, { status: 400 });
  }
  const value = formData.get("file");
  const file = value instanceof File ? value : null;
  if (!file || !allowedTypes.has(file.type)) {
    return Response.json({ error: "仅支持 JPG、PNG 或 WebP 图片。" }, { status: 415 });
  }
  if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
    return Response.json({ error: "单张图片不能超过4MB。" }, { status: 413 });
  }

  const caseId = safeMediaPart(String(formData.get("caseId") || ""), "draft");
  const candidateId = safeMediaPart(
    String(formData.get("candidateId") || ""),
    crypto.randomUUID(),
  );
  const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const key = `cases/${caseId}/${candidateId}-${crypto.randomUUID()}.${extension}`;

  const mediaBucket = await getMediaBucket();
  await mediaBucket.put(key, file.stream(), {
    httpMetadata: {
      contentType: file.type,
      cacheControl: "public, max-age=31536000, immutable",
    },
    customMetadata: {
      originalName: file.name.slice(0, 180),
      candidateId,
    },
  });

  return Response.json({ key, url: mediaObjectUrl(key) });
}
