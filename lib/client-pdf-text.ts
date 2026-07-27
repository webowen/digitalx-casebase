"use client";

const MIN_USEFUL_PDF_CHARACTERS = 160;

export type PdfTextResult = {
  text: string;
  pageCount: number;
  characterCount: number;
  needsOcr: boolean;
};

export async function extractPdfText(file: File): Promise<PdfTextResult> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const data = new Uint8Array(await file.arrayBuffer());
  const document = await pdfjs.getDocument({ data }).promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (pageText) pages.push(`第${pageNumber}页\n${pageText}`);
  }

  const text = pages.join("\n\n").trim();
  return {
    text,
    pageCount: document.numPages,
    characterCount: text.length,
    needsOcr: text.length < MIN_USEFUL_PDF_CHARACTERS,
  };
}
