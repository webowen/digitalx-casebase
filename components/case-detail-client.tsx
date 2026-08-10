"use client";

import Image from "next/image";
import Link from "next/link";
import {
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  categoryColors,
  type CaseMediaAsset,
  type SmartCityCase,
} from "@/lib/case-model";
import { buildCaseDocument } from "@/lib/case-document";
import { normalizeArticle } from "@/lib/case-editorial";
import { getLocalCases } from "@/lib/local-cases";

type DetailMode = "read" | "research";
type ReadingFlow = "scroll" | "paged";
type ReadingTheme = "paper" | "white" | "night";

type ReaderChapter = {
  id: string;
  eyebrow: string;
  title: string;
  paragraphs?: string[];
  points?: string[];
  note?: string;
  media?: CaseMediaAsset[];
};

type ReaderPreference = {
  flow: ReadingFlow;
  theme: ReadingTheme;
  fontSize: number;
  anchor?: string;
  progress?: number;
};

type PageTurnState = {
  direction: "next" | "previous";
  fromPage: number;
  toPage: number;
};

const PAGE_GAP_DESKTOP = 76;
const PAGE_GAP_TABLET = 28;
const PAGE_TURN_DURATION = 720;

const mediaKindLabels: Record<CaseMediaAsset["kind"], string> = {
  platform_ui: "平台界面",
  dashboard: "驾驶舱 / 大屏",
  architecture: "架构与流程",
  map: "空间地图",
  site_photo: "现场照片",
  document: "原始资料",
  other: "案例图片",
};

function preferenceKey(slug: string) {
  return `digitalx-reader-v2-${slug}`;
}

function makeResearchChapters(report?: string): ReaderChapter[] {
  if (!report?.trim()) return [];
  const sections = report
    .split(/\n(?=##\s+)/)
    .map((section) => section.trim())
    .filter(Boolean);

  return sections.map((section, index) => {
    const lines = section.split("\n");
    const heading = lines[0]?.replace(/^##\s*/, "").trim();
    const hasHeading = Boolean(lines[0]?.startsWith("## "));
    const body = (hasHeading ? lines.slice(1) : lines)
      .join("\n")
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.replace(/^[-*]\s+/, "").trim())
      .filter(Boolean);

    return {
      id: `research-${index + 1}`,
      eyebrow: `联网研究 ${String(index + 1).padStart(2, "0")}`,
      title: heading || (index === 0 ? "联网资料综合研究" : `补充研究 ${index + 1}`),
      paragraphs: body,
    };
  });
}

function makeChapters(item?: SmartCityCase): ReaderChapter[] {
  if (!item) return [];
  const document = buildCaseDocument(item);

  const sourceChapter: ReaderChapter = {
    id: "sources",
    eyebrow: "附录",
    title: "证据、来源与阅读说明",
    paragraphs: [
      item.sourceNote,
      item.sourceExcerpt ? `原文摘录：${item.sourceExcerpt}` : "",
    ].filter(Boolean),
    note: `来源类型：${item.sourceType}｜证据等级：${item.evidenceLevel}｜入库状态：${item.status}`,
  };
  const documentChapters: ReaderChapter[] = document.sections.map(
    (section, index) => ({
      id: `document-${section.id}-${index}`,
      eyebrow: document.preservesSourceStructure
        ? "原报告章节"
        : `第 ${String(index + 1).padStart(2, "0")} 部分`,
      title: section.title,
      paragraphs: [section.summary, ...section.paragraphs].filter(Boolean),
      points: [
        ...section.points,
        ...section.scenarios.map((scenario) =>
          [
            scenario.name,
            scenario.problem ? `业务问题：${scenario.problem}` : "",
            scenario.systemActions.length
              ? `系统动作：${scenario.systemActions.join("、")}`
              : "",
            scenario.result ? `形成结果：${scenario.result}` : "",
          ]
            .filter(Boolean)
            .join("｜"),
        ),
      ],
      media: section.media,
    }),
  );
  return [
    {
      id: "abstract",
      eyebrow: "导读",
      title: "案例导读",
      paragraphs: [document.standfirst],
      points: document.keyFindings,
      note: document.preservesSourceStructure
        ? "正文保留原报告章节与顺序。"
        : `正文仅展示获得事实支撑的章节。当前证据等级为“${item.evidenceLevel}”。`,
    },
    ...documentChapters,
    ...(document.preservesSourceStructure ? [] : makeResearchChapters(item.researchReport)),
    sourceChapter,
  ];
}

function estimateReadingMinutes(item: SmartCityCase, chapters: ReaderChapter[]) {
  const content = [
    item.title,
    item.summary,
    ...chapters.flatMap((chapter) => [
      chapter.title,
      ...(chapter.paragraphs || []),
      ...(chapter.points || []),
    ]),
  ].join("");
  return Math.max(3, Math.ceil(content.length / 460));
}

function ResearchView({ item }: { item: SmartCityCase }) {
  const facts = [
    ["建设主体", item.owner],
    ["项目阶段", item.projectStage],
    ["项目投资", item.investmentAmount],
    ["资金来源", item.fundingSource],
    ["实施单位", item.implementationUnit],
    ["运营单位", item.operationUnit],
    ["空间层级", item.locationLevel],
    ["覆盖类型", item.coverageType],
    ["坐标", `${item.lng.toFixed(4)}, ${item.lat.toFixed(4)}`],
    ["位置置信度", `${Math.round(item.locationConfidence * 100)}%`],
    ["正式名称置信度", item.identity ? `${Math.round(item.identity.confidence * 100)}%` : ""],
  ].filter(([, value]) => value);
  const article = item.article?.sections.length ? normalizeArticle(item.article, item) : null;

  return (
    <div className="research-sheet">
      <section>
        <p className="research-kicker">案例档案</p>
        <h1>{item.title}</h1>
        <p className="research-summary">{article?.standfirst || item.summary}</p>
      </section>

      <section className="research-section">
        <h2>项目基本信息</h2>
        <dl className="research-facts">
          {facts.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {article ? (
        <>
          {article.keyFindings.length > 0 && (
            <section className="research-section">
              <p className="research-kicker">Executive summary</p>
              <h2>关键结论</h2>
              <ol className="research-list">
                {article.keyFindings.map((value) => <li key={value}>{value}</li>)}
              </ol>
            </section>
          )}
          {article.sections.map((section, index) => (
            <section key={section.id} className={`research-section ${section.id === "boundaries" ? "research-judgement" : ""}`}>
              <p className="research-kicker">第 {String(index + 1).padStart(2, "0")} 章</p>
              <h2>{section.title}</h2>
              {section.summary && <p className="font-medium text-slate-700">{section.summary}</p>}
              <div className="mt-3 space-y-3">
                {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </div>
              {section.points.length > 0 && (
                <ol className="research-list mt-4">
                  {section.points.map((value) => <li key={value}>{value}</li>)}
                </ol>
              )}
              {section.evidenceRefs.length > 0 && (
                <div className="mt-3 text-xs text-slate-400">证据关联：{section.evidenceRefs.join("、")}</div>
              )}
              {(item.media || [])
                .filter((asset) => asset.included && asset.reviewed && asset.sectionId === section.id)
                .map((asset) => (
                  <figure key={asset.id} className="mt-5 overflow-hidden rounded border border-slate-200 bg-white">
                    <Image
                      src={asset.url}
                      alt={asset.alt}
                      width={1600}
                      height={1000}
                      unoptimized
                      className="h-auto w-full object-contain"
                    />
                    <figcaption className="border-t border-slate-100 px-4 py-3 text-xs leading-5 text-slate-500">
                      {asset.caption}
                      <span className="ml-2 text-slate-400">
                        {asset.sourceKind === "pdf_page" ? `原始资料第${asset.pageNumber}页` : "原始网页图片"}
                      </span>
                    </figcaption>
                  </figure>
                ))}
            </section>
          ))}
        </>
      ) : (
        <>
          {[
            ["建设背景 / 痛点", item.painPoints],
            ["建设内容", item.solution],
            ["项目成效", item.outcomes],
          ].map(([title, values]) => (
            <section key={title as string} className="research-section">
              <h2>{title as string}</h2>
              <ol className="research-list">
                {(values as string[]).map((value) => <li key={value}>{value}</li>)}
              </ol>
            </section>
          ))}
          <section className="research-section research-judgement">
            <p className="research-kicker">案例库研判</p>
            <h2>专业判断与适用边界</h2>
            <p>{item.expertView}</p>
          </section>
          {item.researchReport && (
            <section className="research-section">
              <p className="research-kicker">旧版联网资料扩展</p>
              <h2>完整案例研究</h2>
              <div className="space-y-5">
                {makeResearchChapters(item.researchReport).map((section) => (
                  <div key={section.id}>
                    <h3 className="text-base font-semibold text-slate-900">{section.title}</h3>
                    <div className="mt-2 space-y-3">
                      {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <section className="research-section">
        <h2>来源与证据</h2>
        <dl className="research-facts">
          <div><dt>来源类型</dt><dd>{item.sourceType}</dd></div>
          <div><dt>证据等级</dt><dd>{item.evidenceLevel}</dd></div>
          <div><dt>来源说明</dt><dd>{item.sourceNote}</dd></div>
          {item.sourceTitle && <div><dt>来源标题</dt><dd>{item.sourceTitle}</dd></div>}
        </dl>
        {item.sourceUrl && (
          <a className="research-source-link" href={item.sourceUrl} target="_blank" rel="noreferrer">
            打开原始资料 ↗
          </a>
        )}
        {(item.researchSources?.length || 0) > 0 && (
          <div className="mt-5">
            <h3 className="text-sm font-semibold">联网核验来源</h3>
            <ol className="mt-2 space-y-2 text-sm">
              {item.researchSources?.map((source) => (
                <li key={source.url}>
                  <a className="research-source-link" href={source.url} target="_blank" rel="noreferrer">
                    {source.title || source.url} ↗
                  </a>
                </li>
              ))}
            </ol>
          </div>
        )}
        <div className="research-tags">
          {item.aiTags.map((tag) => <span key={tag}>#{tag}</span>)}
        </div>
      </section>
    </div>
  );
}

function ReaderContent({
  item,
  chapters,
  clone = false,
}: {
  item: SmartCityCase;
  chapters: ReaderChapter[];
  clone?: boolean;
}) {
  const readingMinutes = estimateReadingMinutes(item, chapters);
  return (
    <>
      <section
        className="reader-cover"
        id={clone ? undefined : "cover"}
        data-reader-anchor={clone ? undefined : true}
      >
        <div className="reader-cover-masthead">
          <div className="reader-cover-series">{item.category} · 城市数智案例</div>
          <div className="reader-cover-issue">CASE / {item.year}</div>
        </div>
        <div className="reader-cover-rule" />
        <div className="reader-cover-meta">
          <span style={{ color: categoryColors[item.category] }}>{item.category}</span>
          <span>{item.province} · {item.city}</span>
          <span>{item.year}</span>
        </div>
        <h1>{item.title}</h1>
        <p className="reader-deck">{item.article?.standfirst || item.summary}</p>
        <dl className="reader-cover-facts">
          <div>
            <dt>建设主体</dt>
            <dd>{item.owner || "待进一步核验"}</dd>
          </div>
          <div>
            <dt>项目阶段</dt>
            <dd>{item.projectStage || "公开信息未披露"}</dd>
          </div>
          <div>
            <dt>证据等级</dt>
            <dd>{item.evidenceLevel}</dd>
          </div>
        </dl>
        <div className="reader-cover-footer">
          <span>DigitalX 城市数智应用案例库</span>
          <span>预计阅读 {readingMinutes} 分钟</span>
        </div>
      </section>

      {chapters.map((chapter, chapterIndex) => {
        const [lead, ...body] = chapter.paragraphs || [];
        const isAbstract = chapter.id === "abstract";
        return (
          <section
            className={`reader-section ${isAbstract ? "reader-section-abstract" : ""}`}
            id={clone ? undefined : chapter.id}
            data-reader-anchor={clone ? undefined : true}
            key={chapter.id}
          >
            <header className="reader-chapter-header">
              <div>
                <p className="reader-eyebrow">{chapter.eyebrow}</p>
                <h2>{chapter.title}</h2>
              </div>
              <span className="reader-chapter-number">{String(chapterIndex + 1).padStart(2, "0")}</span>
            </header>
            {lead && <p className="reader-section-lead">{lead}</p>}
            {body.length > 0 && (
              <div className="reader-section-body">
                {body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </div>
            )}
            {chapter.points && chapter.points.length > 0 && (
              <ol className={isAbstract ? "reader-key-findings" : "reader-numbered-list"}>
                {chapter.points.map((point, index) => (
                  <li key={point}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <p>{point}</p>
                  </li>
                ))}
              </ol>
            )}
            {chapter.media?.map((asset) => (
              <figure className="reader-figure" key={asset.id}>
                <div className="reader-figure-label">{mediaKindLabels[asset.kind]}</div>
                <Image
                  src={asset.url}
                  alt={asset.alt}
                  width={1600}
                  height={1000}
                  unoptimized
                />
                <figcaption>
                  <strong>图｜</strong>{asset.caption}
                  <span>{asset.sourceKind === "pdf_page" ? `原始资料第${asset.pageNumber}页` : "原始网页图片"}</span>
                </figcaption>
              </figure>
            ))}
            {chapter.id === "sources" && item.sourceUrl && (
              <a className="reader-source-link" href={item.sourceUrl} target="_blank" rel="noreferrer" tabIndex={clone ? -1 : undefined}>
                查看原始资料 ↗
              </a>
            )}
            {chapter.id === "sources" && (item.researchSources?.length || 0) > 0 && (
              <ol className="reader-numbered-list">
              {item.researchSources?.map((source, index) => (
                <li key={source.url}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <p>
                    <a className="reader-source-link" href={source.url} target="_blank" rel="noreferrer" tabIndex={clone ? -1 : undefined}>
                      {source.title || source.url} ↗
                    </a>
                  </p>
                </li>
              ))}
              </ol>
            )}
            {chapter.note && <aside className="reader-note"><strong>编辑说明</strong>{chapter.note}</aside>}
          </section>
        );
      })}
    </>
  );
}

export function CaseDetailClient({
  slug,
  initialItem,
}: {
  slug: string;
  initialItem?: SmartCityCase;
}) {
  const [item, setItem] = useState<SmartCityCase | undefined>(initialItem);
  const [loaded, setLoaded] = useState(Boolean(initialItem));
  const [detailMode, setDetailMode] = useState<DetailMode>("read");
  const [flow, setFlow] = useState<ReadingFlow>("paged");
  const [theme, setTheme] = useState<ReadingTheme>("paper");
  const [fontSize, setFontSize] = useState(18);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);
  const [activeAnchor, setActiveAnchor] = useState("cover");
  const [progress, setProgress] = useState(0);
  const [pageWidth, setPageWidth] = useState(560);
  const [pageGap, setPageGap] = useState(PAGE_GAP_DESKTOP);
  const [pagesPerSpread, setPagesPerSpread] = useState(2);
  const [pageCount, setPageCount] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageTurn, setPageTurn] = useState<PageTurnState | null>(null);
  const [mobileChromeVisible, setMobileChromeVisible] = useState(false);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const pagedViewportRef = useRef<HTMLDivElement>(null);
  const pagedFlowRef = useRef<HTMLDivElement>(null);
  const restoredRef = useRef(false);
  const turnTimersRef = useRef<number[]>([]);
  const pointerStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const swipeHandledRef = useRef(false);
  const chapters = useMemo(() => makeChapters(item), [item]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(async () => {
      if (!initialItem) {
        setItem((await getLocalCases()).find((current) => current.slug === slug && current.status === "已发布"));
      }
      setLoaded(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [initialItem, slug]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const saved = JSON.parse(window.localStorage.getItem(preferenceKey(slug)) || "{}") as ReaderPreference;
        if (saved.flow === "scroll" || saved.flow === "paged") setFlow(saved.flow);
        if (saved.theme === "paper" || saved.theme === "white" || saved.theme === "night") setTheme(saved.theme);
        if (saved.fontSize && saved.fontSize >= 15 && saved.fontSize <= 23) setFontSize(saved.fontSize);
        if (saved.anchor) setActiveAnchor(saved.anchor);
        if (typeof saved.progress === "number") setProgress(saved.progress);
      } catch {
        // A broken device-local preference should never block the reader.
      }
      setPreferencesReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [slug]);

  const savePreference = useCallback((next?: Partial<ReaderPreference>) => {
    const value: ReaderPreference = {
      flow,
      theme,
      fontSize,
      anchor: activeAnchor,
      progress,
      ...next,
    };
    window.localStorage.setItem(preferenceKey(slug), JSON.stringify(value));
  }, [activeAnchor, flow, fontSize, progress, slug, theme]);

  useEffect(() => {
    if (!loaded) return;
    savePreference();
  }, [flow, fontSize, loaded, savePreference, theme]);

  useEffect(() => {
    if (detailMode !== "read" || flow !== "scroll") return;

    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const nextProgress = max > 0 ? Math.min(100, Math.max(0, (window.scrollY / max) * 100)) : 0;
      setProgress(nextProgress);

      const anchors = Array.from(document.querySelectorAll<HTMLElement>("[data-reader-anchor]"));
      const nearest = anchors
        .filter((section) => section.getBoundingClientRect().top <= window.innerHeight * 0.38)
        .at(-1);
      if (nearest?.id) setActiveAnchor(nearest.id);
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [detailMode, flow]);

  useEffect(() => {
    if (detailMode !== "read" || flow !== "paged") return;
    const viewport = pagedViewportRef.current;
    const content = pagedFlowRef.current;
    if (!viewport || !content) return;

    const measure = () => {
      const viewportWidth = viewport.clientWidth;
      const nextPagesPerSpread = window.innerWidth >= 1200 ? 2 : 1;
      const gap = nextPagesPerSpread === 2 ? PAGE_GAP_DESKTOP : PAGE_GAP_TABLET;
      const nextPageWidth =
        nextPagesPerSpread === 2
          ? (viewportWidth - gap) / 2
          : viewportWidth;
      setPageWidth(nextPageWidth);
      setPageGap(gap);
      setPagesPerSpread(nextPagesPerSpread);
      requestAnimationFrame(() => {
        const stride = nextPageWidth + gap;
        setPageCount(Math.max(1, Math.ceil((content.scrollWidth + gap) / stride)));
      });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    measure();
    return () => observer.disconnect();
  }, [detailMode, flow, fontSize, item]);

  useEffect(() => {
    if (!loaded || !item || !preferencesReady || detailMode !== "read" || restoredRef.current) return;
    restoredRef.current = true;
    const frame = window.requestAnimationFrame(() => {
      const target = document.getElementById(activeAnchor);
      if (!target || activeAnchor === "cover") return;
      if (flow === "scroll") {
        target.scrollIntoView({ block: "start" });
      } else {
        const viewport = pagedViewportRef.current;
        if (!viewport) return;
        const left = viewport.scrollLeft + target.getBoundingClientRect().left - viewport.getBoundingClientRect().left;
        viewport.scrollTo({ left, behavior: "auto" });
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeAnchor, detailMode, flow, item, loaded, preferencesReady]);

  function handlePagedScroll() {
    const viewport = pagedViewportRef.current;
    if (!viewport) return;
    const spreadStride = (pageWidth + pageGap) * pagesPerSpread;
    const spreadIndex = Math.max(0, Math.round(viewport.scrollLeft / spreadStride));
    const page = Math.min(pageCount, spreadIndex * pagesPerSpread + 1);
    setCurrentPage(page);
    setProgress(pageCount > 1 ? ((page - 1) / (pageCount - 1)) * 100 : 0);

    const anchors = Array.from(viewport.querySelectorAll<HTMLElement>("[data-reader-anchor]"));
    const current = anchors
      .filter((section) => section.offsetLeft <= viewport.scrollLeft + pageWidth * 0.45)
      .at(-1);
    if (current?.id) setActiveAnchor(current.id);
  }

  const goToPage = useCallback((page: number, behavior: ScrollBehavior = "smooth") => {
    const viewport = pagedViewportRef.current;
    if (!viewport) return;
    const target = Math.min(pageCount, Math.max(1, page));
    const spreadStart = Math.floor((target - 1) / pagesPerSpread) * pagesPerSpread;
    viewport.scrollTo({
      left: spreadStart * (pageWidth + pageGap),
      behavior,
    });
  }, [pageCount, pageGap, pageWidth, pagesPerSpread]);

  const turnPage = useCallback((direction: "next" | "previous") => {
    if (pageTurn) return;
    const delta = direction === "next" ? pagesPerSpread : -pagesPerSpread;
    const toPage = Math.min(pageCount, Math.max(1, currentPage + delta));
    if (toPage === currentPage) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      goToPage(toPage);
      return;
    }

    setPageTurn({ direction, fromPage: currentPage, toPage });
    turnTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    turnTimersRef.current = [
      window.setTimeout(() => goToPage(toPage, "auto"), PAGE_TURN_DURATION * 0.48),
      window.setTimeout(() => setPageTurn(null), PAGE_TURN_DURATION + 40),
    ];
  }, [currentPage, goToPage, pageCount, pageTurn, pagesPerSpread]);

  useEffect(() => () => {
    turnTimersRef.current.forEach((timer) => window.clearTimeout(timer));
  }, []);

  function goToAnchor(id: string) {
    setActiveAnchor(id);
    setTocOpen(false);
    requestAnimationFrame(() => {
      const target = document.getElementById(id);
      if (!target) return;
      if (flow === "scroll") {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        const viewport = pagedViewportRef.current;
        if (!viewport) return;
        const left = viewport.scrollLeft + target.getBoundingClientRect().left - viewport.getBoundingClientRect().left;
        const targetPage = Math.floor(left / (pageWidth + pageGap)) + 1;
        goToPage(targetPage);
      }
      savePreference({ anchor: id });
    });
  }

  function switchFlow(next: ReadingFlow) {
    setPageTurn(null);
    turnTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    setFlow(next);
    setSettingsOpen(false);
    restoredRef.current = false;
  }

  function handleReaderSurfaceClick(event: ReactMouseEvent<HTMLElement>) {
    if (swipeHandledRef.current) {
      swipeHandledRef.current = false;
      return;
    }
    if (window.innerWidth >= 768) return;
    const target = event.target as HTMLElement;
    if (target.closest("a, button, input, select, textarea")) return;

    if (flow === "paged") {
      const ratio = event.clientX / window.innerWidth;
      if (ratio < 0.22) {
        turnPage("previous");
        return;
      }
      if (ratio > 0.78) {
        turnPage("next");
        return;
      }
    }
    setMobileChromeVisible((value) => !value);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLElement>) {
    if (event.pointerType === "mouse") return;
    pointerStartRef.current = { x: event.clientX, y: event.clientY, time: Date.now() };
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLElement>) {
    const start = pointerStartRef.current;
    pointerStartRef.current = null;
    if (!start || flow !== "paged") return;
    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (
      Date.now() - start.time <= 900 &&
      Math.abs(deltaX) >= 46 &&
      Math.abs(deltaX) > Math.abs(deltaY) * 1.25
    ) {
      swipeHandledRef.current = true;
      turnPage(deltaX < 0 ? "next" : "previous");
    }
  }

  useEffect(() => {
    if (detailMode !== "read" || flow !== "paged") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") turnPage("previous");
      if (event.key === "ArrowRight") turnPage("next");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [detailMode, flow, turnPage]);

  useEffect(() => {
    if (!mobileChromeVisible || settingsOpen || tocOpen || detailMode !== "read") return;
    const timer = window.setTimeout(() => setMobileChromeVisible(false), 4200);
    return () => window.clearTimeout(timer);
  }, [detailMode, mobileChromeVisible, settingsOpen, tocOpen]);

  if (!loaded) {
    return <main className="min-h-screen bg-[#f2eee4]" />;
  }

  if (!item) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f6f8fb] px-5 text-center">
        <div className="rounded border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-semibold">案例不存在或尚未发布</h1>
          <p className="mt-2 text-sm text-slate-500">本地原型案例可能已被删除，或来自另一台设备。</p>
          <Link href="/" className="mt-5 inline-flex rounded bg-slate-950 px-4 py-2 text-sm text-white">返回案例库</Link>
        </div>
      </main>
    );
  }

  const tocItems = [{ id: "cover", title: "封面" }, ...chapters.map(({ id, title }) => ({ id, title }))];
  const readerStyle = {
    "--reader-font-size": `${fontSize}px`,
    "--reader-page-width": `${pageWidth}px`,
    "--reader-page-gap": `${pageGap}px`,
  } as CSSProperties;
  const turnFrontPageIndex = pageTurn
    ? pageTurn.direction === "next"
      ? Math.min(pageCount - 1, pageTurn.fromPage - 1 + pagesPerSpread - 1)
      : Math.max(0, pageTurn.fromPage - 1)
    : 0;
  const turnBackPageIndex = pageTurn
    ? pageTurn.direction === "next"
      ? Math.max(0, pageTurn.toPage - 1)
      : Math.min(pageCount - 1, pageTurn.toPage - 1 + pagesPerSpread - 1)
    : 0;

  return (
    <main
      className={`case-reader theme-${theme} flow-${flow} mode-${detailMode} ${mobileChromeVisible ? "mobile-chrome-visible" : "mobile-chrome-hidden"}`}
      style={readerStyle}
    >
      <div className="reader-progress-track" aria-hidden>
        <div style={{ width: `${progress}%` }} />
      </div>

      <header className="reader-topbar">
        <div className="reader-topbar-left">
          <Link href="/" className="reader-icon-button" aria-label="返回案例库">←</Link>
          <div className="reader-mini-title">
            <span>{item.category}</span>
            <strong>{item.title}</strong>
          </div>
        </div>
        <div className="reader-mode-switch" aria-label="详情显示模式">
          <button className={detailMode === "read" ? "active" : ""} onClick={() => setDetailMode("read")}>阅读</button>
          <button className={detailMode === "research" ? "active" : ""} onClick={() => setDetailMode("research")}>研读</button>
        </div>
        <div className="reader-topbar-actions">
          <Link href="/assets" className="reader-text-button admin-link">案例资产</Link>
        </div>
      </header>

      {detailMode === "read" && (
        <>
          <aside className={`reader-toc ${tocOpen ? "open" : ""}`}>
            <div className="reader-toc-heading">
              <div>
                <span>CONTENTS</span>
                <strong>目录</strong>
              </div>
              <button onClick={() => setTocOpen(false)} aria-label="关闭目录">×</button>
            </div>
            <nav>
              {tocItems.map((entry, index) => (
                <button
                  key={entry.id}
                  className={activeAnchor === entry.id ? "active" : ""}
                  onClick={() => goToAnchor(entry.id)}
                >
                  <span>{String(index).padStart(2, "0")}</span>
                  {entry.title}
                </button>
              ))}
            </nav>
          </aside>

          {tocOpen && <button className="reader-scrim" aria-label="关闭目录" onClick={() => setTocOpen(false)} />}

          {settingsOpen && (
            <section className="reader-settings" aria-label="阅读设置">
              <div>
                <span>阅读方式</span>
                <div className="reader-setting-options">
                  <button className={flow === "scroll" ? "active" : ""} onClick={() => switchFlow("scroll")}>上下滚动</button>
                  <button className={flow === "paged" ? "active" : ""} onClick={() => switchFlow("paged")}>沉浸翻书</button>
                </div>
              </div>
              <div>
                <span>字号</span>
                <div className="reader-font-control">
                  <button onClick={() => setFontSize((value) => Math.max(15, value - 1))} aria-label="减小字号">A−</button>
                  <span>{fontSize}</span>
                  <button onClick={() => setFontSize((value) => Math.min(23, value + 1))} aria-label="增大字号">A＋</button>
                </div>
              </div>
              <div>
                <span>背景</span>
                <div className="reader-theme-options">
                  {([
                    ["paper", "暖白"],
                    ["white", "纯白"],
                    ["night", "夜间"],
                  ] as [ReadingTheme, string][]).map(([value, label]) => (
                    <button
                      key={value}
                      className={`${value} ${theme === value ? "active" : ""}`}
                      onClick={() => setTheme(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </section>
          )}

          <nav className="reader-desktop-tools" aria-label="桌面阅读工具">
            <button onClick={() => setTocOpen(true)} aria-label="打开目录">
              <span>☰</span><small>目录</small>
            </button>
            <button onClick={() => setSettingsOpen((value) => !value)} aria-label="打开排版设置">
              <span className="reader-aa">Aa</span><small>排版</small>
            </button>
            <button onClick={() => switchFlow(flow === "scroll" ? "paged" : "scroll")} aria-label="切换阅读方式">
              <span>{flow === "scroll" ? "↔" : "↕"}</span><small>{flow === "scroll" ? "翻页" : "滚动"}</small>
            </button>
            <button onClick={() => { setDetailMode("research"); setMobileChromeVisible(true); }} aria-label="进入研读模式">
              <span>⌕</span><small>研读</small>
            </button>
          </nav>

          {flow === "scroll" ? (
            <article className="reader-scroll-document" onClick={handleReaderSurfaceClick}>
              <ReaderContent item={item} chapters={chapters} />
            </article>
          ) : (
            <div className="reader-paged-shell">
              <button className="reader-page-arrow previous" onClick={() => turnPage("previous")} disabled={currentPage <= 1 || Boolean(pageTurn)} aria-label="上一页">‹</button>
              <div
                className="reader-paged-viewport"
                ref={pagedViewportRef}
                onScroll={handlePagedScroll}
                onClick={handleReaderSurfaceClick}
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerUp}
              >
                <article className="reader-paged-flow" ref={pagedFlowRef}>
                  <ReaderContent item={item} chapters={chapters} />
                </article>
              </div>
              {pageTurn && (
                <div
                  className={`reader-page-turn-stage direction-${pageTurn.direction} ${pagesPerSpread === 1 ? "single-page" : "double-page"}`}
                  aria-hidden="true"
                >
                  <div className="reader-turning-sheet">
                    <div className="reader-turn-face reader-turn-front">
                      <div className="reader-turn-face-content">
                        <article
                          className="reader-paged-flow reader-paged-flow-clone"
                          style={{ transform: `translate3d(-${turnFrontPageIndex * (pageWidth + pageGap)}px, 0, 0)` }}
                        >
                          <ReaderContent item={item} chapters={chapters} clone />
                        </article>
                      </div>
                      <span className="reader-turn-edge" />
                    </div>
                    <div className="reader-turn-face reader-turn-back">
                      <div className="reader-turn-face-content">
                        <article
                          className="reader-paged-flow reader-paged-flow-clone"
                          style={{ transform: `translate3d(-${turnBackPageIndex * (pageWidth + pageGap)}px, 0, 0)` }}
                        >
                          <ReaderContent item={item} chapters={chapters} clone />
                        </article>
                      </div>
                      <span className="reader-turn-edge" />
                    </div>
                  </div>
                </div>
              )}
              <button className="reader-page-arrow next" onClick={() => turnPage("next")} disabled={currentPage + pagesPerSpread > pageCount || Boolean(pageTurn)} aria-label="下一页">›</button>
            </div>
          )}

          <footer className="reader-statusbar">
            <span>{chapters.find((chapter) => chapter.id === activeAnchor)?.title || "封面"}</span>
            <span>
              {flow === "paged"
                ? pagesPerSpread === 2 && currentPage < pageCount
                  ? `${currentPage}—${Math.min(currentPage + 1, pageCount)} / ${pageCount} 页`
                  : `${currentPage} / ${pageCount} 页`
                : `已读 ${Math.round(progress)}%`}
            </span>
          </footer>

          <nav className="reader-mobile-toolbar" aria-label="移动端阅读工具">
            <button onClick={() => setTocOpen(true)}><span>☰</span>目录</button>
            <button onClick={() => setSettingsOpen((value) => !value)}><span>Aa</span>排版</button>
            <button onClick={() => switchFlow(flow === "scroll" ? "paged" : "scroll")}><span>{flow === "scroll" ? "↔" : "↕"}</span>{flow === "scroll" ? "翻页" : "滚动"}</button>
            <button onClick={() => { setDetailMode("research"); setMobileChromeVisible(true); }}><span>⌕</span>研读</button>
            <Link href="/assets"><span>＋</span>案例资产</Link>
          </nav>

          {flow === "paged" && (
            <div className="reader-mobile-page-number" aria-live="polite">
              {currentPage} / {pageCount}
            </div>
          )}
        </>
      )}

      {detailMode === "research" && (
        <div className="research-page">
          <ResearchView item={item} />
        </div>
      )}
    </main>
  );
}
