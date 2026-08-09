"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import { buildCaseDocument } from "@/lib/case-document";
import type { CaseMediaAsset, SmartCityCase } from "@/lib/case-model";

const mediaLabels: Record<CaseMediaAsset["kind"], string> = {
  platform_ui: "平台界面",
  dashboard: "驾驶舱 / 大屏",
  architecture: "架构与流程",
  map: "空间地图",
  site_photo: "现场照片",
  document: "原始资料",
  other: "案例图片",
};

function MarkdownTable({ value }: { value: string }) {
  const rows = value.split("\n").map((line) => line.trim()).filter((line) => /^\|.*\|$/.test(line));
  if (rows.length < 2 || !/^\|(?:\s*:?-{3,}:?\s*\|)+$/.test(rows[1])) return <p>{value}</p>;
  const cells = (row: string) => row.slice(1, -1).split("|").map((cell) => cell.trim());
  return (
    <div className="case-document-table-wrap">
      <table className="case-document-table">
        <thead><tr>{cells(rows[0]).map((header, index) => <th key={`${index}-${header}`}>{header}</th>)}</tr></thead>
        <tbody>{rows.slice(2).map((row, rowIndex) => <tr key={rowIndex}>{cells(row).map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

export function CaseDocument({
  item,
  onClose,
}: {
  item: SmartCityCase;
  onClose: () => void;
}) {
  const document = useMemo(() => buildCaseDocument(item), [item]);
  const heroMedia = document.sections.flatMap((section) => section.media)[0];
  const location = [item.province, item.city, item.district].filter(Boolean).join(" · ");
  const visibleTags = item.aiTags.filter((tag) => tag !== item.category).slice(0, 5);

  return (
    <article
      className="case-document"
      aria-label={`${document.title}案例文档`}
      data-content-protocol={
        document.preservesSourceStructure ? "source-preserved" : "editorial"
      }
    >
      <header className="case-document-toolbar">
        <div className="min-w-0">
          <span>案例阅读</span>
          <strong>{document.title}</strong>
        </div>
        <div className="case-document-toolbar-actions">
          <Link href={`/cases/${item.slug}`} target="_blank">
            沉浸阅读
          </Link>
          <button type="button" onClick={onClose} aria-label="关闭案例文档">
            ×
          </button>
        </div>
      </header>

      <div className="case-document-body">
        <section className="case-document-cover">
          <div className="case-document-kicker">
            <span>{item.category}</span>
            <span>{location}</span>
            <span>{item.sourceTitle ? "报告导入" : item.year}</span>
          </div>
          <h1>{document.title}</h1>
          <p className="case-document-standfirst">{document.standfirst}</p>
          {visibleTags.length > 0 && (
            <div className="case-document-tags" aria-label="核心标签">
              {visibleTags.map((tag) => <span key={tag}>{tag}</span>)}
            </div>
          )}
          {document.keyFindings.length > 0 && (
            <div className="case-document-findings">
              <h2>案例速览</h2>
              <ul>
                {document.keyFindings.map((finding, index) => (
                  <li key={`${index}-${finding}`}>
                    <p>{finding}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {heroMedia && (
            <figure className="case-document-figure case-document-hero">
              <Image
                src={heroMedia.url}
                alt={heroMedia.alt}
                width={1200}
                height={720}
                sizes="(max-width: 900px) 100vw, 760px"
                unoptimized
              />
              <figcaption>
                <strong>{mediaLabels[heroMedia.kind]}</strong>
                {heroMedia.caption}
              </figcaption>
            </figure>
          )}
        </section>

        {document.sections.map((section, index) => (
          <section
            id={`document-${section.id}`}
            className="case-document-section"
            key={`${section.id}-${index}`}
          >
            <div className="case-document-section-heading">
              {!document.preservesSourceStructure && <span>第 {String(index + 1).padStart(2, "0")} 部分</span>}
              <h2>{section.title}</h2>
            </div>
            {section.summary && (
              <p className="case-document-section-lead">{section.summary}</p>
            )}
            <div className="case-document-prose">
              {section.paragraphs.map((paragraph, paragraphIndex) =>
                /^\s*\|.+\|\s*$/m.test(paragraph)
                  ? <MarkdownTable key={`${section.id}-table-${paragraphIndex}`} value={paragraph} />
                  : <p key={`${section.id}-paragraph-${paragraphIndex}`}>{paragraph}</p>
              )}
            </div>
            {section.points.length > 0 && (
              <ul className="case-document-points">
                {section.points.map((point, pointIndex) => (
                  <li key={`${section.id}-point-${pointIndex}`}>
                    <span>{String(pointIndex + 1).padStart(2, "0")}</span>
                    <p>{point}</p>
                  </li>
                ))}
              </ul>
            )}
            {section.scenarios.length > 0 && (
              <div className="case-document-scenarios">
                {section.scenarios.map((scenario, scenarioIndex) => (
                  <section key={scenario.id}>
                    <span>场景 {String(scenarioIndex + 1).padStart(2, "0")}</span>
                    <h3>{scenario.name}</h3>
                    <dl>
                      {[
                        ["业务问题", scenario.problem],
                        ["输入数据", scenario.dataInputs.join("、")],
                        ["系统动作", scenario.systemActions.join("、")],
                        ["业务动作", scenario.businessActions.join("、")],
                        ["形成结果", scenario.result],
                      ]
                        .filter((entry) => entry[1])
                        .map(([label, value]) => (
                          <div key={label}>
                            <dt>{label}</dt>
                            <dd>{value}</dd>
                          </div>
                        ))}
                    </dl>
                  </section>
                ))}
              </div>
            )}
            {section.media
              .filter((media) => media.id !== heroMedia?.id)
              .map((media, mediaIndex) => (
                <figure className="case-document-figure" key={media.id}>
                  <Image
                    src={media.url}
                    alt={media.alt}
                    width={1200}
                    height={720}
                    sizes="(max-width: 900px) 100vw, 760px"
                    unoptimized
                  />
                  <figcaption>
                    <strong>图 {mediaIndex + 1}</strong>
                    {media.caption || mediaLabels[media.kind]}
                  </figcaption>
                </figure>
              ))}
            {!section.summary &&
              section.paragraphs.length === 0 &&
              section.points.length === 0 &&
              section.scenarios.length === 0 && (
                <p className="case-document-pending">
                  当前证据尚不足以形成可靠正文，本部分留待补充资料与人工复核。
                </p>
              )}
          </section>
        ))}

        <footer className="case-document-sources">
          <div>
            <span>资料与边界</span>
            <h2>来源说明</h2>
          </div>
          <p>案例内容以原始材料为基础整理，项目信息以来源文件为准。</p>
          {document.sources.length > 0 && (
            <ol>
              {document.sources.map((source, index) => (
                <li key={`${source.url}-${index}`}>
                  {source.url ? (
                    <a href={source.url} target="_blank" rel="noreferrer">
                      {source.title || source.url}
                    </a>
                  ) : (
                    source.title
                  )}
                </li>
              ))}
            </ol>
          )}
        </footer>
      </div>
    </article>
  );
}
