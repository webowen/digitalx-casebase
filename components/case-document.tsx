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

export function CaseDocument({
  item,
  onClose,
}: {
  item: SmartCityCase;
  onClose: () => void;
}) {
  const document = useMemo(() => buildCaseDocument(item), [item]);
  const heroMedia = document.sections.flatMap((section) => section.media)[0];
  const readingMinutes = Math.max(3, Math.ceil(document.totalCharacters / 460));

  return (
    <article
      className="case-document"
      aria-label={`${document.title}案例文档`}
      data-content-protocol={
        document.usesNativeContentModel ? "native-seven-part" : "legacy-compatible"
      }
    >
      <header className="case-document-toolbar">
        <div className="min-w-0">
          <span>CASE DOCUMENT</span>
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
            <span>
              {item.province} · {item.city}
            </span>
            <span>{item.year}</span>
            {item.contentMigration?.benchmark && <em>V1.5 标杆样稿</em>}
          </div>
          <h1>{document.title}</h1>
          <p className="case-document-standfirst">{document.standfirst}</p>
          <dl className="case-document-facts">
            <div>
              <dt>建设主体</dt>
              <dd>{item.owner || "待核验"}</dd>
            </div>
            <div>
              <dt>项目阶段</dt>
              <dd>{item.projectStage || "待核验"}</dd>
            </div>
            <div>
              <dt>阅读信息</dt>
              <dd>
                约 {readingMinutes} 分钟 · 证据{item.evidenceLevel}
              </dd>
            </div>
          </dl>
          {document.keyFindings.length > 0 && (
            <div className="case-document-findings">
              <h2>案例要点</h2>
              <ol>
                {document.keyFindings.map((finding, index) => (
                  <li key={`${index}-${finding}`}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <p>{finding}</p>
                  </li>
                ))}
              </ol>
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
            key={section.id}
          >
            <div className="case-document-section-heading">
              <span>第 {String(index + 1).padStart(2, "0")} 部分</span>
              <h2>{section.title}</h2>
            </div>
            {section.summary && (
              <p className="case-document-section-lead">{section.summary}</p>
            )}
            <div className="case-document-prose">
              {section.paragraphs.map((paragraph, paragraphIndex) => (
                <p key={`${section.id}-paragraph-${paragraphIndex}`}>
                  {paragraph}
                </p>
              ))}
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
              .map((media) => (
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
                    <strong>{mediaLabels[media.kind]}</strong>
                    {media.caption}
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
          <p>
            本文由 Digital X 内容模型整理，事实性表述仍以原始材料及人工复核结果为准。
          </p>
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
