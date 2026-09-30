/**
 * Reconstructs an approximate table (rows of cell strings) from a PDF's
 * text layer. PDFs have no real concept of "rows and columns" — this
 * works by clustering text fragments that share roughly the same
 * vertical position into a line, then splitting that line into cells
 * wherever there's an unusually large horizontal gap between fragments
 * (the same visual cue a person uses to read a table). It only works on
 * PDFs with an actual text layer (exported from Excel/Word/a web page,
 * not a scanned or photographed page — those have no text to read at
 * all, which would need OCR, a different problem entirely).
 */

import type { TextItem } from "pdfjs-dist/types/src/display/api";

interface TextFragment {
  str: string;
  x: number;
  y: number;
  width: number;
}

const LINE_Y_TOLERANCE = 3;
const COLUMN_GAP_THRESHOLD = 10;

function groupIntoLines(fragments: TextFragment[]): TextFragment[][] {
  const sorted = [...fragments].sort((a, b) => b.y - a.y);
  const lines: TextFragment[][] = [];

  for (const fragment of sorted) {
    const line = lines.find((l) => Math.abs(l[0].y - fragment.y) < LINE_Y_TOLERANCE);
    if (line) line.push(fragment);
    else lines.push([fragment]);
  }

  for (const line of lines) line.sort((a, b) => a.x - b.x);
  return lines;
}

function lineToCells(line: TextFragment[]): string[] {
  const cells: string[] = [];
  let current = "";
  let lastEndX: number | null = null;

  for (const fragment of line) {
    if (lastEndX !== null && fragment.x - lastEndX > COLUMN_GAP_THRESHOLD) {
      cells.push(current.trim());
      current = "";
    }
    current += (current ? " " : "") + fragment.str;
    lastEndX = fragment.x + fragment.width;
  }
  if (current) cells.push(current.trim());
  return cells.filter((c) => c !== "");
}

export async function extractGridFromPdf(file: File): Promise<string[][]> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

  const grid: string[][] = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();

    // getTextContent() returns a union of TextItem | TextMarkedContent —
    // only TextItem actually carries position data, so narrow on
    // `transform` (unique to TextItem) rather than `str` (which
    // TypeScript can't use to fully exclude TextMarkedContent here).
    const fragments: TextFragment[] = content.items
      .filter((item): item is TextItem => "transform" in item && item.str.trim() !== "")
      .map((item) => ({
        str: item.str,
        x: item.transform[4],
        y: item.transform[5],
        width: item.width,
      }));

    if (fragments.length === 0) continue;

    const lines = groupIntoLines(fragments);
    for (const line of lines) {
      const cells = lineToCells(line);
      if (cells.length > 0) grid.push(cells);
    }
  }

  return grid;
}
