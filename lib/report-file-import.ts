"use client";

import JSZip from "jszip";
import type { CaseArticleSectionId, CaseMediaKind } from "./case-model";
import type { ImportedReportMedia } from "./report-import";

export type ParsedReportFile = {
  text: string;
  media: ImportedReportMedia[];
  fileName: string;
  imageCount: number;
  warnings: string[];
};

const imageExtensions = new Set(["jpg", "jpeg", "png", "webp", "gif"]);

function extensionOf(path: string) {
  return path.split(".").pop()?.toLowerCase() || "";
}

function mimeFromPath(path: string) {
  const extension = extensionOf(path);
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  if (extension === "gif") return "image/gif";
  return "image/jpeg";
}

function normalizeZipPath(path: string) {
  return path
    .replace(/^\.?\//, "")
    .replace(/\\/g, "/")
    .replace(/%20/g, " ")
    .trim();
}

function dirname(path: string) {
  const normalized = normalizeZipPath(path);
  const index = normalized.lastIndexOf("/");
  return index >= 0 ? normalized.slice(0, index + 1) : "";
}

function resolveRelativePath(baseFile: string, ref: string) {
  const cleanRef = normalizeZipPath(ref.replace(/^["']|["']$/g, "").split(/[?#]/)[0]);
  if (!cleanRef || cleanRef.startsWith("data:") || /^https?:\/\//i.test(cleanRef)) return cleanRef;
  if (cleanRef.startsWith("/")) return cleanRef.slice(1);
  const parts = `${dirname(baseFile)}${cleanRef}`.split("/");
  const stack: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") stack.pop();
    else stack.push(part);
  }
  return stack.join("/");
}

function textFromXmlElement(element: Element) {
  return Array.from(element.getElementsByTagName("w:t"))
    .map((node) => node.textContent || "")
    .join("");
}

function headingLevelFromParagraph(element: Element) {
  const style = element.getElementsByTagName("w:pStyle")[0]?.getAttribute("w:val") || "";
  if (/Heading1|标题1|1$/.test(style)) return 1;
  if (/Heading2|标题2|2$/.test(style)) return 2;
  if (/Heading3|标题3|3$/.test(style)) return 3;
  if (/Title|标题$/.test(style)) return 1;
  return 0;
}

function docPrText(element: Element) {
  const node = element.getElementsByTagName("wp:docPr")[0];
  return node?.getAttribute("descr") || node?.getAttribute("title") || node?.getAttribute("name") || "";
}

async function zipFileToDataUrl(file: JSZip.JSZipObject, sourcePath: string) {
  const base64 = await file.async("base64");
  return `data:${mimeFromPath(sourcePath)};base64,${base64}`;
}

function inferSectionFromMarkdown(markdown: string, offset: number): CaseArticleSectionId {
  const before = markdown.slice(0, offset);
  const headings = Array.from(before.matchAll(/^#{1,3}\s+(.+)$/gm));
  const title = headings.at(-1)?.[1] || "";
  if (/背景|痛点|问题|为什么/.test(title)) return "background";
  if (/目标|任务|原则/.test(title)) return "objectives";
  if (/架构|建设|方案|技术|如何/.test(title)) return "architecture";
  if (/功能|场景|能力|模块|应用/.test(title)) return "capabilities";
  if (/实施|运营|机制|组织|保障/.test(title)) return "delivery";
  if (/投资|资金|预算|成本/.test(title)) return "investment";
  if (/成效|价值|成果|效益/.test(title)) return "outcomes";
  if (/边界|问题|不足|风险|挑战/.test(title)) return "boundaries";
  if (/经验|启示|推广|复制/.test(title)) return "lessons";
  if (/时间|历程|节点|进度/.test(title)) return "timeline";
  return "overview";
}

function inferMediaKind(value: string): CaseMediaKind {
  if (/驾驶舱|大屏|态势|看板|总览|监测/.test(value)) return "dashboard";
  if (/界面|平台|系统|页面/.test(value)) return "platform_ui";
  if (/架构|流程|体系|方案/.test(value)) return "architecture";
  if (/地图|空间|区位|位置/.test(value)) return "map";
  if (/场馆|建筑|现场|照片|实景|空间/.test(value)) return "site_photo";
  return "other";
}

async function parseMarkdownZip(file: File, zip: JSZip): Promise<ParsedReportFile> {
  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  const markdownEntry = entries.find((entry) => /\.(md|markdown)$/i.test(entry.name));
  if (!markdownEntry) {
    throw new Error("ZIP 中没有找到 Markdown 文件。请上传包含 .md 和 media/ 图片目录的压缩包。");
  }

  let markdown = await markdownEntry.async("text");
  const media: ImportedReportMedia[] = [];
  const warnings: string[] = [];
  const imagePattern = /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>|!\[([^\]]*)]\(([^)]+)\)/gi;
  const matches = Array.from(markdown.matchAll(imagePattern));

  for (const [index, match] of matches.entries()) {
    const rawSrc = match[1] || match[3] || "";
    const alt = match[2] || match[0].match(/\balt=["']([^"']+)["']/i)?.[1] || "";
    const resolved = resolveRelativePath(markdownEntry.name, rawSrc);
    const entry = zip.file(resolved) || zip.file(normalizeZipPath(rawSrc));
    if (!entry) {
      warnings.push(`未找到图片：${rawSrc}`);
      continue;
    }
    const url = await zipFileToDataUrl(entry, resolved);
    const id = `imported-image-${index + 1}`;
    const caption = alt || entry.name.split("/").pop() || `导入图片 ${index + 1}`;
    media.push({
      id,
      url,
      sourceUrl: entry.name,
      caption,
      alt: caption,
      sectionId: inferSectionFromMarkdown(markdown, match.index || 0),
      kind: inferMediaKind(`${caption} ${entry.name}`),
    });
    markdown = markdown.replace(rawSrc, url);
  }

  return {
    text: markdown,
    media,
    fileName: file.name,
    imageCount: media.length,
    warnings,
  };
}

async function parseDocx(file: File, zip: JSZip): Promise<ParsedReportFile> {
  const parser = new DOMParser();
  const documentXml = await zip.file("word/document.xml")?.async("text");
  const relsXml = await zip.file("word/_rels/document.xml.rels")?.async("text");
  if (!documentXml || !relsXml) {
    throw new Error("无法识别 DOCX 正文结构。请确认文件不是加密或损坏的 Word 文档。");
  }

  const relsDoc = parser.parseFromString(relsXml, "application/xml");
  const rels = new Map<string, string>();
  Array.from(relsDoc.getElementsByTagName("Relationship")).forEach((node) => {
    const id = node.getAttribute("Id");
    const target = node.getAttribute("Target");
    if (id && target) rels.set(id, normalizeZipPath(`word/${target}`));
  });

  const doc = parser.parseFromString(documentXml, "application/xml");
  const body = doc.getElementsByTagName("w:body")[0];
  const lines: string[] = [];
  const media: ImportedReportMedia[] = [];
  const warnings: string[] = [];

  for (const child of Array.from(body?.children || [])) {
    if (child.tagName === "w:p") {
      const text = textFromXmlElement(child).trim();
      const blips = Array.from(child.getElementsByTagName("a:blip"));
      for (const blip of blips) {
        const relId = blip.getAttribute("r:embed");
        const target = relId ? rels.get(relId) : "";
        const entry = target ? zip.file(target) : null;
        if (!entry || !target) {
          warnings.push(`未能读取 Word 图片关系：${relId || "unknown"}`);
          continue;
        }
        const url = await zipFileToDataUrl(entry, target);
        const id = `imported-image-${media.length + 1}`;
        const alt = docPrText(child) || text || entry.name.split("/").pop() || `导入图片 ${media.length + 1}`;
        const sectionId = inferSectionFromMarkdown(lines.join("\n"), lines.join("\n").length);
        media.push({
          id,
          url,
          sourceUrl: target,
          caption: alt,
          alt,
          sectionId,
          kind: inferMediaKind(`${alt} ${target}`),
        });
        lines.push(`![${alt}](${url})`);
        lines.push("");
      }
      if (text) {
        const level = headingLevelFromParagraph(child);
        lines.push(level ? `${"#".repeat(Math.min(level, 3))} ${text}` : text);
        lines.push("");
      }
    }

    if (child.tagName === "w:tbl") {
      const rows = Array.from(child.getElementsByTagName("w:tr"))
        .map((row) =>
          Array.from(row.getElementsByTagName("w:tc"))
            .map((cell) => textFromXmlElement(cell).trim().replace(/\|/g, "｜"))
            .filter(Boolean),
        )
        .filter((row) => row.length > 0);
      if (rows.length > 0) {
        lines.push(`| ${rows[0].join(" | ")} |`);
        lines.push(`| ${rows[0].map(() => "---").join(" | ")} |`);
        rows.slice(1).forEach((row) => lines.push(`| ${row.join(" | ")} |`));
        lines.push("");
      }
    }
  }

  return {
    text: lines.join("\n").trim(),
    media,
    fileName: file.name,
    imageCount: media.length,
    warnings,
  };
}

export async function parseReportFile(file: File): Promise<ParsedReportFile> {
  const extension = extensionOf(file.name);
  if (extension === "md" || extension === "markdown" || file.type === "text/markdown") {
    return {
      text: await file.text(),
      media: [],
      fileName: file.name,
      imageCount: 0,
      warnings: ["单独 Markdown 文件不包含图片目录；如需保留图片，请上传 Markdown+media 的 ZIP 包。"],
    };
  }

  if (extension !== "docx" && extension !== "zip") {
    throw new Error("当前仅支持 .docx、.zip 或 .md 文件。");
  }

  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  if (extension === "docx") return parseDocx(file, zip);

  const hasDocx = Object.keys(zip.files).some((name) => name === "word/document.xml");
  if (hasDocx) return parseDocx(file, zip);

  const hasImages = Object.keys(zip.files).some((name) => imageExtensions.has(extensionOf(name)));
  if (!hasImages) {
    throw new Error("ZIP 中没有找到图片文件。请上传包含 Markdown 和 media 图片目录的压缩包。");
  }
  return parseMarkdownZip(file, zip);
}
