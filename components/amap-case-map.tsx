"use client";

import { useEffect, useRef, useState } from "react";
import type { LocationLevel } from "@/lib/case-model";

export type AMapCityPoint = {
  city: string;
  province: string;
  count: number;
  lng: number;
  lat: number;
};

export type AMapCasePoint = {
  id: string;
  title: string;
  city: string;
  province: string;
  category: string;
  lng: number;
  lat: number;
  locationLevel: LocationLevel;
  locationConfidence: number;
};

type CityPointData = AMapCityPoint & {
  kind: "city";
  lnglat: [number, number];
  active: boolean;
};

type CasePointData = AMapCasePoint & {
  kind: "case";
  lnglat: [number, number];
  active: boolean;
};

type AMapPointData = CityPointData | CasePointData;

type LngLatLike = {
  getLng?(): number;
  getLat?(): number;
  toArray?(): [number, number];
};

type MarkerLike = {
  getPosition?(): LngLatLike | undefined;
  setContent(content: HTMLElement | string): void;
  setOffset(offset: unknown): void;
};

type PointRenderContext = {
  marker: MarkerLike;
};

type ClusterRenderContext = {
  marker: MarkerLike;
  count: number;
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

function findMarkerPoint(marker: MarkerLike, points: AMapPointData[]) {
  const position = marker.getPosition?.();
  const coordinates = position?.toArray?.();
  const lng = coordinates?.[0] ?? position?.getLng?.();
  const lat = coordinates?.[1] ?? position?.getLat?.();
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return undefined;

  return points.find(
    (point) =>
      Math.abs(point.lnglat[0] - Number(lng)) < 0.000001 &&
      Math.abs(point.lnglat[1] - Number(lat)) < 0.000001,
  );
}

function createPointMarker(
  AMap: AMapNamespace,
  context: PointRenderContext,
  points: AMapPointData[],
  onSelectCity: (city: string) => void,
  onSelectCase: (id: string) => void,
) {
  const point = findMarkerPoint(context.marker, points);
  if (!point) {
    const marker = document.createElement("div");
    marker.className = "amap-case-marker";
    marker.innerHTML = "<span></span>";
    marker.setAttribute("aria-label", "地图案例点位");
    context.marker.setContent(marker);
    context.marker.setOffset(new AMap.Pixel(-14, -34));
    return;
  }

  if (point.kind === "city") {
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
    return;
  }

  const marker = document.createElement("button");
  marker.type = "button";
  marker.className = `amap-case-marker${point.active ? " is-active" : ""}`;
  marker.setAttribute("aria-label", `查看案例：${point.title}`);
  marker.title = `${point.title} · 位置置信度 ${Math.round(point.locationConfidence * 100)}%`;
  marker.innerHTML = `<span></span><strong>${point.title}</strong>`;
  marker.addEventListener("click", () => onSelectCase(point.id));
  context.marker.setContent(marker);
  context.marker.setOffset(new AMap.Pixel(-14, -34));
}

function createClusterMarker(
  AMap: AMapNamespace,
  context: ClusterRenderContext,
  kind: "city" | "case",
) {
  const size = Math.max(50, Math.min(78, 48 + Math.log2(context.count + 1) * 9));
  const marker = document.createElement("div");
  marker.className = "amap-cluster-marker";
  marker.style.width = `${size}px`;
  marker.style.height = `${size}px`;
  marker.innerHTML = `<strong>${context.count}</strong><span>${kind === "case" ? "案例" : "城市"}</span>`;
  context.marker.setContent(marker);
  context.marker.setOffset(new AMap.Pixel(-size / 2, -size / 2));
}

const locationZoom: Record<LocationLevel, number> = {
  省级: 7,
  市级: 10,
  区县级: 12,
  "园区/项目点": 14,
};

export function AMapCaseMap({
  cities,
  casePoints = [],
  displayMode = "city",
  activeCity,
  activeCaseId,
  onSelectCity,
  onSelectCase = () => undefined,
  onClearFilters,
  className = "h-[470px] sm:h-[540px]",
}: {
  cities: AMapCityPoint[];
  casePoints?: AMapCasePoint[];
  displayMode?: "city" | "case";
  activeCity: string;
  activeCaseId?: string;
  onSelectCity: (city: string) => void;
  onSelectCase?: (id: string) => void;
  onClearFilters: () => void;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLike | null>(null);
  const clusterRef = useRef<ClusterLike | null>(null);
  const amapRef = useRef<AMapNamespace | null>(null);
  const onSelectCityRef = useRef(onSelectCity);
  const onSelectCaseRef = useRef(onSelectCase);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    onSelectCityRef.current = onSelectCity;
    onSelectCaseRef.current = onSelectCase;
  }, [onSelectCase, onSelectCity]);

  useEffect(() => {
    let cancelled = false;

    loadAMap()
      .then((AMap) => {
        if (cancelled || !containerRef.current) return;
        try {
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
        } catch (error) {
          amapRef.current = null;
          setStatus("error");
          setErrorMessage(error instanceof Error ? error.message : "地图初始化失败");
        }
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
    let fitViewTimer: number | undefined;

    clusterRef.current?.setMap(null);
    clusterRef.current = null;
    const sourcePoints = displayMode === "case" ? casePoints : cities;
    if (sourcePoints.length === 0) return;

    const points: AMapPointData[] =
      displayMode === "case"
        ? casePoints.map((point) => ({
            ...point,
            kind: "case",
            lnglat: [point.lng, point.lat],
            active: point.id === activeCaseId,
          }))
        : cities.map((city) => ({
            ...city,
            kind: "city",
            lnglat: [city.lng, city.lat],
            active: city.city === activeCity,
          }));

    try {
      const cluster = new AMap.MarkerCluster(map, points, {
        gridSize: displayMode === "case" ? 52 : 68,
        maxZoom: displayMode === "case" ? 15 : 10,
        averageCenter: true,
        zoomOnClick: true,
        renderMarker: (context: PointRenderContext) =>
          createPointMarker(
            AMap,
            context,
            points,
            (city) => onSelectCityRef.current(city),
            (id) => onSelectCaseRef.current(id),
          ),
        renderClusterMarker: (context: ClusterRenderContext) =>
          createClusterMarker(AMap, context, displayMode === "case" ? "case" : "city"),
      });
      clusterRef.current = cluster;

      if (displayMode === "case") {
        const selected = casePoints.find((point) => point.id === activeCaseId);
        if (selected) {
          map.setZoomAndCenter(locationZoom[selected.locationLevel], [selected.lng, selected.lat], false, 350);
        } else if (casePoints.length === 1) {
          map.setZoomAndCenter(locationZoom[casePoints[0].locationLevel], [casePoints[0].lng, casePoints[0].lat], false, 350);
        } else {
          fitViewTimer = window.setTimeout(() => map.setFitView(), 80);
        }
      } else {
        const selected = cities.find((city) => city.city === activeCity);
        if (selected) map.setZoomAndCenter(8, [selected.lng, selected.lat], false, 350);
        else if (cities.length === 1) map.setZoomAndCenter(7, [cities[0].lng, cities[0].lat], false, 350);
        else fitViewTimer = window.setTimeout(() => map.setFitView(), 80);
      }

      return () => {
        if (fitViewTimer !== undefined) window.clearTimeout(fitViewTimer);
        cluster.setMap(null);
        if (clusterRef.current === cluster) clusterRef.current = null;
      };
    } catch (error) {
      window.setTimeout(() => {
        setStatus("error");
        setErrorMessage(error instanceof Error ? error.message : "地图点位加载失败");
      }, 0);
    }
  }, [activeCaseId, activeCity, casePoints, cities, displayMode, status]);

  function retryLoad() {
    document.querySelector("script[data-digitalx-amap]")?.remove();
    amapLoader = null;
    setStatus("loading");
    setErrorMessage("");
    setRetry((value) => value + 1);
  }

  const pointCount = displayMode === "case" ? casePoints.length : cities.length;

  return (
    <div className={`relative overflow-hidden bg-[#edf3f3] ${className}`}>
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

      {status === "ready" && pointCount === 0 && (
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
          高德地图 · {displayMode === "case" ? "精确案例点位" : "城市聚合"}
        </div>
      )}
    </div>
  );
}
