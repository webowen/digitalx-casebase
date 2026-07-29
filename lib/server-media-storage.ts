type StoredMediaObject = {
  body: ReadableStream;
  httpEtag: string;
  httpMetadata?: {
    contentType?: string;
    cacheControl?: string;
  };
  writeHttpMetadata(headers: Headers): void;
};

type MediaBucket = {
  put(
    key: string,
    value: ReadableStream | ArrayBuffer,
    options?: {
      httpMetadata?: { contentType?: string; cacheControl?: string };
      customMetadata?: Record<string, string>;
    },
  ): Promise<unknown>;
  get(key: string): Promise<StoredMediaObject | null>;
  delete(key: string): Promise<void>;
};

export async function getMediaBucket() {
  // Delay resolving the Cloudflare runtime module until a media request is
  // actually handled. Sites' Node-side artifact validator imports route
  // modules, but does not provide the `cloudflare:` URL scheme.
  const { env } = await import("cloudflare:workers");
  return (env as unknown as { BUCKET: MediaBucket }).BUCKET;
}

export function safeMediaPart(value: string, fallback: string) {
  const normalized = value
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return normalized || fallback;
}

export function mediaObjectUrl(key: string) {
  return `/api/media/object?key=${encodeURIComponent(key)}`;
}

export function parsePublicHttpUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host === "::1" ||
    host.endsWith(".local") ||
    host.startsWith("127.") ||
    host.startsWith("10.") ||
    host.startsWith("192.168.") ||
    host.startsWith("169.254.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  ) {
    return null;
  }
  return url;
}
