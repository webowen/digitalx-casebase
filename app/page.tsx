"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AMapCaseMap } from "@/components/amap-case-map";
import {
  categories,
  categoryColors,
  type CaseCategory,
  type EvidenceLevel,
  type LocationLevel,
  type SmartCityCase,
} from "@/lib/case-model";
import { cityStats, projectHealth } from "@/lib/case-analytics";
import { getPublishedCases, smartCityCases } from "@/lib/mock-cases";
import { getLocalCases } from "@/lib/local-cases";

const staticPublishedCases = getPublishedCases();
const locationLevels: LocationLevel[] = ["省级", "市级", "区县级", "园区/项目点"];
const evidenceLevels: EvidenceLevel[] = ["强", "中", "弱"];

type FilterValue = "全部" | string;

function matchesKeyword(item: SmartCityCase, keyword: string) {
  const search = keyword.trim().toLowerCase();
  if (!search) return true;
  const text = [
    item.title,
    item.city,
    item.province,
    item.district,
    item.category,
    item.summary,
    item.owner,
    item.coverageType,
    ...item.aiTags,
    ...item.solution,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return text.includes(search);
}

function CaseRow({ item }: { item: SmartCityCase }) {
  return (
    <Link
      href={`/cases/${item.slug}`}
      className="city-case-row group block border-b border-slate-100 py-4 last:border-b-0"
    >
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: categoryColors[item.category] }}
        />
        <span>{item.category}</span>
        <span>·</span>
        <span>{item.year}</span>
        <span className="ml-auto rounded bg-slate-100 px-1.5 py-0.5">证据 {item.evidenceLevel}</span>
      </div>
      <h4 className="mt-2 text-sm font-semibold leading-6 text-slate-900 group-hover:text-teal-700">
        {item.title}
      </h4>
      <div className="mt-2 text-xs text-slate-500">查看案例详情 →</div>
    </Link>
  );
}

export default function Home() {
  const [localCases, setLocalCases] = useState<SmartCityCase[]>([]);
  const [category, setCategory] = useState<CaseCategory | "全部">("全部");
  const [keyword, setKeyword] = useState("");
  const [province, setProvince] = useState<FilterValue>("全部");
  const [activeCity, setActiveCity] = useState<FilterValue>("全部");
  const [year, setYear] = useState<FilterValue>("全部");
  const [locationLevel, setLocationLevel] = useState<FilterValue>("全部");
  const [evidenceLevel, setEvidenceLevel] = useState<FilterValue>("全部");
  const [sourceType, setSourceType] = useState<FilterValue>("全部");

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

  const publishedCases = useMemo(
    () => [
      ...localCases.filter((item) => item.status === "已发布"),
      ...staticPublishedCases,
    ],
    [localCases],
  );
  const allYears = useMemo(
    () => Array.from(new Set(publishedCases.map((item) => item.year))).sort((a, b) => b - a),
    [publishedCases],
  );
  const allProvinces = useMemo(
    () => Array.from(new Set(publishedCases.map((item) => item.province))).sort(),
    [publishedCases],
  );
  const sourceTypes = useMemo(
    () => Array.from(new Set(publishedCases.map((item) => item.sourceType))),
    [publishedCases],
  );

  const cityOptions = useMemo(
    () =>
      Array.from(
        new Set(
          publishedCases
            .filter((item) => province === "全部" || item.province === province)
            .map((item) => item.city),
        ),
      ).sort(),
    [province, publishedCases],
  );

  const mapCases = useMemo(
    () =>
      publishedCases.filter((item) => {
        return (
          (category === "全部" || item.category === category) &&
          (province === "全部" || item.province === province) &&
          (year === "全部" || item.year === Number(year)) &&
          (locationLevel === "全部" || item.locationLevel === locationLevel) &&
          (evidenceLevel === "全部" || item.evidenceLevel === evidenceLevel) &&
          (sourceType === "全部" || item.sourceType === sourceType) &&
          matchesKeyword(item, keyword)
        );
      }),
    [category, evidenceLevel, keyword, locationLevel, province, publishedCases, sourceType, year],
  );

  const filteredCases = useMemo(
    () => mapCases.filter((item) => activeCity === "全部" || item.city === activeCity),
    [activeCity, mapCases],
  );

  const cities = useMemo(() => cityStats(mapCases), [mapCases]);
  const selectedCityCases = activeCity === "全部" ? [] : filteredCases;
  const health = projectHealth([...localCases, ...smartCityCases]);
  const activeFilterCount = [category, province, activeCity, year, locationLevel, evidenceLevel, sourceType].filter(
    (item) => item !== "全部",
  ).length + (keyword.trim() ? 1 : 0);

  function clearFilters() {
    setCategory("全部");
    setKeyword("");
    setProvince("全部");
    setActiveCity("全部");
    setYear("全部");
    setLocationLevel("全部");
    setEvidenceLevel("全部");
    setSourceType("全部");
  }

  function selectCategory(next: CaseCategory | "全部") {
    setCategory(next);
    setActiveCity("全部");
  }

  function selectCity(next: string) {
    setActiveCity(next);
    requestAnimationFrame(() => {
      document.getElementById("city-panel")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  return (
    <main className="home-shell min-h-screen bg-[#f4f7f9] text-slate-950">
      <header className="home-header sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="brand-lockup flex items-center gap-3">
            <span className="brand-mark flex h-9 w-9 items-center justify-center rounded-md bg-slate-950 text-sm font-semibold text-white">DX</span>
            <span>
              <span className="block text-sm font-semibold">DigitalX</span>
              <span className="block text-xs text-slate-500">城市数智应用案例库</span>
            </span>
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            <a href="#cases" className="hidden px-3 py-2 text-slate-600 hover:text-slate-950 sm:block">案例列表</a>
            <Link href="/admin" className="primary-pill rounded-md bg-slate-950 px-3.5 py-2 font-medium text-white">管理端</Link>
          </nav>
        </div>
      </header>

      <section className="home-hero border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-5 px-4 py-7 sm:px-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="home-hero-copy">
            <p className="hero-kicker text-sm font-medium text-teal-700">全国城市数智项目检索</p>
            <h1 className="mt-1 text-3xl font-semibold leading-tight sm:text-4xl">从地图找到城市做过的数智项目</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
              按行业场景、地区、年份和证据条件检索公开案例，观察项目分布，并进入案例查看建设内容与专业判断。
            </p>
          </div>
          <div className="hero-stats grid grid-cols-4 divide-x divide-slate-200 rounded-md border border-slate-200 bg-slate-50">
            {[
              ["案例样本", health.total],
              ["已发布", health.published],
              ["覆盖城市", cityStats(publishedCases).length],
              ["证据可用", health.evidenceReady],
            ].map(([label, value]) => (
              <div key={label} className="min-w-20 px-3 py-2.5 text-center sm:min-w-24">
                <div className="text-lg font-semibold">{value}</div>
                <div className="text-[11px] text-slate-500">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="home-filter-section mx-auto max-w-[1440px] px-4 py-5 sm:px-6">
        <div className="home-filter-panel rounded-md border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-200 px-4 py-3">
            <span className="mr-1 shrink-0 text-xs font-medium text-slate-500">应用分类</span>
            <button
              className={`filter-pill shrink-0 rounded-md px-3 py-1.5 text-sm ${category === "全部" ? "active bg-slate-950 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              onClick={() => selectCategory("全部")}
            >
              全部
            </button>
            {categories.map((item) => (
              <button
                key={item}
                className={`filter-pill shrink-0 rounded-md px-3 py-1.5 text-sm ${category === item ? "active bg-slate-950 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                onClick={() => selectCategory(item)}
              >
                {item}
              </button>
            ))}
          </div>

          <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(240px,1.7fr)_repeat(6,minmax(110px,1fr))_auto]">
            <label className="relative sm:col-span-2 lg:col-span-1">
              <span className="sr-only">关键词搜索</span>
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="搜索项目、城市或场景"
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 pr-8 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              />
              <span className="pointer-events-none absolute right-3 top-2.5 text-sm text-slate-400">⌕</span>
            </label>

            <label>
              <span className="sr-only">省份</span>
              <select
                value={province}
                onChange={(event) => { setProvince(event.target.value); setActiveCity("全部"); }}
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-2.5 text-sm outline-none focus:border-teal-600"
              >
                <option value="全部">全部省份</option>
                {allProvinces.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>

            <label>
              <span className="sr-only">城市</span>
              <select
                value={activeCity}
                onChange={(event) => selectCity(event.target.value)}
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-2.5 text-sm outline-none focus:border-teal-600"
              >
                <option value="全部">全部城市</option>
                {cityOptions.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>

            <label>
              <span className="sr-only">年份</span>
              <select value={year} onChange={(event) => { setYear(event.target.value); setActiveCity("全部"); }} className="h-10 w-full rounded-md border border-slate-200 bg-white px-2.5 text-sm outline-none focus:border-teal-600">
                <option value="全部">全部年份</option>
                {allYears.map((item) => <option key={item} value={String(item)}>{item} 年</option>)}
              </select>
            </label>

            <label>
              <span className="sr-only">空间层级</span>
              <select value={locationLevel} onChange={(event) => { setLocationLevel(event.target.value); setActiveCity("全部"); }} className="h-10 w-full rounded-md border border-slate-200 bg-white px-2.5 text-sm outline-none focus:border-teal-600">
                <option value="全部">全部层级</option>
                {locationLevels.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>

            <label>
              <span className="sr-only">证据等级</span>
              <select value={evidenceLevel} onChange={(event) => { setEvidenceLevel(event.target.value); setActiveCity("全部"); }} className="h-10 w-full rounded-md border border-slate-200 bg-white px-2.5 text-sm outline-none focus:border-teal-600">
                <option value="全部">全部证据</option>
                {evidenceLevels.map((item) => <option key={item} value={item}>证据 {item}</option>)}
              </select>
            </label>

            <label>
              <span className="sr-only">来源类型</span>
              <select value={sourceType} onChange={(event) => { setSourceType(event.target.value); setActiveCity("全部"); }} className="h-10 w-full rounded-md border border-slate-200 bg-white px-2.5 text-sm outline-none focus:border-teal-600">
                <option value="全部">全部来源</option>
                {sourceTypes.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>

            <button onClick={clearFilters} className="h-10 whitespace-nowrap rounded-md border border-slate-200 px-3 text-sm text-slate-600 hover:bg-slate-50">
              清空{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
            </button>
          </div>
        </div>
      </section>

      <section id="map" className="home-map-section mx-auto grid max-w-[1440px] gap-5 px-4 pb-5 sm:px-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="map-panel overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold">全国案例分布</h2>
              <p className="mt-0.5 text-xs text-slate-500">圆点大小表示当前条件下的城市案例数量</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span><b className="font-semibold text-slate-950">{mapCases.length}</b> 个案例</span>
              <span><b className="font-semibold text-slate-950">{cities.length}</b> 个城市</span>
              <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full bg-teal-600" /> 可点击城市</span>
            </div>
          </div>

          <AMapCaseMap
            cities={cities}
            activeCity={activeCity}
            onSelectCity={selectCity}
            onClearFilters={clearFilters}
          />
        </div>

        <aside id="city-panel" className="city-panel rounded-md border border-slate-200 bg-white shadow-sm">
          <div className="flex items-start justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <p className="text-xs font-medium text-teal-700">城市案例抽屉</p>
              <h3 className="mt-0.5 text-lg font-semibold">{activeCity === "全部" ? "城市项目排行" : activeCity}</h3>
            </div>
            {activeCity !== "全部" && (
              <button onClick={() => setActiveCity("全部")} className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50">关闭</button>
            )}
          </div>

          <div className="max-h-[544px] overflow-y-auto px-4">
            {activeCity === "全部" ? (
              <div className="py-2">
                {cities.map((item, index) => (
                  <button
                    key={item.city}
                    onClick={() => selectCity(item.city)}
                    className="flex w-full items-center gap-3 border-b border-slate-100 py-3 text-left last:border-b-0 hover:text-teal-700"
                  >
                    <span className="w-5 text-xs tabular-nums text-slate-400">{String(index + 1).padStart(2, "0")}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{item.city}</span>
                      <span className="block text-xs text-slate-500">{item.province}</span>
                    </span>
                    <span className="rounded bg-slate-950 px-2 py-1 text-xs font-semibold text-white">{item.count}</span>
                  </button>
                ))}
                {cities.length === 0 && <p className="py-10 text-center text-sm text-slate-500">暂无城市排行</p>}
              </div>
            ) : (
              <div>
                <div className="border-b border-slate-100 py-3 text-xs text-slate-500">
                  当前条件下共 <b className="text-slate-950">{selectedCityCases.length}</b> 个公开案例
                </div>
                {selectedCityCases.map((item) => <CaseRow key={item.id} item={item} />)}
                {selectedCityCases.length === 0 && <p className="py-10 text-center text-sm text-slate-500">该城市暂无符合条件的案例</p>}
              </div>
            )}
          </div>
        </aside>
      </section>

      <section id="cases" className="home-cases-section mx-auto max-w-[1440px] px-4 pb-14 sm:px-6">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-teal-700">检索结果</p>
            <h2 className="mt-0.5 text-2xl font-semibold">{activeCity === "全部" ? "公开案例" : `${activeCity}案例`}</h2>
          </div>
          <p className="text-sm text-slate-500">找到 {filteredCases.length} 个案例，按年份从新到旧展示</p>
        </div>

        {filteredCases.length > 0 ? (
          <div className="case-grid grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[...filteredCases].sort((a, b) => b.year - a.year).map((item) => (
              <Link href={`/cases/${item.slug}`} key={item.id} className="case-card group rounded-md border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md">
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded px-2 py-1 text-xs font-medium text-white" style={{ backgroundColor: categoryColors[item.category] }}>{item.category}</span>
                  <span className="text-xs text-slate-500">{item.province} · {item.year}</span>
                </div>
                <h3 className="mt-4 line-clamp-2 text-lg font-semibold leading-7 group-hover:text-teal-700">{item.title}</h3>
                <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{item.summary}</p>
                <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
                  <span>{item.locationLevel} · {item.sourceType}</span>
                  <span>证据 {item.evidenceLevel}</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-slate-300 bg-white py-14 text-center">
            <h3 className="font-medium">没有找到匹配案例</h3>
            <p className="mt-1 text-sm text-slate-500">可以减少筛选条件或换一个关键词</p>
            <button onClick={clearFilters} className="mt-4 rounded-md bg-slate-950 px-4 py-2 text-sm text-white">清空全部筛选</button>
          </div>
        )}
      </section>

      <footer className="home-footer border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-2 px-4 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>DigitalX 城市数智应用案例库</span>
          <span>原型数据仅用于产品逻辑演示，正式案例将绑定原始资料与证据来源。</span>
        </div>
      </footer>
    </main>
  );
}
