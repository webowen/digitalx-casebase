"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { AMapCaseMap, type AMapCasePoint, type MapAdministrativeFocus } from "@/components/amap-case-map";
import { CaseDocument } from "@/components/case-document";
import {
  categories,
  categoryColors,
  type CaseCategory,
  type EvidenceLevel,
  type SmartCityCase,
} from "@/lib/case-model";
import type { CaseParserResponse } from "@/lib/ai-case-parser";
import { MAX_CASE_SOURCE_CHARACTERS } from "@/lib/ai-case-parser";
import { cityStats } from "@/lib/case-analytics";
import { publishedCaseAssets } from "@/lib/case-assets";
import { indexedCases, indexedCaseStats } from "@/lib/case-index";
import { getLocalCases, removeLocalCase, saveLocalCase } from "@/lib/local-cases";
import { getPublishedCases } from "@/lib/mock-cases";
import { parseReportFile } from "@/lib/report-file-import";
import { createCaseFromImportedReport, createCaseFromReport } from "@/lib/report-import";
import { normalizeProjectTitle } from "@/lib/ai-case-native-protocol";
import {
  getAdministrativeFocusPlace,
  getCityOptions,
  provinceOptions,
} from "@/lib/china-administrative-options";

type DirectoryMode = "category" | "region" | "topic";
type MapLevel = "national" | "province" | "city";
type FilterValue = "全部" | string;

type DirectorySubgroup = { label: string; cases: SmartCityCase[] };
type DirectoryGroup = { label: string; count: number; subgroups: DirectorySubgroup[] };

const staticPublishedCases = [
  ...publishedCaseAssets,
  ...indexedCases.filter((item) => !publishedCaseAssets.some((asset) => asset.id === item.id || asset.asset?.caseId === item.id)),
  ...getPublishedCases().filter((item) => !publishedCaseAssets.some((asset) => asset.id === item.id)),
];
const evidenceLevels: EvidenceLevel[] = ["强", "中", "弱"];
function cleanCaseTitleCandidate(value?: string) {
  const title = normalizeProjectTitle(value).replace(/\s+/g, "").trim();
  if (!title) return "";
  if (/^(DIGITALX|CASEREPORT|EXECUTIVESUMMARY|案例摘要|案例研究版|编制日期)/i.test(title)) return "";
  if (/^[一二三四五六七八九十]+[、.．]/.test(title)) return "";
  if (/^(建设背景|项目概况|应用成效|建设思路|解决方案)/.test(title)) return "";
  return title;
}

function recoverCaseTitleFromReport(value?: string) {
  const lines = (value || "")
    .split("\n")
    .map((line) => line.replace(/^#{1,6}\s*/, "").replace(/\*\*/g, "").trim())
    .filter(Boolean)
    .filter((line) => !/^(DIGITAL X|CASE REPORT|EXECUTIVE SUMMARY|案例摘要|案例研究版|编制日期)/i.test(line));
  const topLines = lines.slice(0, 12);
  for (let index = 0; index < topLines.length; index += 1) {
    const joined = `${topLines[index]}${topLines[index + 1] || ""}`.replace(/\s+/g, "");
    const candidate = cleanCaseTitleCandidate(joined);
    if (candidate && /平台|系统|项目|工程|中心|应用/.test(candidate)) return candidate;
  }
  return "";
}

function displayCaseTitle(item: SmartCityCase) {
  return (
    cleanCaseTitleCandidate(item.title) ||
    cleanCaseTitleCandidate(item.identity?.canonicalTitle) ||
    cleanCaseTitleCandidate(item.sourceTitle) ||
    recoverCaseTitleFromReport(item.researchReport) ||
    item.title
  );
}

const topics = [
  {
    label: "政府治理",
    match: (item: SmartCityCase) => ["数字政府", "城市治理"].includes(item.category),
  },
  {
    label: "规划韧性",
    match: (item: SmartCityCase) => ["规划建设", "市政韧性"].includes(item.category),
  },
  {
    label: "产业发展",
    match: (item: SmartCityCase) => ["工业园区", "农业农村", "商贸物流"].includes(item.category),
  },
  {
    label: "公共服务",
    match: (item: SmartCityCase) => ["交通出行", "生态低碳", "文旅体育", "公共民生"].includes(item.category),
  },
  {
    label: "数据基础",
    match: (item: SmartCityCase) => item.category === "数据要素",
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
      });
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
  onSelectCase,
  onOpenCaseMenu,
  open,
  onOpenChange,
  openSubgroups,
  onSubgroupOpenChange,
}: {
  group: DirectoryGroup;
  selectedCaseId?: string;
  onSelectCase: (item: SmartCityCase) => void;
  onOpenCaseMenu: (event: ReactMouseEvent<HTMLButtonElement>, item: SmartCityCase) => void;
  open: boolean;
  onOpenChange: (key: string, open: boolean) => void;
  openSubgroups: Set<string>;
  onSubgroupOpenChange: (key: string, open: boolean) => void;
}) {
  const containsSelection = group.subgroups.some((subgroup) =>
    subgroup.cases.some((item) => item.id === selectedCaseId),
  );

  useEffect(() => {
    if (containsSelection) {
      const frame = window.requestAnimationFrame(() => onOpenChange(group.label, true));
      return () => window.cancelAnimationFrame(frame);
    }
  }, [containsSelection, group.label, onOpenChange]);

  return (
    <details
      open={open}
      onToggle={(event) => onOpenChange(group.label, event.currentTarget.open)}
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
            onOpenCaseMenu={onOpenCaseMenu}
            branchKey={`${group.label}::${subgroup.label}`}
            open={openSubgroups.has(`${group.label}::${subgroup.label}`)}
            onOpenChange={onSubgroupOpenChange}
          />
        ))}
        {group.subgroups.length === 0 && (
          <div className="px-2 py-2 text-[11px] text-slate-400">暂无案例</div>
        )}
      </div>
    </details>
  );
}

function DirectorySubBranch({
  subgroup,
  selectedCaseId,
  onSelectCase,
  onOpenCaseMenu,
  branchKey,
  open,
  onOpenChange,
}: {
  subgroup: DirectorySubgroup;
  selectedCaseId?: string;
  onSelectCase: (item: SmartCityCase) => void;
  onOpenCaseMenu: (event: ReactMouseEvent<HTMLButtonElement>, item: SmartCityCase) => void;
  branchKey: string;
  open: boolean;
  onOpenChange: (key: string, open: boolean) => void;
}) {
  const activeRef = useRef<HTMLButtonElement>(null);
  const containsSelection = subgroup.cases.some((item) => item.id === selectedCaseId);

  useEffect(() => {
    if (!containsSelection) return;
    const frame = window.requestAnimationFrame(() => {
      onOpenChange(branchKey, true);
      activeRef.current?.scrollIntoView({ block: "nearest" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [branchKey, containsSelection, onOpenChange, selectedCaseId]);

  return (
    <details
      open={open}
      onToggle={(event) => onOpenChange(branchKey, event.currentTarget.open)}
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
              onContextMenu={(event) => onOpenCaseMenu(event, item)}
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
              <span
                className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]"
                title={displayCaseTitle(item)}
              >
                {displayCaseTitle(item)}
              </span>
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
  deletableCaseIds,
  onSelectCase,
  onDeleteCase,
}: {
  groups: DirectoryGroup[];
  selectedCaseId?: string;
  deletableCaseIds: Set<string>;
  onSelectCase: (item: SmartCityCase) => void;
  onDeleteCase: (item: SmartCityCase) => void;
}) {
  const [openGroups, setOpenGroups] = useState<Set<string>>(
    () => new Set(groups.slice(0, 2).map((group) => group.label)),
  );
  const [openSubgroups, setOpenSubgroups] = useState<Set<string>>(() => new Set());
  const updateGroupOpen = useCallback((key: string, open: boolean) => {
    setOpenGroups((current) => {
      if (current.has(key) === open) return current;
      const next = new Set(current);
      if (open) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);
  const updateSubgroupOpen = useCallback((key: string, open: boolean) => {
    setOpenSubgroups((current) => {
      if (current.has(key) === open) return current;
      const next = new Set(current);
      if (open) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);
  const [contextMenu, setContextMenu] = useState<{
    item: SmartCityCase;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    if (!contextMenu) return;
    const closeMenu = () => setContextMenu(null);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };
    window.addEventListener("click", closeMenu);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", closeMenu);
    window.addEventListener("scroll", closeMenu, true);
    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
    };
  }, [contextMenu]);

  const openCaseMenu = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>, item: SmartCityCase) => {
      if (!deletableCaseIds.has(item.id)) return;
      event.preventDefault();
      event.stopPropagation();
      setContextMenu({
        item,
        x: Math.max(8, Math.min(event.clientX, window.innerWidth - 184)),
        y: Math.max(8, Math.min(event.clientY, window.innerHeight - 56)),
      });
    },
    [deletableCaseIds],
  );

  const confirmDelete = useCallback(() => {
    if (!contextMenu) return;
    const { item } = contextMenu;
    setContextMenu(null);
    if (window.confirm(`确认删除“${item.title}”吗？删除后无法恢复。`)) {
      onDeleteCase(item);
    }
  }, [contextMenu, onDeleteCase]);

  return (
    <>
      <div className="space-y-1 px-2 pb-5">
        {groups.map((group) => (
          <DirectoryBranch
            key={group.label}
            group={group}
            selectedCaseId={selectedCaseId}
            open={openGroups.has(group.label)}
            onOpenChange={updateGroupOpen}
            openSubgroups={openSubgroups}
            onSubgroupOpenChange={updateSubgroupOpen}
            onSelectCase={onSelectCase}
            onOpenCaseMenu={openCaseMenu}
          />
        ))}
        {groups.length === 0 && (
          <div className="px-4 py-12 text-center text-sm text-slate-500">当前条件下暂无案例</div>
        )}
      </div>
      {contextMenu && (
        <div
          role="menu"
          aria-label={`管理${contextMenu.item.title}`}
          className="fixed z-[120] w-44 rounded-lg border border-slate-200 bg-white p-1 shadow-xl"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            role="menuitem"
            onClick={confirmDelete}
            className="flex w-full items-center rounded-md px-3 py-2 text-left text-xs font-medium text-red-600 hover:bg-red-50 focus:bg-red-50 focus:outline-none"
          >
            删除案例
          </button>
        </div>
      )}
    </>
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
  const [caseFocusRequest, setCaseFocusRequest] = useState(0);
  const [documentOpen, setDocumentOpen] = useState(false);
  const [reportImportOpen, setReportImportOpen] = useState(false);
  const [reportImportText, setReportImportText] = useState("");
  const [reportImportMessage, setReportImportMessage] = useState("");
  const [reportImportFileName, setReportImportFileName] = useState("");
  const [reportImportBusy, setReportImportBusy] = useState(false);
  const [reportImportDraft, setReportImportDraft] = useState<SmartCityCase | null>(null);
  const [reportImportWarnings, setReportImportWarnings] = useState<string[]>([]);
  const [urlReady, setUrlReady] = useState(false);
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [aiScope, setAiScope] = useState<"case" | "map" | "all">("map");
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiResponse, setAiResponse] = useState("");

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
    if (["national", "province", "city"].includes(level ?? "")) {
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
    const syncLocalCases = async () => setLocalCases((await getLocalCases()).map((item) => {
      if (!item.researchReport) return item;
      const inferred = createCaseFromReport(item.researchReport);
      const hasMorePreciseLocation = inferred.locationLevel === "区县级" && item.locationLevel !== "园区/项目点";
      const needsTitleRepair = !cleanCaseTitleCandidate(item.title);
      return hasMorePreciseLocation || needsTitleRepair
        ? {
            ...item,
            ...(hasMorePreciseLocation ? {
              province: inferred.province,
              city: inferred.city,
              district: inferred.district,
              lng: inferred.lng,
              lat: inferred.lat,
              locationLevel: inferred.locationLevel,
              locationMethod: inferred.locationMethod,
              locationConfidence: inferred.locationConfidence,
              locationReason: inferred.locationReason,
              coverageType: inferred.coverageType,
            } : {}),
            ...(needsTitleRepair ? {
              title: inferred.title,
              sourceTitle: inferred.title,
              identity: inferred.identity,
            } : {}),
          }
        : item;
    }));
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
  const allYears = useMemo(
    () => Array.from(new Set(publishedCases.map((item) => item.year))).sort((a, b) => b - a),
    [publishedCases],
  );
  const provinces = provinceOptions;
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
  const cityOptions = useMemo(
    () => (activeProvince === "全部" ? [] : getCityOptions(activeProvince)),
    [activeProvince],
  );
  const directory = useMemo(
    () => buildDirectory(visibleCases, directoryMode),
    [directoryMode, visibleCases],
  );
  const deletableCaseIds = useMemo(
    () => new Set(localCases.map((item) => item.id)),
    [localCases],
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
  const casePoints = useMemo<AMapCasePoint[]>(
    () =>
      mappableVisibleCases.map((item) => ({
        id: item.id,
        title: displayCaseTitle(item),
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
  const administrativeFocus = useMemo<MapAdministrativeFocus>(
    () => {
      const province = activeProvince !== "全部" ? activeProvince : undefined;
      const city = activeCity !== "全部" ? activeCity : undefined;
      const focusPlace = getAdministrativeFocusPlace(province, city);
      return {
        level: mapLevel,
        province,
        city,
        center: focusPlace?.center,
        zoom: focusPlace?.zoom,
      };
    },
    [activeCity, activeProvince, mapLevel],
  );
  const focusCaseOnMap = useCallback((item: SmartCityCase) => {
    setSelectedCaseSlug(item.slug);
    setCaseFocusRequest((request) => request + 1);
    setDocumentOpen(false);
    setLeftOpen(false);
  }, []);

  const selectCasePoint = useCallback((id: string) => {
    const item = publishedCases.find((entry) => entry.id === id);
    if (!item) return;
    setSelectedCaseSlug(item.slug);
    setDocumentOpen(true);
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
    setSelectedCaseSlug("");
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
    } else if (level === "city") {
      setSelectedCaseSlug("");
      setDocumentOpen(false);
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

  const deleteCase = useCallback(async (item: SmartCityCase) => {
    const nextCases = await removeLocalCase(item.id);
    setLocalCases(nextCases);
    if (selectedCaseSlug === item.slug) {
      setSelectedCaseSlug("");
      setDocumentOpen(false);
      setMapLevel("national");
      setActiveProvince("全部");
      setActiveCity("全部");
    }
  }, [selectedCaseSlug]);

  const publishImportedCase = useCallback(async (importedCase: SmartCityCase) => {
    const confirmedCase: SmartCityCase = {
      ...importedCase,
      status: "已发布",
      identity: importedCase.identity ? { ...importedCase.identity, canonicalTitle: importedCase.title, needsReview: false } : importedCase.identity,
      updatedAt: new Date().toISOString(),
    };
    const nextCases = await saveLocalCase(confirmedCase);
    setLocalCases(nextCases);
    setSelectedCaseSlug(confirmedCase.slug);
    setMapLevel("city");
    setDocumentOpen(false);
    setReportImportText("");
    setReportImportFileName("");
    setReportImportDraft(null);
    setReportImportWarnings([]);
    setReportImportOpen(false);
    setReportImportMessage(`已入库：${confirmedCase.title}`);
  }, []);

  const verifyImportedCase = useCallback(async (preservedCase: SmartCityCase) => {
    const rawSource = preservedCase.researchReport || preservedCase.sourceExcerpt || "";
    // Imported DOCX/ZIP reports keep their Base64 images locally for faithful rendering.
    // AI verification only needs the textual evidence; sending image data URLs can exceed
    // the hosting request limit before the API route gets a chance to return JSON.
    const textOnlySource = rawSource
      .replace(/!\[([^\]]*)\]\(data:image\/[^;\s)]+;base64,[^)]+\)/gi, "$1")
      .replace(/<img\b[^>]*\bsrc=["']data:image\/[^"']+["'][^>]*>/gi, "")
      .trim();
    const verificationSource = textOnlySource.length <= MAX_CASE_SOURCE_CHARACTERS
      ? textOnlySource
      : `${textOnlySource.slice(0, MAX_CASE_SOURCE_CHARACTERS - 12_002)}\n\n${textOnlySource.slice(-12_000)}`;
    const formData = new FormData();
    formData.set("sourceText", verificationSource);
    formData.set("researchMode", "true");
    formData.set("productionMode", "standard");
    const response = await fetch("/api/ai/parse-case", { method: "POST", body: formData });
    const responseText = await response.text();
    let payload: CaseParserResponse | { error?: { message?: string } } | null = null;
    try {
      payload = responseText ? JSON.parse(responseText) as CaseParserResponse | { error?: { message?: string } } : null;
    } catch {
      if (response.status === 413 || /payload too large|request entity too large/i.test(responseText)) {
        throw new Error("报告内容过大，联网核验未能提交。系统已保留原文和图片，请压缩图片后重试。");
      }
      throw new Error("联网核验服务返回了无法识别的结果，请稍后重试；案例尚未入库。");
    }
    if (!response.ok || !payload || !("result" in payload)) {
      throw new Error((payload && "error" in payload && payload.error?.message) || "联网核验失败，案例未入库。请稍后重试。");
    }
    if (!payload.result.compatible) throw new Error(payload.result.incompatibilityReason || "资料无法识别为城市数字化案例。");
    const verified = payload.result;
    const canonicalTitle = verified.identity.canonicalTitle.trim() || verified.case.title.trim() || preservedCase.title;
    return {
      ...preservedCase,
      ...verified.case,
      title: canonicalTitle,
      slug: preservedCase.slug,
      status: "待复核" as const,
      identity: verified.identity,
      researchSources: verified.researchSources,
      researchQueries: verified.researchQueries,
      parsePipeline: payload.meta.pipeline,
      // 成熟报告正文和原图必须保真；AI只核验元数据，不替换正文结构。
      researchReport: preservedCase.researchReport,
      article: preservedCase.article,
      media: preservedCase.media,
      sourceTitle: preservedCase.sourceTitle,
      sourceExcerpt: preservedCase.sourceExcerpt,
      sourceNote: `由${reportImportFileName || "成熟报告"}导入；正文保留原结构，正式名称与项目位置已联网核验，待人工确认。`,
      updatedAt: new Date().toISOString(),
    } satisfies SmartCityCase;
  }, [reportImportFileName]);

  const importReport = useCallback(async () => {
    const text = reportImportText.trim();
    if (text.length < 80) {
      setReportImportMessage("请粘贴一份完整案例报告，至少包含项目名称和主要正文。");
      return;
    }

    setReportImportBusy(true);
    setReportImportMessage("正在联网核验正式名称和项目位置...");
    try {
      const preservedCase = createCaseFromReport(text);
      setReportImportDraft(await verifyImportedCase(preservedCase));
      setReportImportMessage("核验完成。请确认名称、地区、分类和正文预览后再入库。");
    } catch (error) {
      setReportImportMessage(error instanceof Error ? error.message : "联网核验失败，案例未入库。");
    } finally { setReportImportBusy(false); }
  }, [reportImportText, verifyImportedCase]);

  const importReportFile = useCallback(async (file: File | undefined) => {
    if (!file) return;
    setReportImportBusy(true);
    setReportImportFileName(file.name);
    setReportImportMessage("正在解析文件，请稍等...");
    try {
      const parsed = await parseReportFile(file);
      if (parsed.text.trim().length < 80) {
        setReportImportMessage("文件已读取，但正文太少，无法形成案例报告。");
        return;
      }
      const preservedCase = createCaseFromImportedReport(parsed.text, {
        media: parsed.media,
        importedFrom: parsed.fileName,
      });
      setReportImportWarnings(parsed.warnings);
      setReportImportMessage(`已解析原文结构、表格和 ${parsed.imageCount} 张图片，正在联网核验正式名称与精确位置...`);
      setReportImportDraft(await verifyImportedCase(preservedCase));
      setReportImportMessage("核验完成。请确认后入库；正文未经过 AI 改写。");
    } catch (error) {
      setReportImportMessage(error instanceof Error ? error.message : "文件解析失败，请换一个 .docx 或 .zip 重试。");
    } finally {
      setReportImportBusy(false);
    }
  }, [verifyImportedCase]);

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
        <Link href="/" className="brand-header-lockup flex min-w-0 shrink-0 items-center gap-2.5">
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
          <span className="brand-title-row hidden min-w-0 items-end md:flex">
            <strong className="brand-title block whitespace-nowrap">智慧城市及数据要素典型应用案例一张图</strong>
            <span className="brand-subtitle block whitespace-nowrap">
              Smart City and Data Element Application Case Portfolio Map
            </span>
          </span>
        </Link>
        <button type="button" onClick={() => setLeftOpen(true)} className="flex h-10 items-center rounded-md border border-slate-200 px-3 text-sm lg:hidden">
          目录
        </button>
        <label className="brand-search-wrap relative ml-auto hidden w-full max-w-2xl lg:block">
          <span className="sr-only">全局搜索案例</span>
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索项目、城市、场景或建设内容"
            className="brand-search h-10 w-full rounded-xl px-4 pr-10 text-sm outline-none transition"
          />
          <span className="pointer-events-none absolute right-3 top-2.5 text-slate-400">⌕</span>
        </label>
        <button type="button" onClick={() => setFilterOpen(true)} className="flex h-10 items-center rounded-md border border-slate-200 px-3 text-sm">
          筛选{activeFilterCount > 0 ? ` ${activeFilterCount}` : ""}
        </button>
        <button type="button" onClick={() => setRightOpen(true)} className="flex h-10 items-center rounded-md border border-slate-200 px-3 text-sm lg:hidden">
          Digital X AI
        </button>
        <Link href="/assets" className="hidden shrink-0 rounded-md border border-slate-200 px-3 py-2 text-xs font-medium hover:bg-slate-50 sm:block">
          案例资产
        </Link>
        <button
          type="button"
          onClick={() => {
            setReportImportOpen(true);
            setReportImportMessage("");
          }}
          className="brand-gradient-button hidden shrink-0 rounded-md px-3 py-2 text-xs font-semibold text-white shadow-sm sm:block"
        >
          新增案例
        </button>
      </header>

      {filterOpen && (
        <div className="fixed inset-0 z-[85] flex items-start justify-center bg-slate-950/30 p-4 pt-20" onMouseDown={() => setFilterOpen(false)}>
          <section className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between"><div><p className="brand-eyebrow text-[10px] font-bold">FILTERS</p><h2 className="mt-1 text-lg font-semibold">筛选案例</h2></div><button type="button" onClick={() => setFilterOpen(false)} className="rounded p-2 text-slate-500 hover:bg-slate-100">×</button></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-slate-500">应用分类<select value={category} onChange={(event) => setCategory(event.target.value as CaseCategory | "全部")} className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-2.5 text-xs"><option value="全部">全部分类</option>{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label className="text-xs text-slate-500">地区<select value={activeProvince} onChange={(event) => { const value = event.target.value; setActiveProvince(value); setActiveCity("全部"); setMapLevel(value === "全部" ? "national" : "province"); }} className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-2.5 text-xs"><option value="全部">全国</option>{provinces.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label className="text-xs text-slate-500">年份<select value={year} onChange={(event) => setYear(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-2.5 text-xs"><option value="全部">全部年份</option>{allYears.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label className="text-xs text-slate-500">证据等级<select value={evidenceLevel} onChange={(event) => setEvidenceLevel(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-2.5 text-xs"><option value="全部">全部证据</option>{evidenceLevels.map((item) => <option key={item}>{item}</option>)}</select></label>
            </div>
            <div className="mt-5 flex justify-between"><button type="button" onClick={clearFilters} className="text-xs text-slate-500 hover:text-slate-900">清空筛选</button><button type="button" onClick={() => setFilterOpen(false)} className="brand-gradient-button rounded-full px-5 py-2 text-xs font-semibold text-white">查看 {visibleCases.length} 个案例</button></div>
          </section>
        </div>
      )}

      {reportImportOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/35 p-4">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <div>
                <p className="brand-eyebrow text-[10px] font-bold tracking-[0.16em]">REPORT IMPORT</p>
                <h2 className="mt-1 text-lg font-semibold">导入已完成案例报告</h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  成熟报告默认保留原章节、表格与图片；系统联网核验正式名称和精确位置，确认后才会入库。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReportImportOpen(false)}
                className="rounded-md px-2 py-1 text-lg leading-none text-slate-500 hover:bg-slate-100"
              >
                ×
              </button>
            </div>
            <div className="space-y-3 px-5 py-4">
              <div className="rounded-xl border border-dashed border-cyan-300 bg-cyan-50/70 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">优先上传报告文件</h3>
                    <p className="mt-1 text-xs leading-5 text-slate-600">
                      支持 Word .docx，或包含 .md 与 media/ 图片目录的 .zip。图片会转入案例媒体并嵌入详情页。
                    </p>
                    {reportImportFileName && (
                      <p className="mt-1 text-[11px] text-cyan-700">当前文件：{reportImportFileName}</p>
                    )}
                  </div>
                  <label className="brand-gradient-button cursor-pointer rounded-md px-4 py-2 text-xs font-semibold text-white shadow-sm">
                    选择文件
                    <input
                      type="file"
                      accept=".docx,.zip,.md,.markdown"
                      className="sr-only"
                      disabled={reportImportBusy}
                      onChange={(event) => {
                        void importReportFile(event.target.files?.[0]);
                        event.currentTarget.value = "";
                      }}
                    />
                  </label>
                </div>
              </div>
              {!reportImportDraft && <textarea
                value={reportImportText}
                onChange={(event) => {
                  setReportImportText(event.target.value);
                  setReportImportMessage("");
                }}
                placeholder={"# 大湾区文化体育中心智慧运营管理平台\n\n## 项目概况\n粘贴你已经在其他 AI 或 Word 中整理好的完整报告正文..."}
                className="h-[34vh] min-h-56 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 outline-none transition focus:border-cyan-400 focus:bg-white"
              />}
              {reportImportDraft && (
                <div className="space-y-4">
                  <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
                    <label className="text-xs font-medium text-slate-600 md:col-span-2">项目公开正式名称
                      <input className="admin-input bg-white" value={reportImportDraft.title} onChange={(e) => setReportImportDraft((item) => item ? ({ ...item, title: e.target.value }) : item)} />
                    </label>
                    <label className="text-xs font-medium text-slate-600">省 / 市 / 区
                      <div className="mt-1 grid grid-cols-3 gap-2">
                        {(["province", "city", "district"] as const).map((key) => <input key={key} className="admin-input mt-0 bg-white" value={reportImportDraft[key] || ""} onChange={(e) => setReportImportDraft((item) => item ? ({ ...item, [key]: e.target.value }) : item)} />)}
                      </div>
                    </label>
                    <label className="text-xs font-medium text-slate-600">案例分类
                      <select className="admin-input bg-white" value={reportImportDraft.category} onChange={(e) => setReportImportDraft((item) => item ? ({ ...item, category: e.target.value as CaseCategory }) : item)}>
                        {categories.map((item) => <option key={item}>{item}</option>)}
                      </select>
                    </label>
                    <div className="text-xs leading-5 text-slate-600 md:col-span-2">
                      <strong>地图点位：</strong>{reportImportDraft.locationReason || "待确认"}（{reportImportDraft.lng}, {reportImportDraft.lat}）
                    </div>
                    {reportImportDraft.identity?.evidence?.length ? <div className="md:col-span-2 text-xs leading-5 text-slate-600"><strong>名称核验依据：</strong>{reportImportDraft.identity.evidence.slice(0, 2).map((item) => item.title).filter(Boolean).join("；") || reportImportDraft.identity.reason}</div> : null}
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="mb-3 flex items-center justify-between"><strong className="text-sm">原文保真预览</strong><span className="text-xs text-emerald-700">正文未经过 AI 改写</span></div>
                    <div className="max-h-[42vh] overflow-y-auto rounded-lg border border-slate-100"><CaseDocument item={reportImportDraft} onClose={() => undefined} /></div>
                  </div>
                  {reportImportWarnings.length > 0 && <p className="text-xs text-amber-700">解析提醒：{reportImportWarnings.join("；")}</p>}
                </div>
              )}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-5 text-slate-500">
                  {reportImportDraft ? "请重点确认正式名称、行政区和地图点位；无需进入复杂管理端。" : "上传后先解析和联网核验，不会直接写入案例库。"}
                </p>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setReportImportOpen(false)}
                    className="rounded-md border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={() => reportImportDraft ? void publishImportedCase(reportImportDraft) : void importReport()}
                    disabled={reportImportBusy}
                    className="brand-gradient-button rounded-md px-4 py-2 text-xs font-semibold text-white shadow-sm"
                  >
                    {reportImportBusy ? "解析与联网核验中..." : reportImportDraft ? "确认并入库" : "开始解析"}
                  </button>
                </div>
              </div>
              {reportImportMessage && (
                <p className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs text-cyan-800">
                  {reportImportMessage}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <section className="relative grid h-[calc(100dvh-68px)] min-h-0 max-h-[calc(100dvh-68px)] overflow-hidden lg:grid-cols-[320px_minmax(0,1fr)_296px]">
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
            <span>{visibleCases.length} 个项目结果</span>
            {activeCity !== "全部" && (
              <button type="button" onClick={() => selectCity("全部")} className="brand-link hover:underline">返回全国</button>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <DirectoryTree
              groups={directory}
              selectedCaseId={activeSelectedCase?.id}
              deletableCaseIds={deletableCaseIds}
              onSelectCase={focusCaseOnMap}
              onDeleteCase={deleteCase}
            />
          </div>
        </aside>

        <section className="workbench-map relative min-w-0 overflow-hidden">
          <AMapCaseMap
            cities={cities}
            casePoints={casePoints}
            displayMode="case"
            administrativeFocus={administrativeFocus}
            activeCity={activeCity}
            activeCaseId={activeSelectedCase?.id}
            caseFocusRequest={caseFocusRequest}
            onSelectCity={selectCity}
            onSelectCase={selectCasePoint}
            onClearFilters={clearFilters}
            className="h-full min-h-[420px]"
          />

          <div className="absolute left-3 top-12 z-10 flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-white/95 p-1.5 shadow-sm lg:left-4">
            <button
              type="button"
              onClick={() => setLevel("national")}
              className={`rounded px-2.5 py-1.5 text-[11px] font-medium ${
                mapLevel === "national" ? "brand-gradient-button text-white" : "text-slate-600 hover:bg-sky-50"
              }`}
            >
              全国
            </button>
            <select
              value={activeProvince}
              onChange={(event) => {
                const value = event.target.value;
                setActiveProvince(value);
                setActiveCity("全部");
                setSelectedCaseSlug("");
                setDocumentOpen(false);
                setMapLevel(value === "全部" ? "national" : "province");
              }}
              className="h-7 rounded-md border border-slate-200 bg-white px-2 text-[11px] font-medium text-slate-700 outline-none focus:border-cyan-400"
            >
              <option value="全部">选择省份</option>
              {provinces.map((item) => <option key={item}>{item}</option>)}
            </select>
            <select
              value={activeCity}
              onChange={(event) => {
                const value = event.target.value;
                setActiveCity(value);
                setSelectedCaseSlug("");
                setDocumentOpen(false);
                setMapLevel(value === "全部" ? (activeProvince === "全部" ? "national" : "province") : "city");
              }}
              disabled={activeProvince === "全部"}
              className="h-7 rounded-md border border-slate-200 bg-white px-2 text-[11px] font-medium text-slate-700 outline-none focus:border-cyan-400 disabled:bg-slate-50 disabled:text-slate-300"
            >
              <option value="全部">选择城市</option>
              {cityOptions.map((item) => <option key={item}>{item}</option>)}
            </select>
          </div>

          <div className="pointer-events-none absolute right-3 top-3 z-10 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-right shadow-sm backdrop-blur-sm">
            <p className="text-[11px] font-semibold text-slate-800">
              已收录 {indexedCaseStats.total.toLocaleString("zh-CN")} 个真实项目索引
            </p>
            <p className="mt-0.5 text-[10px] text-slate-500">
              {indexedCaseStats.mappable.toLocaleString("zh-CN")} 个空间点位 · {activeProvince === "全部" ? "全国" : activeProvince}
              {activeCity !== "全部" ? ` / ${activeCity}` : ""} 当前 {visibleCases.length} 项
            </p>
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
                {activeSelectedCase.asset?.contentStatus === "indexed" ? (
                  <div className="mx-auto mt-8 w-[min(680px,calc(100%-32px))] rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">项目索引 · 待研究</span>
                        <h2 className="mt-3 text-xl font-semibold leading-8 text-slate-900">{activeSelectedCase.title}</h2>
                      </div>
                      <button type="button" onClick={closeDocument} className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100">关闭</button>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600">{activeSelectedCase.category}</span>
                      <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600">证据等级 {activeSelectedCase.evidenceLevel}</span>
                      {activeSelectedCase.projectStage && <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600">{activeSelectedCase.projectStage}</span>}
                    </div>
                    <div className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-600 sm:grid-cols-2">
                      <p><strong className="text-slate-800">案例身份：</strong>{activeSelectedCase.asset.caseId}</p>
                      <p><strong className="text-slate-800">地区：</strong>{[activeSelectedCase.province, activeSelectedCase.city, activeSelectedCase.district].filter(Boolean).join(" · ")}</p>
                      <p><strong className="text-slate-800">分类：</strong>{activeSelectedCase.category}</p>
                      <p><strong className="text-slate-800">POI：</strong>{activeSelectedCase.locationReason || "展示锚点待核验"}</p>
                    </div>
                    <p className="mt-5 text-sm leading-7 text-slate-600">{activeSelectedCase.summary} 项目正式名称、建设单位、投资、系统架构、业务闭环、成效与图片仍需继续补采，当前信息不作为完整案例结论。</p>
                    <div className="mt-5 flex flex-wrap gap-2">
                      <Link href={`/lab/ai-case-studio?project=${encodeURIComponent(activeSelectedCase.title)}&case_id=${encodeURIComponent(activeSelectedCase.asset?.caseId || activeSelectedCase.id)}`} className="brand-gradient-button inline-flex rounded-full px-4 py-2 text-xs font-semibold text-white">研究并完善此案例</Link>
                      {activeSelectedCase.sourceUrl && <a href={activeSelectedCase.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-teal-700 hover:bg-teal-50">查看当前来源线索</a>}
                    </div>
                  </div>
                ) : <CaseDocument item={activeSelectedCase} onClose={closeDocument} />}
              </div>
            </div>
          )}
        </section>

        <aside className={`workbench-panel workbench-panel-right absolute inset-y-0 right-0 z-40 flex w-[min(320px,88vw)] flex-col transition-transform lg:static lg:w-auto lg:translate-x-0 ${rightOpen ? "translate-x-0" : "translate-x-full"}`}>
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <p className="brand-eyebrow text-[10px] font-bold tracking-[0.14em]">RESEARCH ASSISTANT</p>
              <h2 className="mt-0.5 text-base font-semibold">Digital X AI</h2>
            </div>
            <button type="button" onClick={() => setRightOpen(false)} className="rounded-md p-2 text-slate-500 lg:hidden">×</button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col p-4">
            <section className="brand-soft-card rounded-xl p-3">
              <p className="text-[11px] font-semibold text-slate-700">研究作用域</p>
              <div className="mt-2 grid grid-cols-3 gap-1 rounded-lg bg-white p-1 text-[10px]">
                {([['case','当前案例'],['map','地图结果'],['all','全部案例']] as const).map(([value, label]) => <button key={value} type="button" disabled={value === 'case' && !selectedCase} onClick={() => setAiScope(value)} className={`rounded-md px-1 py-2 ${aiScope === value ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100 disabled:opacity-40'}`}>{label}</button>)}
              </div>
              <p className="mt-2 text-[10px] leading-4 text-slate-500">{aiScope === 'case' ? selectedCase?.title || '请先选择一个案例' : aiScope === 'map' ? `当前地图筛选结果：${visibleCases.length} 个案例` : `公开资产库：${publishedCases.length} 个案例`}</p>
            </section>
            <section className="mt-4 min-h-0 flex-1 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-xs font-semibold text-slate-800">基于真实案例资产提问</p>
              <p className="mt-2 text-[11px] leading-5 text-slate-500">本轮已建立上下文结构。复杂 RAG 尚未接入，AI 不会把未核验信息写回案例资产。</p>
              <div className="mt-4 space-y-2">
                {(aiScope === "case"
                  ? ["这个项目为什么建设？", "实际建设了什么？", "数据从哪里来？", "有哪些业务闭环？", "投资和建设单位是什么？", "找类似案例", "与其他案例对比"]
                  : aiScope === "map"
                    ? ["总结当前地图结果的共性", "这些案例主要分布在哪些地区？", "比较当前结果的建设模式"]
                    : ["寻找可复用的平台能力", "归纳全部案例的主要建设方向", "找出证据最完整的案例"]
                ).map((text) => <button key={text} type="button" onClick={() => setAiQuestion(text)} className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-[11px] text-slate-600 hover:border-teal-300 hover:bg-teal-50">{text}</button>)}
              </div>
              <div className="mt-4 border-t border-slate-200 pt-3" aria-live="polite">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">回答</p>
                <p className="mt-2 text-[11px] leading-5 text-slate-600">{aiResponse || "选择快捷问题或输入研究问题后，回答将显示在这里。"}</p>
                <div className="mt-3 rounded-lg bg-slate-50 p-2 text-[10px] text-slate-500">
                  <strong className="block text-slate-600">来源引用</strong>
                  <span className="mt-1 block">待接入案例正文与 sources/source.md 引用。</span>
                </div>
              </div>
            </section>
            <div className="mt-3 rounded-xl border border-slate-200 bg-white p-2"><textarea value={aiQuestion} onChange={(event) => setAiQuestion(event.target.value)} placeholder="输入案例研究问题…" className="h-20 w-full resize-none p-2 text-xs outline-none"/><button type="button" disabled={!aiQuestion.trim()} onClick={() => setAiResponse(`已准备“${aiScope === "case" ? selectedCase?.title || "当前案例" : aiScope === "map" ? `${visibleCases.length} 个地图结果` : `${publishedCases.length} 个公开案例`}”上下文。复杂检索与生成将在下一阶段接入，本轮不会生成未经来源核验的回答。`)} className="brand-gradient-button w-full rounded-full py-2 text-xs font-semibold text-white disabled:opacity-40">提交研究问题</button></div>
          </div>
        </aside>
      </section>
    </main>
  );
}
