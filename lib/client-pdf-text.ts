"use client";

import type { CaseMediaCandidate } from "./case-model";

const MIN_USEFUL_PDF_CHARACTERS = 160;
const MAX_MEDIA_CANDIDATES = 8;

export type PdfMediaCandidate = CaseMediaCandidate & {
  blob: Blob;
  width: number;
  height: number;
};

export type PdfContentResult = {
  text: string;
  pageCount: number;
  characterCount: number;
  needsOcr: boolean;
  mediaCandidates: PdfMediaCandidate[];
};

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("PDF页面图片生成失败。"))),
      "image/jpeg",
      0.82,
    );
  });
}

function visualDensity(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return 0;
  const { width, height } = canvas;
  const step = Math.max(8, Math.floor(Math.min(width, height) / 70));
  const pixels = context.getImageData(0, 0, width, height).data;
  let samples = 0;
  let nonWhite = 0;
  let chromatic = 0;
  let dark = 0;

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const offset = (y * width + x) * 4;
      const red = pixels[offset];
      const green = pixels[offset + 1];
      const blue = pixels[offset + 2];
      const average = (red + green + blue) / 3;
      samples += 1;
      if (average < 242) nonWhite += 1;
      if (Math.max(red, green, blue) - Math.min(red, green, blue) > 20) chromatic += 1;
      if (average < 90) dark += 1;
    }
  }

  if (samples === 0) return 0;
  return Number(
    (
      (nonWhite / samples) * 0.42 +
      (chromatic / samples) * 0.46 +
      (dark / samples) * 0.12
    ).toFixed(3),
  );
}

export async function extractPdfContent(file: File): Promise<PdfContentResult> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const data = new Uint8Array(await file.arrayBuffer());
  const document = await pdfjs.getDocument({ data }).promise;
  const pages: string[] = [];
  const mediaCandidates: PdfMediaCandidate[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (pageText) pages.push(`第${pageNumber}页\n${pageText}`);

    const naturalViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(1.6, 1200 / Math.max(1, naturalViewport.width));
    const viewport = page.getViewport({ scale });
    const canvas = window.document.createElement("canvas");
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) continue;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    const score = visualDensity(canvas);
    const hasVisualKeyword =
      /平台|系统|驾驶舱|大屏|架构|流程|界面|地图|模型|BIM|CIM|孪生|现场|效果图/i.test(
        pageText,
      );
    if (score >= 0.11 || hasVisualKeyword) {
      mediaCandidates.push({
        id: `pdf-page-${pageNumber}`,
        sourceKind: "pdf_page",
        pageNumber,
        sourceUrl: "",
        nearbyText: pageText.slice(0, 520),
        visualScore: score,
        blob: await canvasToBlob(canvas),
        width: canvas.width,
        height: canvas.height,
      });
    }
  }

  const text = pages.join("\n\n").trim();
  const selectedMedia = mediaCandidates
    .sort((left, right) => right.visualScore - left.visualScore)
    .slice(0, MAX_MEDIA_CANDIDATES)
    .sort((left, right) => left.pageNumber - right.pageNumber);
  return {
    text,
    pageCount: document.numPages,
    characterCount: text.length,
    needsOcr: text.length < MIN_USEFUL_PDF_CHARACTERS,
    mediaCandidates: selectedMedia,
  };
}
