"use client";

import Link from "next/link";
import {
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { categoryColors, type SmartCityCase } from "@/lib/case-model";
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
};

type ReaderPreference = {
  flow: ReadingFlow;
  theme: ReadingTheme;
  fontSize: number;
  anchor?: string;
  progress?: number;
};

const PAGE_GAP_DESKTOP = 76;
const PAGE_GAP_TABLET = 28;

function preferenceKey(slug: string) {
  return `digitalx-reader-${slug}`;
}

function makeChapters(item?: SmartCityCase): ReaderChapter[] {
  if (!item) return [];

  const implementation = [
    item.projectStage ? `项目目前处于${item.projectStage}阶段。` : "",
    item.investmentAmount ? `公开信息显示，项目投资为${item.investmentAmount}。` : "",
    item.fundingSource ? `资金来源为${item.fundingSource}。` : "",
    item.implementationUnit ? `实施单位为${item.implementationUnit}。` : "",
    item.operationUnit ? `运营单位为${item.operationUnit}。` : "",
  ].filter(Boolean);

  return [
    {
      id: "abstract",
      eyebrow: "导读",
      title: "案例摘要",
      paragraphs: [item.summary],
      note: `这是一个${item.coverageType}案例，空间层级为${item.locationLevel}。当前收录证据等级为“${item.evidenceLevel}”，建议结合文末来源判断信息可靠性。`,
    },
    {
      id: "background",
      eyebrow: "第一部分",
      title: "项目为什么提出",
      paragraphs: [
        `${item.city}${item.district ? `·${item.district}` : ""}在推进${item.category}建设过程中，项目首先需要回应以下现实问题。`,
      ],
      points: item.painPoints,
    },
    {
      id: "solution",
      eyebrow: "第二部分",
      title: "具体建设了什么",
      paragraphs: [
        "从现有资料看，项目没有停留在单一展示界面，而是围绕业务对象、数据能力和协同流程组织建设内容。",
      ],
      points: item.solution,
    },
    {
      id: "implementation",
      eyebrow: "第三部分",
      title: "项目如何投资、建设与运营",
      paragraphs:
        implementation.length > 0
          ? implementation
          : [
              `项目建设主体为${item.owner}。当前公开材料尚未完整披露投资、实施与运营信息，正式研判时需要继续补充招标、中标、合同或验收资料。`,
            ],
      note: `地图位置采用${item.locationLevel}定位，位置置信度为 ${Math.round(item.locationConfidence * 100)}%。`,
    },
    {
      id: "outcomes",
      eyebrow: "第四部分",
      title: "项目取得了什么成效",
      paragraphs: [
        "案例材料归纳出以下阶段性成效。正式引用时仍应关注指标口径、统计周期以及是否来自第三方验收。",
      ],
      points: item.outcomes,
    },
    {
      id: "judgement",
      eyebrow: "第五部分",
      title: "真正值得借鉴的地方",
      paragraphs: [item.expertView],
      note: "本部分属于案例库研判，不等同于项目建设单位或原始来源的公开结论。",
    },
    {
      id: "sources",
      eyebrow: "附录",
      title: "证据、来源与阅读说明",
      paragraphs: [
        item.sourceNote,
        item.sourceExcerpt ? `原文摘录：${item.sourceExcerpt}` : "",
      ].filter(Boolean),
      note: `来源类型：${item.sourceType}｜证据等级：${item.evidenceLevel}｜入库状态：${item.status}`,
    },
  ];
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
  ].filter(([, value]) => value);

  return (
    <div className="research-sheet">
      <section>
        <p className="research-kicker">案例档案</p>
        <h1>{item.title}</h1>
        <p className="research-summary">{item.summary}</p>
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
}: {
  item: SmartCityCase;
  chapters: ReaderChapter[];
}) {
  return (
    <>
      <section className="reader-cover" id="cover" data-reader-anchor>
        <div className="reader-cover-series">{item.category} · 城市数智案例</div>
        <div className="reader-cover-rule" />
        <div className="reader-cover-meta">
          <span style={{ color: categoryColors[item.category] }}>{item.category}</span>
          <span>{item.city}</span>
          <span>{item.year}</span>
        </div>
        <h1>{item.title}</h1>
        <p className="reader-deck">{item.summary}</p>
        <div className="reader-cover-footer">
          <span>DigitalX 城市数智应用案例库</span>
          <span>预计阅读 8 分钟</span>
        </div>
      </section>

      {chapters.map((chapter) => (
        <section
          className="reader-section"
          id={chapter.id}
          data-reader-anchor
          key={chapter.id}
        >
          <p className="reader-eyebrow">{chapter.eyebrow}</p>
          <h2>{chapter.title}</h2>
          {chapter.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          {chapter.points && (
            <ol className="reader-numbered-list">
              {chapter.points.map((point, index) => (
                <li key={point}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <p>{point}</p>
                </li>
              ))}
            </ol>
          )}
          {chapter.id === "sources" && item.sourceUrl && (
            <a className="reader-source-link" href={item.sourceUrl} target="_blank" rel="noreferrer">
              查看原始资料 ↗
            </a>
          )}
          {chapter.note && <aside className="reader-note">{chapter.note}</aside>}
        </section>
      ))}
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
  const [flow, setFlow] = useState<ReadingFlow>("scroll");
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
  const [mobileChromeVisible, setMobileChromeVisible] = useState(false);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const pagedViewportRef = useRef<HTMLDivElement>(null);
  const pagedFlowRef = useRef<HTMLDivElement>(null);
  const restoredRef = useRef(false);
  const chapters = useMemo(() => makeChapters(item), [item]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (!initialItem) {
        setItem(getLocalCases().find((current) => current.slug === slug && current.status === "已发布"));
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

  const goToPage = useCallback((page: number) => {
    const viewport = pagedViewportRef.current;
    if (!viewport) return;
    const target = Math.min(pageCount, Math.max(1, page));
    const spreadStart = Math.floor((target - 1) / pagesPerSpread) * pagesPerSpread;
    viewport.scrollTo({
      left: spreadStart * (pageWidth + pageGap),
      behavior: "smooth",
    });
  }, [pageCount, pageGap, pageWidth, pagesPerSpread]);

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
    setFlow(next);
    setSettingsOpen(false);
    restoredRef.current = false;
  }

  function handleReaderSurfaceClick(event: ReactMouseEvent<HTMLElement>) {
    if (window.innerWidth >= 768) return;
    const target = event.target as HTMLElement;
    if (target.closest("a, button, input, select, textarea")) return;

    if (flow === "paged") {
      const ratio = event.clientX / window.innerWidth;
      if (ratio < 0.22) {
        goToPage(currentPage - 1);
        return;
      }
      if (ratio > 0.78) {
        goToPage(currentPage + 1);
        return;
      }
    }
    setMobileChromeVisible((value) => !value);
  }

  useEffect(() => {
    if (detailMode !== "read" || flow !== "paged") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") goToPage(currentPage - 1);
      if (event.key === "ArrowRight") goToPage(currentPage + 1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [currentPage, detailMode, flow, goToPage]);

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
          <Link href="/admin" className="reader-text-button admin-link">管理端</Link>
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
                  <button className={flow === "paged" ? "active" : ""} onClick={() => switchFlow("paged")}>左右翻页</button>
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
              <button className="reader-page-arrow previous" onClick={() => goToPage(currentPage - pagesPerSpread)} disabled={currentPage <= 1} aria-label="上一页">‹</button>
              <div
                className="reader-paged-viewport"
                ref={pagedViewportRef}
                onScroll={handlePagedScroll}
                onClick={handleReaderSurfaceClick}
              >
                <article className="reader-paged-flow" ref={pagedFlowRef}>
                  <ReaderContent item={item} chapters={chapters} />
                </article>
              </div>
              <button className="reader-page-arrow next" onClick={() => goToPage(currentPage + pagesPerSpread)} disabled={currentPage + pagesPerSpread > pageCount} aria-label="下一页">›</button>
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
            <Link href="/admin"><span>＋</span>上传</Link>
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
