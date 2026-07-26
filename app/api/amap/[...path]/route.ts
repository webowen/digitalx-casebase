export const dynamic = "force-dynamic";

const SERVICE_PREFIX = "/api/amap/_AMapService";

function buildTarget(request: Request) {
  const securityCode = process.env.AMAP_SECURITY_CODE;
  if (!securityCode) return null;

  const incoming = new URL(request.url);
  const suffix = incoming.pathname.slice(SERVICE_PREFIX.length);
  const isCustomStyle = suffix === "/v4/map/styles" || suffix.startsWith("/v4/map/styles/");
  const target = new URL(
    suffix || "/",
    isCustomStyle ? "https://webapi.amap.com" : "https://restapi.amap.com",
  );

  incoming.searchParams.forEach((value, key) => target.searchParams.append(key, value));
  target.searchParams.set("jscode", securityCode);
  return target;
}

async function proxy(request: Request) {
  const target = buildTarget(request);
  if (!target) {
    return Response.json({ message: "地图代理尚未完成配置" }, { status: 503 });
  }

  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  const referer = request.headers.get("referer");
  if (referer) headers.set("referer", referer);

  const upstream = await fetch(target, {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
    redirect: "follow",
  });

  const responseHeaders = new Headers();
  for (const name of ["content-type", "cache-control", "etag", "last-modified"]) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  responseHeaders.set("Access-Control-Allow-Origin", "*");

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export async function GET(request: Request) {
  return proxy(request);
}

export async function POST(request: Request) {
  return proxy(request);
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
