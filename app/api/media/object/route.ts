import { getMediaBucket } from "@/lib/server-media-storage";

export const runtime = "edge";

export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get("key") || "";
  if (!key.startsWith("cases/") || key.includes("..")) {
    return new Response("Invalid media key", { status: 400 });
  }
  const mediaBucket = await getMediaBucket();
  const object = await mediaBucket.get(key);
  if (!object) return new Response("Image not found", { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("x-content-type-options", "nosniff");
  return new Response(object.body, { headers });
}

export async function DELETE(request: Request) {
  const key = new URL(request.url).searchParams.get("key") || "";
  if (!key.startsWith("cases/") || key.includes("..")) {
    return new Response("Invalid media key", { status: 400 });
  }
  const mediaBucket = await getMediaBucket();
  await mediaBucket.delete(key);
  return new Response(null, { status: 204 });
}
