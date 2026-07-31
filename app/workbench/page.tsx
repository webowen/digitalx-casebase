"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AMapCaseMap, type AMapCasePoint } from "@/components/amap-case-map";
import { CaseDocument } from "@/components/case-document";
import {
  categories,
  categoryColors,
  type CaseCategory,
  type EvidenceLevel,
  type SmartCityCase,
} from "@/lib/case-model";
import { cityStats } from "@/lib/case-analytics";
import { getMigrationSummary } from "@/lib/benchmark-cases";
import { getLocalCases } from "@/lib/local-cases";
import { getPublishedCases } from "@/lib/mock-cases";

type DirectoryMode = "category" | "region" | "topic";
type MapLevel = "national" | "province" | "city" | "project";
type FilterValue = "全部" | string;

type DirectorySubgroup = { label: string; cases: SmartCityCase[] };
type DirectoryGroup = { label: string; count: number; subgroups: DirectorySubgroup[] };

const staticPublishedCases = getPublishedCases();
const evidenceLevels: EvidenceLevel[] = ["强", "中", "弱"];
const mapLevelLabels: Record<MapLevel, string> = {
  national: "全国",
  province: "省域",
  city: "城市",
  project: "项目",
};

const topics = [
  {
    label: "城市治理与运行",
    match: (item: SmartCityCase) => ["城市运行", "应急治理", "政务服务"].includes(item.category),
  },
  {
    label: "工程建设数字化",
    match: (item: SmartCityCase) =>
      item.category === "CIM / 数字孪生" ||
      (item.aiTags ?? []).some((tag) => ["BIM", "GIS", "工程建设", "数字孪生"].includes(tag)),
  },
  {
    label: "新产业与新场景",
    match: (item: SmartCityCase) => ["低空经济", "产业园区"].includes(item.category),
  },
  {
    label: "交通与生态韧性",
    match: (item: SmartCityCase) => ["智慧交通", "生态环保"].includes(item.category),
  },
];

function matchesKeyword(item: SmartCityCase, keyword: string) {
  const search = keyword.trim().toLowerCase();
  if (!search) return true;
  return [
    item.title,
    item.province,
    item.city,
    item.district,
    item.category,
    item.summary,
    item.owner,
    ...(item.aiTags ?? []),
    ...(item.solution ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(search);
}

function groupBy<T>(items: T[], label: (item: T) => string) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = label(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return groups;
}

function buildDirectory(cases: SmartCityCase[], mode: DirectoryMode): DirectoryGroup[] {
  if (mode === "category") {
    return categories
      .map((category) => {
        const categoryCases = cases.filter((item) => item.category === category);
        return {
          label: category,
          count: categoryCases.length,
          subgroups: Array.from(groupBy(categoryCases, (item) => item.province))
            .map(([label, groupedCases]) => ({ label, cases: groupedCases }))
            .sort((a, b) => b.cases.length - a.cases.length),
        };
      })
      .filter((group) => group.count > 0);
  }
  if (mode === "region") {
    return Array.from(groupBy(cases, (item) => item.province))
      .map(([province, provinceCases]) => ({
        label: province,
        count: provinceCases.length,
        subgroups: Array.from(groupBy(provinceCases, (item) => item.city))
          .map(([label, groupedCases]) => ({ label, cases: groupedCases }))
          .sort((a, b) => b.cases.length - a.cases.length),
      }))
      .sort((a, b) => b.count - a.count);
  }
  return topics
    .map((topic) => {
      const topicCases = cases.filter(topic.match);
      return {
        label: topic.label,
        count: topicCases.length,
        subgroups: Array.from(groupBy(topicCases, (item) => item.category))
          .map(([label, groupedCases]) => ({ label, cases: groupedCases }))
          .sort((a, b) => b.cases.length - a.cases.length),
      };
    })
    .filter((group) => group.count > 0);
}

function DirectoryBranch({
  group,
  selectedCaseId,
  initiallyOpen,
  onSelectCase,
}: {
  group: DirectoryGroup;
  selectedCaseId?: string;
  initiallyOpen: boolean;
  onSelectCase: (item: SmartCityCase) => void;
}) {
  const groupRef = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(initiallyOpen);
  const containsSelection = group.subgroups.some((subgroup) =>
    subgroup.cases.some((item) => item.id === selectedCaseId),
  );

  useEffect(() => {
    if (containsSelection) {
      const frame = window.requestAnimationFrame(() => setOpen(true));
      return () => window.cancelAnimationFrame(frame);
    }
  }, [containsSelection]);

  return (
    <details
      ref={groupRef}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className="group/tree"
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-2 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100">
        <span className="text-[10px] text-slate-400 transition group-open/tree:rotate-90">▶</span>
        <span className="min-w-0 flex-1 truncate">{group.label}</span>
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
          {group.count}
        </span>
      </summary>
      <div className="ml-3 border-l border-slate-200 pl-2">
        {group.subgroups.map((subgroup) => (
          <DirectorySubBranch
            key={`${group.label}-${subgroup.label}`}
            subgroup={subgroup}
            selectedCaseId={selectedCaseId}
            onSelectCase={onSelectCase}
          />
        ))}
      </div>
    </details>
  );
}

function DirectorySubBranch({
  subgroup,
  selectedCaseId,
  onSelectCase,
}: {
  subgroup: DirectorySubgroup;
  selectedCaseId?: string;
  onSelectCase: (item: SmartCityCase) => void;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const containsSelection = subgroup.cases.some((item) => item.id === selectedCaseId);

  useEffect(() => {
    if (!containsSelection) return;
    const frame = window.requestAnimationFrame(() => {
      setOpen(true);
      activeRef.current?.scrollIntoView({ block: "nearest" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [containsSelection, selectedCaseId]);

  return (
    <details
      ref={detailsRef}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
        <span className="text-[9px] text-slate-400">◆</span>
        <span className="min-w-0 flex-1 truncate">{subgroup.label}</span>
        <span className="tabular-nums text-slate-400">{subgroup.cases.length}</span>
      </summary>
      <div className="ml-3 border-l border-slate-100 py-1 pl-2">
        {subgroup.cases.map((item) => {
          const active = selectedCaseId === item.id;
          return (
            <button
              ref={active ? activeRef : undefined}
              key={item.id}
              type="button"
              onClick={() => onSelectCase(item)}
              className={`mb-0.5 flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-xs leading-5 transition ${
                active
                  ? "brand-tree-active font-semibold ring-1 ring-inset"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
              }`}
            >
              <span
                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: categoryColors[item.category] }}
              />
              <span>{item.title}</span>
            </button>
          );
        })}
      </div>
    </details>
  );
}

function DirectoryTree({
  groups,
  selectedCaseId,
  onSelectCase,
}: {
  groups: DirectoryGroup[];
  selectedCaseId?: string;
  onSelectCase: (item: SmartCityCase) => void;
}) {
  return (
    <div className="space-y-1 px-2 pb-5">
      {groups.map((group, index) => (
        <DirectoryBranch
          key={group.label}
          group={group}
          selectedCaseId={selectedCaseId}
          initiallyOpen={index < 2}
          onSelectCase={onSelectCase}
        />
      ))}
      {groups.length === 0 && (
        <div className="px-4 py-12 text-center text-sm text-slate-500">当前条件下暂无案例</div>
      )}
    </div>
  );
}

export default function MapWorkbench() {
  const [localCases, setLocalCases] = useState<SmartCityCase[]>([]);
  const [directoryMode, setDirectoryMode] = useState<DirectoryMode>("category");
  const [mapLevel, setMapLevel] = useState<MapLevel>("national");
  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState<CaseCategory | "全部">("全部");
  const [year, setYear] = useState<FilterValue>("全部");
  const [evidenceLevel, setEvidenceLevel] = useState<FilterValue>("全部");
  const [activeProvince, setActiveProvince] = useState<FilterValue>("全部");
  const [activeCity, setActiveCity] = useState<FilterValue>("全部");
  const [selectedCaseSlug, setSelectedCaseSlug] = useState("");
  const [documentOpen, setDocumentOpen] = useState(false);
  const [urlReady, setUrlReady] = useState(false);
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);

  const restoreUrl = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    const level = params.get("level");
    const directory = params.get("directory");
    setKeyword(params.get("q") ?? "");
    setCategory((params.get("category") as CaseCategory) || "全部");
    setYear(params.get("year") ?? "全部");
    setEvidenceLevel(params.get("evidence") ?? "全部");
    setActiveProvince(params.get("province") ?? "全部");
    setActiveCity(params.get("city") ?? "全部");
    const caseSlug = params.get("case") ?? "";
    setSelectedCaseSlug(caseSlug);
    setDocumentOpen(Boolean(caseSlug) && params.get("view") === "document");
    if (["national", "province", "city", "project"].includes(level ?? "")) {
      setMapLevel(level as MapLevel);
    }
    if (["category", "region", "topic"].includes(directory ?? "")) {
      setDirectoryMode(directory as DirectoryMode);
    }
    setUrlReady(true);
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(restoreUrl);
    window.addEventListener("popstate", restoreUrl);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("popstate", restoreUrl);
    };
  }, [restoreUrl]);

  useEffect(() => {
    const syncLocalCases = () => setLocalCases(getLocalCases());
    syncLocalCases();
    window.addEventListener("digitalx-cases-updated", syncLocalCases);
    window.addEventListener("storage", syncLocalCases);
    return () => {
      window.removeEventListener("digitalx-cases-updated", syncLocalCases);
      window.removeEventListener("storage", syncLocalCases);
    };
  }, []);

  useEffect(() => {
    if (!urlReady) return;
    const params = new URLSearchParams();
    if (keyword.trim()) params.set("q", keyword.trim());
    if (category !== "全部") params.set("category", category);
    if (year !== "全部") params.set("year", year);
    if (evidenceLevel !== "全部") params.set("evidence", evidenceLevel);
    if (activeProvince !== "全部") params.set("province", activeProvince);
    if (activeCity !== "全部") params.set("city", activeCity);
    if (selectedCaseSlug) params.set("case", selectedCaseSlug);
    if (selectedCaseSlug && documentOpen) params.set("view", "document");
    if (mapLevel !== "national") params.set("level", mapLevel);
    if (directoryMode !== "category") params.set("directory", directoryMode);
    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }, [
    activeCity,
    activeProvince,
    category,
    directoryMode,
    documentOpen,
    evidenceLevel,
    keyword,
    mapLevel,
    selectedCaseSlug,
    urlReady,
    year,
  ]);

  const publishedCases = useMemo(
    () => {
      const localPublished = localCases.filter((item) => item.status === "已发布");
      const localIds = new Set(localPublished.map((item) => item.id));
      return [
        ...localPublished,
        ...staticPublishedCases.filter((item) => !localIds.has(item.id)),
      ];
    },
    [localCases],
  );
  const migrationSummary = useMemo(
    () => getMigrationSummary(publishedCases),
    [publishedCases],
  );
  const allYears = useMemo(
    () => Array.from(new Set(publishedCases.map((item) => item.year))).sort((a, b) => b - a),
    [publishedCases],
  );
  const provinces = useMemo(
    () => Array.from(new Set(publishedCases.map((item) => item.province))).sort(),
    [publishedCases],
  );
  const filteredByControls = useMemo(
    () =>
      publishedCases.filter(
        (item) =>
          matchesKeyword(item, keyword) &&
          (category === "全部" || item.category === category) &&
          (year === "全部" || item.year === Number(year)) &&
          (evidenceLevel === "全部" || item.evidenceLevel === evidenceLevel) &&
          (activeProvince === "全部" || item.province === activeProvince),
      ),
    [activeProvince, category, evidenceLevel, keyword, publishedCases, year],
  );
  const visibleCases = useMemo(
    () =>
      activeCity === "全部"
        ? filteredByControls
        : filteredByControls.filter((item) => item.city === activeCity),
    [activeCity, filteredByControls],
  );
  const mappableFilteredCases = useMemo(
    () =>
      filteredByControls.flatMap((item) => {
        const lng = Number(item.lng);
        const lat = Number(item.lat);
        return Number.isFinite(lng) && Number.isFinite(lat) && Math.abs(lng) <= 180 && Math.abs(lat) <= 90
          ? [{ ...item, lng, lat }]
          : [];
      }),
    [filteredByControls],
  );
  const mappableVisibleCases = useMemo(
    () =>
      visibleCases.flatMap((item) => {
        const lng = Number(item.lng);
        const lat = Number(item.lat);
        return Number.isFinite(lng) && Number.isFinite(lat) && Math.abs(lng) <= 180 && Math.abs(lat) <= 90
          ? [{ ...item, lng, lat }]
          : [];
      }),
    [visibleCases],
  );
  const cities = useMemo(() => cityStats(mappableFilteredCases), [mappableFilteredCases]);
  const directory = useMemo(
    () => buildDirectory(visibleCases, directoryMode),
    [directoryMode, visibleCases],
  );
  const selectedCase = useMemo(
    () => publishedCases.find((item) => item.slug === selectedCaseSlug) ?? null,
    [publishedCases, selectedCaseSlug],
  );
  const activeSelectedCase = useMemo(
    () =>
      selectedCase && visibleCases.some((item) => item.id === selectedCase.id)
        ? selectedCase
        : null,
    [selectedCase, visibleCases],
  );
  const effectiveSelectedCase = useMemo(
    () => activeSelectedCase ?? visibleCases[0] ?? null,
    [activeSelectedCase, visibleCases],
  );
  const casePoints = useMemo<AMapCasePoint[]>(
    () =>
      mappableVisibleCases.map((item) => ({
        id: item.id,
        title: item.title,
        city: item.city,
        province: item.province,
        category: item.category,
        lng: item.lng,
        lat: item.lat,
        locationLevel: ["省级", "市级", "区县级", "园区/项目点"].includes(item.locationLevel)
          ? item.locationLevel
          : "市级",
        locationConfidence: Number.isFinite(Number(item.locationConfidence))
          ? Number(item.locationConfidence)
          : 0,
        benchmark: item.contentMigration?.benchmark,
      })),
    [mappableVisibleCases],
  );
  const focusCaseOnMap = useCallback((item: SmartCityCase) => {
    setSelectedCaseSlug(item.slug);
    setDocumentOpen(false);
    setMapLevel("project");
    setLeftOpen(false);
  }, []);

  const selectCasePoint = useCallback((id: string) => {
    const item = publishedCases.find((entry) => entry.id === id);
    if (!item) return;
    setSelectedCaseSlug(item.slug);
    setDocumentOpen(true);
    setMapLevel("project");
  }, [publishedCases]);

  const selectCity = useCallback((city: string) => {
    if (city === "全部") {
      setActiveCity("全部");
      setActiveProvince("全部");
      setSelectedCaseSlug("");
      setDocumentOpen(false);
      setMapLevel("national");
      return;
    }
    const firstCase = filteredByControls.find((item) => item.city === city);
    setActiveCity(city);
    setActiveProvince(firstCase?.province ?? "全部");
    setSelectedCaseSlug(firstCase?.slug ?? "");
    setDocumentOpen(false);
    setMapLevel("city");
  }, [filteredByControls]);

  function setLevel(level: MapLevel) {
    setMapLevel(level);
    if (level === "national") {
      setActiveProvince("全部");
      setActiveCity("全部");
      setSelectedCaseSlug("");
      setDocumentOpen(false);
    } else if (level === "province") {
      setActiveCity("全部");
      setSelectedCaseSlug("");
      setDocumentOpen(false);
      if (activeProvince === "全部" && effectiveSelectedCase) {
        setActiveProvince(effectiveSelectedCase.province);
      }
    } else if (level === "city" && effectiveSelectedCase) {
      setActiveProvince(effectiveSelectedCase.province);
      setActiveCity(effectiveSelectedCase.city);
      setSelectedCaseSlug("");
      setDocumentOpen(false);
    } else if (level === "project" && effectiveSelectedCase) {
      focusCaseOnMap(effectiveSelectedCase);
    }
  }

  const clearFilters = useCallback(() => {
    setKeyword("");
    setCategory("全部");
    setYear("全部");
    setEvidenceLevel("全部");
    setActiveProvince("全部");
    setActiveCity("全部");
    setSelectedCaseSlug("");
    setDocumentOpen(false);
    setMapLevel("national");
  }, []);

  const closeDocument = useCallback(() => {
    setDocumentOpen(false);
  }, []);

  useEffect(() => {
    if (!documentOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDocument();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeDocument, documentOpen]);

  const activeFilterCount =
    [category, year, evidenceLevel, activeProvince, activeCity].filter((item) => item !== "全部").length +
    (keyword.trim() ? 1 : 0);

  return (
    <main className="digitalx-brand-theme h-dvh overflow-hidden text-slate-950">
      <header className="workbench-topbar relative z-50 flex h-[68px] items-center gap-3 px-3 sm:px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <span className="brand-logo-shell relative h-11 w-11 shrink-0 overflow-hidden rounded-full">
            <Image
              src="/digital-plus-innovate-logo.jpg"
              alt="Digital + Innovate"
              fill
              sizes="44px"
              priority
              unoptimized
              className="brand-logo-image"
            />
          </span>
          <span className="hidden md:block">
            <strong className="brand-title block whitespace-nowrap text-sm">Digital X 城市数智应用案例库</strong>
            <span className="brand-subtitle block whitespace-nowrap text-[9px]">
              Digital X Urban Digital Intelligence Application Case Library
            </span>
          </span>
        </Link>
        <button type="button" onClick={() => setLeftOpen(true)} className="flex h-10 items-center rounded-md border border-slate-200 px-3 text-sm lg:hidden">
          目录
        </button>
        <label className="relative mx-auto w-full max-w-2xl">
          <span className="sr-only">全局搜索案例</span>
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索项目、城市、场景或建设内容"
            className="brand-search h-10 w-full rounded-xl px-4 pr-10 text-sm outline-none transition"
          />
          <span className="pointer-events-none absolute right-3 top-2.5 text-slate-400">⌕</span>
        </label>
        <button type="button" onClick={() => setRightOpen(true)} className="flex h-10 items-center rounded-md border border-slate-200 px-3 text-sm lg:hidden">
          筛选{activeFilterCount > 0 ? ` ${activeFilterCount}` : ""}
        </button>
        <Link href="/admin" className="hidden shrink-0 rounded-md border border-slate-200 px-3 py-2 text-xs font-medium hover:bg-slate-50 sm:block">
          管理端
        </Link>
      </header>

      <section className="relative grid h-[calc(100dvh-68px)] lg:grid-cols-[320px_minmax(0,1fr)_296px]">
        {(leftOpen || rightOpen) && (
          <button
            type="button"
            aria-label="关闭面板"
            onClick={() => {
              setLeftOpen(false);
              setRightOpen(false);
            }}
            className="absolute inset-0 z-30 bg-slate-950/30 lg:hidden"
          />
        )}

        <aside className={`workbench-panel absolute inset-y-0 left-0 z-40 flex w-[min(340px,88vw)] flex-col transition-transform lg:static lg:w-auto lg:translate-x-0 ${leftOpen ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <p className="brand-eyebrow text-[10px] font-bold tracking-[0.14em]">CASE DIRECTORY</p>
              <h1 className="mt-0.5 text-base font-semibold">案例目录</h1>
            </div>
            <button type="button" onClick={() => setLeftOpen(false)} className="rounded-md p-2 text-slate-500 lg:hidden">×</button>
          </div>
          <div className="grid grid-cols-3 gap-1 border-b border-slate-200 p-2">
            {([
              ["category", "按分类"],
              ["region", "按地区"],
              ["topic", "按专题"],
            ] as const).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setDirectoryMode(mode)}
                className={`rounded-md px-2 py-2 text-xs font-medium ${directoryMode === mode ? "brand-gradient-button text-white" : "text-slate-500 hover:bg-sky-50"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between px-4 py-2 text-[11px] text-slate-500">
            <span>{visibleCases.length} 个公开案例</span>
            {activeCity !== "全部" && (
              <button type="button" onClick={() => selectCity("全部")} className="brand-link hover:underline">返回全国</button>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <DirectoryTree
              groups={directory}
              selectedCaseId={activeSelectedCase?.id}
              onSelectCase={focusCaseOnMap}
            />
          </div>
        </aside>

        <section className="workbench-map relative min-w-0 overflow-hidden">
          <AMapCaseMap
            cities={cities}
            casePoints={casePoints}
            displayMode={mapLevel === "national" ? "city" : "case"}
            activeCity={activeCity}
            activeCaseId={activeSelectedCase?.id}
            onSelectCity={selectCity}
            onSelectCase={selectCasePoint}
            onClearFilters={clearFilters}
            className="h-full min-h-[420px]"
          />

          <div className="absolute left-3 top-12 z-10 flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-white/95 p-1 shadow-sm lg:left-4">
            {(Object.keys(mapLevelLabels) as MapLevel[]).map((level, index) => {
              const disabled =
                (level === "province" && activeProvince === "全部" && !effectiveSelectedCase) ||
                ((level === "city" || level === "project") && !effectiveSelectedCase);
              return (
                <div key={level} className="flex items-center">
                  {index > 0 && <span className="px-0.5 text-[10px] text-slate-300">/</span>}
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setLevel(level)}
                    className={`rounded px-2 py-1 text-[11px] font-medium ${
                      mapLevel === level ? "brand-gradient-button text-white" : "text-slate-600 hover:bg-sky-50 disabled:text-slate-300"
                    }`}
                  >
                    {mapLevelLabels[level]}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="pointer-events-none absolute right-3 top-3 z-10 rounded-md border border-slate-200 bg-white/95 px-2.5 py-1.5 text-[11px] text-slate-600 shadow-sm">
            {activeProvince === "全部" ? "全国" : activeProvince}
            {activeCity !== "全部" ? ` / ${activeCity}` : ""} · {visibleCases.length} 案例
          </div>

          {activeSelectedCase && documentOpen && (
            <div className="case-document-layer">
              <button
                type="button"
                aria-label="关闭案例文档遮罩"
                className="case-document-backdrop"
                onClick={closeDocument}
              />
              <div className="case-document-shell">
                <CaseDocument item={activeSelectedCase} onClose={closeDocument} />
              </div>
            </div>
          )}
        </section>

        <aside className={`workbench-panel workbench-panel-right absolute inset-y-0 right-0 z-40 flex w-[min(320px,88vw)] flex-col transition-transform lg:static lg:w-auto lg:translate-x-0 ${rightOpen ? "translate-x-0" : "translate-x-full"}`}>
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <p className="brand-eyebrow text-[10px] font-bold tracking-[0.14em]">TOOLS</p>
              <h2 className="mt-0.5 text-base font-semibold">筛选与分析</h2>
            </div>
            <button type="button" onClick={() => setRightOpen(false)} className="rounded-md p-2 text-slate-500 lg:hidden">×</button>
          </div>
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-semibold text-slate-800">筛选条件</h3>
                <button type="button" onClick={clearFilters} className="brand-link text-[11px] hover:underline">清空{activeFilterCount > 0 ? ` ${activeFilterCount}` : ""}</button>
              </div>
              <div className="space-y-2">
                <label className="block">
                  <span className="mb-1 block text-[11px] text-slate-500">应用分类</span>
                  <select value={category} onChange={(event) => setCategory(event.target.value as CaseCategory | "全部")} className="h-10 w-full rounded-md border border-slate-200 bg-white px-2.5 text-xs outline-none focus:border-teal-500">
                    <option value="全部">全部分类</option>
                    {categories.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] text-slate-500">省级范围</span>
                  <select
                    value={activeProvince}
                    onChange={(event) => {
                      const value = event.target.value;
                      setActiveProvince(value);
                      setActiveCity("全部");
                      setSelectedCaseSlug("");
                      setMapLevel(value === "全部" ? "national" : "province");
                    }}
                    className="h-10 w-full rounded-md border border-slate-200 bg-white px-2.5 text-xs outline-none focus:border-teal-500"
                  >
                    <option value="全部">全国</option>
                    {provinces.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label>
                    <span className="mb-1 block text-[11px] text-slate-500">案例年份</span>
                    <select value={year} onChange={(event) => setYear(event.target.value)} className="h-10 w-full rounded-md border border-slate-200 bg-white px-2 text-xs outline-none focus:border-teal-500">
                      <option value="全部">全部年份</option>
                      {allYears.map((item) => <option key={item} value={String(item)}>{item}</option>)}
                    </select>
                  </label>
                  <label>
                    <span className="mb-1 block text-[11px] text-slate-500">证据等级</span>
                    <select value={evidenceLevel} onChange={(event) => setEvidenceLevel(event.target.value)} className="h-10 w-full rounded-md border border-slate-200 bg-white px-2 text-xs outline-none focus:border-teal-500">
                      <option value="全部">全部证据</option>
                      {evidenceLevels.map((item) => <option key={item}>{item}</option>)}
                    </select>
                  </label>
                </div>
              </div>
            </section>
            <section className="border-t border-slate-200 pt-4">
              <h3 className="text-xs font-semibold text-slate-800">当前结果</h3>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {[
                  ["案例", visibleCases.length],
                  ["城市", cityStats(mappableVisibleCases).length],
                  ["强证据", visibleCases.filter((item) => item.evidenceLevel === "强").length],
                  ["地图层级", mapLevelLabels[mapLevel]],
                ].map(([label, value]) => (
                  <div key={label} className="brand-stat-card rounded-xl p-3">
                    <strong className="block text-lg">{value}</strong>
                    <span className="mt-0.5 block text-[10px] text-slate-500">{label}</span>
                  </div>
                ))}
              </div>
            </section>
            <section className="border-t border-slate-200 pt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-slate-800">内容迁移</h3>
                <span className="brand-eyebrow text-[10px] font-bold">
                  V1.5 PROTOCOL
                </span>
              </div>
              <div className="brand-soft-card mt-2 rounded-xl p-3">
                <div className="flex items-end justify-between">
                  <strong className="text-xl text-slate-900">
                    {migrationSummary.migrated}/{migrationSummary.total}
                  </strong>
                  <span className="text-[10px] text-slate-500">协议迁移</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                  <span
                    className="brand-gradient-button block h-full rounded-full"
                    style={{
                      width: `${Math.round(
                        (migrationSummary.migrated /
                          Math.max(1, migrationSummary.total)) *
                          100,
                      )}%`,
                    }}
                  />
                </div>
                <p className="mt-2 text-[10px] leading-4 text-slate-600">
                  全部案例已进入原生七章协议；其中 {migrationSummary.benchmarkDrafts} 个标杆样稿进入终审，
                  {migrationSummary.batchMigrated} 个存量案例仍待扩写、补证据和人工批准。
                </p>
              </div>
            </section>
            <section className="border-t border-slate-200 pt-4">
              <h3 className="text-xs font-semibold text-slate-800">地图图层</h3>
              <div className="mt-2 space-y-2 text-xs text-slate-600">
                <div className="rounded-md border border-slate-200 px-3 py-2.5">
                  <strong className="block text-slate-800">{mapLevel === "national" ? "城市聚合图层" : "精确案例点位"}</strong>
                  <span className="mt-1 block text-[10px] leading-4 text-slate-500">
                    省级案例使用省会锚点，市级和项目级案例使用已核验坐标；低置信度点位仍需人工复核。
                  </span>
                </div>
              </div>
            </section>
            <section className="brand-soft-card rounded-xl p-3">
              <p className="brand-eyebrow text-[10px] font-bold tracking-wide">SHAREABLE VIEW</p>
              <h3 className="mt-1 text-sm font-semibold">当前工作台状态可分享</h3>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                搜索、筛选、目录方式、地图层级与所选案例均写入 URL；刷新、前进后退或复制网址后可以恢复。
              </p>
            </section>
          </div>
        </aside>
      </section>
    </main>
  );
}
