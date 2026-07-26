export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const key = process.env.AMAP_JS_KEY;

  if (!key) {
    return Response.json(
      { message: "地图服务尚未完成配置" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const origin = new URL(request.url).origin;
  return Response.json(
    {
      key,
      serviceHost: `${origin}/api/amap/_AMapService`,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
