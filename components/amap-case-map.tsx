"use client";

import { useEffect, useRef, useState } from "react";

export type AMapCityPoint = {
  city: string;
  province: string;
  count: number;
  lng: number;
  lat: number;
};

type AMapPointData = AMapCityPoint & {
  lnglat: [number, number];
  active: boolean;
};

type MarkerLike = {
  setContent(content: HTMLElement | string): void;
  setOffset(offset: unknown): void;
};

type ClusterRenderContext = {
  marker: MarkerLike;
  count: number;
  data: AMapPointData[];
};

type ClusterLike = {
  setMap(map: MapLike | null): void;
};

type MapLike = {
  addControl(control: unknown): void;
  destroy(): void;
  setFitView(): void;
  setZoomAndCenter(zoom: number, center: [number, number], immediately?: boolean, duration?: number): void;
};

type AMapNamespace = {
  Map: new (container: HTMLElement, options: Record<string, unknown>) => MapLike;
  MarkerCluster: new (
    map: MapLike,
    data: AMapPointData[],
    options: Record<string, unknown>,
  ) => ClusterLike;
  Pixel: new (x: number, y: number) => unknown;
  Scale: new (options?: Record<string, unknown>) => unknown;
  ToolBar: new (options?: Record<string, unknown>) => unknown;
};

declare global {
  interface Window {
    AMap?: AMapNamespace;
    _AMapSecurityConfig?: {
      serviceHost: string;
    };
  }
}

let amapLoader: Promise<AMapNamespace> | null = null;

function loadAMap() {
  if (window.AMap) return Promise.resolve(window.AMap);
  if (amapLoader) return amapLoader;

  amapLoader = fetch("/api/amap/config", { cache: "no-store" })
    .then(async (response) => {
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message || "地图配置暂不可用");
      }
      return response.json() as Promise<{ key: string; serviceHost: string }>;
    })
    .then(
      ({ key, serviceHost }) =>
        new Promise<AMapNamespace>((resolve, reject) => {
          window._AMapSecurityConfig = { serviceHost };

          const existing = document.querySelector<HTMLScriptElement>("script[data-digitalx-amap]");
          if (existing) {
            existing.addEventListener("load", () => {
              if (window.AMap) resolve(window.AMap);
              else reject(new Error("高德地图脚本加载后未完成初始化"));
            });
            existing.addEventListener("error", () => reject(new Error("高德地图脚本加载失败")));
            return;
          }

          const script = document.createElement("script");
          script.dataset.digitalxAmap = "true";
          script.async = true;
          script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(key)}&plugin=AMap.MarkerCluster,AMap.Scale,AMap.ToolBar`;
          script.onload = () => {
            if (window.AMap) resolve(window.AMap);
            else reject(new Error("高德地图脚本加载后未完成初始化"));
          };
          script.onerror = () => reject(new Error("高德地图脚本加载失败，请检查 Key 的域名白名单"));
          document.head.appendChild(script);
        }),
    )
    .catch((error) => {
      amapLoader = null;
      throw error;
    });

  return amapLoader;
}

function cityLabel(city: string) {
  return city.endsWith("市") ? city.slice(0, -1) : city;
}

function createCityMarker(
  AMap: AMapNamespace,
  context: ClusterRenderContext,
  onSelectCity: (city: string) => void,
) {
  const point = context.data[0];
  const size = Math.max(46, Math.min(72, 40 + point.count * 10));
  const marker = document.createElement("button");
  marker.type = "button";
  marker.className = `amap-city-marker${point.active ? " is-active" : ""}`;
  marker.style.width = `${size}px`;
  marker.style.height = `${size}px`;
  marker.setAttribute("aria-label", `${point.city}，${point.count} 个案例`);
  marker.title = `${point.city} · ${point.count} 个案例`;
  marker.innerHTML = `<strong>${cityLabel(point.city)}</strong><span>${point.count} 个</span>`;
  marker.addEventListener("click", () => onSelectCity(point.active ? "全部" : point.city));

  context.marker.setContent(marker);
  context.marker.setOffset(new AMap.Pixel(-size / 2, -size / 2));
}

function createClusterMarker(AMap: AMapNamespace, context: ClusterRenderContext) {
  const size = Math.max(50, Math.min(78, 48 + Math.log2(context.count + 1) * 9));
  const marker = document.createElement("div");
  marker.className = "amap-cluster-marker";
  marker.style.width = `${size}px`;
  marker.style.height = `${size}px`;
  marker.innerHTML = `<strong>${context.count}</strong><span>城市</span>`;
  context.marker.setContent(marker);
  context.marker.setOffset(new AMap.Pixel(-size / 2, -size / 2));
}

export function AMapCaseMap({
  cities,
  activeCity,
  onSelectCity,
  onClearFilters,
}: {
  cities: AMapCityPoint[];
  activeCity: string;
  onSelectCity: (city: string) => void;
  onClearFilters: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLike | null>(null);
  const clusterRef = useRef<ClusterLike | null>(null);
  const amapRef = useRef<AMapNamespace | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;

    loadAMap()
      .then((AMap) => {
        if (cancelled || !containerRef.current) return;

        amapRef.current = AMap;
        const map = new AMap.Map(containerRef.current, {
          center: [104.1954, 35.8617],
          zoom: 4.6,
          zooms: [3, 18],
          mapStyle: "amap://styles/whitesmoke",
          viewMode: "2D",
          resizeEnable: true,
          showLabel: true,
        });
        map.addControl(new AMap.Scale());
        map.addControl(new AMap.ToolBar({ position: "RB" }));
        mapRef.current = map;
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setStatus("error");
        setErrorMessage(error instanceof Error ? error.message : "真实地图加载失败");
      });

    return () => {
      cancelled = true;
      clusterRef.current?.setMap(null);
      clusterRef.current = null;
      mapRef.current?.destroy();
      mapRef.current = null;
      amapRef.current = null;
    };
  }, [retry]);

  useEffect(() => {
    const map = mapRef.current;
    const AMap = amapRef.current;
    if (status !== "ready" || !map || !AMap) return;

    clusterRef.current?.setMap(null);
    clusterRef.current = null;

    if (cities.length === 0) return;

    const points: AMapPointData[] = cities.map((city) => ({
      ...city,
      lnglat: [city.lng, city.lat],
      active: city.city === activeCity,
    }));

    const cluster = new AMap.MarkerCluster(map, points, {
      gridSize: 68,
      maxZoom: 10,
      averageCenter: true,
      zoomOnClick: true,
      renderMarker: (context: ClusterRenderContext) => createCityMarker(AMap, context, onSelectCity),
      renderClusterMarker: (context: ClusterRenderContext) => createClusterMarker(AMap, context),
    });
    clusterRef.current = cluster;

    const selected = cities.find((city) => city.city === activeCity);
    if (selected) {
      map.setZoomAndCenter(8, [selected.lng, selected.lat], false, 350);
    } else if (cities.length === 1) {
      map.setZoomAndCenter(7, [cities[0].lng, cities[0].lat], false, 350);
    } else {
      window.setTimeout(() => map.setFitView(), 80);
    }

    return () => {
      cluster.setMap(null);
      if (clusterRef.current === cluster) clusterRef.current = null;
    };
  }, [activeCity, cities, onSelectCity, status]);

  function retryLoad() {
    document.querySelector("script[data-digitalx-amap]")?.remove();
    amapLoader = null;
    setStatus("loading");
    setErrorMessage("");
    setRetry((value) => value + 1);
  }

  return (
    <div className="relative h-[470px] overflow-hidden bg-[#edf3f3] sm:h-[540px]">
      <div ref={containerRef} className="h-full w-full" aria-label="全国城市数智案例高德地图" />

      {status === "loading" && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#edf3f3]">
          <div className="rounded-md border border-slate-200 bg-white px-5 py-4 text-center shadow-sm">
            <div className="mx-auto h-5 w-5 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
            <div className="mt-3 text-sm font-medium">正在加载高德地图</div>
          </div>
        </div>
      )}

      {status === "error" && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#edf3f3]">
          <div className="max-w-sm rounded-md border border-slate-200 bg-white px-5 py-4 text-center shadow-sm">
            <div className="font-medium">真实地图暂未加载成功</div>
            <p className="mt-1 text-xs leading-5 text-slate-500">{errorMessage}</p>
            <button onClick={retryLoad} className="mt-3 rounded-md bg-slate-950 px-3 py-2 text-sm text-white">
              重新加载
            </button>
          </div>
        </div>
      )}

      {status === "ready" && cities.length === 0 && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/60 backdrop-blur-[1px]">
          <div className="rounded-md border border-slate-200 bg-white px-5 py-4 text-center shadow-sm">
            <div className="font-medium">没有符合条件的地图点位</div>
            <button onClick={onClearFilters} className="mt-2 text-sm text-teal-700 hover:underline">
              清空筛选条件
            </button>
          </div>
        </div>
      )}

      {status === "ready" && (
        <div className="pointer-events-none absolute left-3 top-3 z-10 rounded bg-white/95 px-2.5 py-1.5 text-[11px] font-medium text-slate-600 shadow-sm">
          高德地图 JS API 2.0
        </div>
      )}
    </div>
  );
}
