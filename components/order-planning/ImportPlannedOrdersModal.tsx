"use client";

import { useRef, useState } from "react";
import type { DragEvent } from "react";
import { FileWarning, Upload, X } from "lucide-react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import { buildPlannedOrdersFromRows, normalizeHeader, type ImportRowResult } from "@/lib/order-import";
import { extractGridFromPdf } from "@/lib/pdf-text";
import type { PlannedOrder } from "@/types";

/** A minimal CSV line splitter that still handles quoted commas — good
 * enough for a spreadsheet export, without pulling in a new dependency. */
function parseCsv(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "")
    .map((line) => {
      const cells: string[] = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          cells.push(current);
          current = "";
        } else {
          current += char;
        }
      }
      cells.push(current);
      return cells.map((c) => c.trim());
    });
}

/**
 * Builds row objects two ways at once: `values` (matched by recognized
 * header, when there is one) and `rawCells` (every cell, unconditionally)
 * — buildPlannedOrdersFromRows falls back to scanning rawCells for a
 * container-code- or date-shaped value when a row has no usable header
 * match, which is what makes an unstructured PDF-extracted grid or an
 * unexpectedly-labeled spreadsheet still importable.
 */
function rowsFromGrid(
  grid: (string | undefined)[][]
): { rowNumber: number; values: Record<string, unknown>; rawCells: unknown[] }[] {
  if (grid.length === 0) return [];
  const headerMap = grid[0].map((h) => normalizeHeader(String(h ?? "")));
  const hasAnyHeaderMatch = headerMap.some((f) => f !== undefined);

  // No row looked like a header at all (typical for a PDF table with no
  // clear label row) — treat every row as data, not just rows after the
  // first, so nothing real gets mistaken for a header and discarded.
  const dataRows = hasAnyHeaderMatch ? grid.slice(1) : grid;
  const rowOffset = hasAnyHeaderMatch ? 2 : 1;

  return dataRows.map((row, i) => {
    const values: Record<string, unknown> = {};
    if (hasAnyHeaderMatch) {
      headerMap.forEach((field, colIndex) => {
        if (field) values[field] = row[colIndex];
      });
    }
    return { rowNumber: i + rowOffset, values, rawCells: row };
  });
}

export function ImportPlannedOrdersModal({
  onImport,
}: {
  onImport: (orders: PlannedOrder[]) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [results, setResults] = useState<ImportRowResult[] | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setFileName(null);
    setResults(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleFile(file: File) {
    setError(null);
    setResults(null);
    setFileName(file.name);
    setParsing(true);

    try {
      const name = file.name.toLowerCase();
      let grid: (string | undefined)[][];

      if (name.endsWith(".csv")) {
        const text = await file.text();
        grid = parseCsv(text);
      } else if (name.endsWith(".pdf")) {
        grid = await extractGridFromPdf(file);
        if (grid.length === 0) {
          setError(
            "Couldn't find any text in that PDF — it may be a scanned image rather than an exported document, which this can't read."
          );
          setParsing(false);
          return;
        }
      } else {
        const ExcelJS = (await import("exceljs")).default;
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(await file.arrayBuffer());
        const sheet = workbook.worksheets[0];
        if (!sheet) throw new Error("The file has no worksheets.");

        grid = [];
        sheet.eachRow((row) => {
          const cells: (string | undefined)[] = [];
          row.eachCell({ includeEmpty: true }, (cell) => {
            const v = cell.value;
            cells.push(v instanceof Date ? v.toISOString() : v == null ? undefined : String(v));
          });
          grid.push(cells);
        });
      }

      const rows = rowsFromGrid(grid);
      if (rows.length === 0) {
        setError("No data found in that file.");
        setParsing(false);
        return;
      }

      setResults(buildPlannedOrdersFromRows(rows));
    } catch {
      setError("Couldn't read that file — make sure it's a valid .xlsx, .csv, or .pdf.");
    }
    setParsing(false);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  async function handleConfirmImport() {
    if (!results) return;
    const validOrders = results.filter((r): r is ImportRowResult & { order: PlannedOrder } => !!r.order);
    if (validOrders.length === 0) return;

    setImporting(true);
    setError(null);

    if (isSupabaseConfigured && supabase) {
      const { data: inserted, error: insertError } = await supabase
        .from("planned_orders")
        .insert(
          validOrders.map(({ order }) => ({
            company: order.company,
            frequency: order.frequency,
            custom_interval_days: order.customIntervalDays ?? null,
            anchor_date: order.anchorDate,
            lead_time_days: order.leadTimeDays,
            notes: order.notes ?? null,
            active: true,
            container_number: order.containerNumber ?? null,
            container_size: order.containerSize ?? null,
            imported_mombasa_eta: order.importedMombasaEta ?? null,
            imported_store_date: order.importedStoreDate ?? null,
            imported_actual: order.importedActual ?? null,
          }))
        )
        .select();

      setImporting(false);
      if (insertError) {
        setError(insertError.message);
        return;
      }
      onImport(
        (inserted ?? []).map((row, i) => ({ ...validOrders[i].order, id: row.id as string }))
      );
    } else {
      setImporting(false);
      onImport(validOrders.map((r) => r.order));
    }

    reset();
  }

  const errorRows = results?.filter((r) => r.error) ?? [];
  const validCount = results ? results.length - errorRows.length : 0;

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <h2 className="text-[15px] font-semibold text-text-primary">Upload your order plan</h2>
      <p className="mt-1 text-[12.5px] text-text-secondary">
        Drop an .xlsx, .csv, or .pdf file with your order planning details —
        whatever columns or layout it already has. Company is detected from
        the container code automatically. A PDF needs to be an exported
        document, not a scanned image, since a scan has no text to read.
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv,.pdf"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
        className="hidden"
        id="order-plan-import-file"
      />
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`mt-4 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors ${
          dragging ? "border-accent bg-accent-soft" : "border-border-strong"
        }`}
      >
        <Upload className="mx-auto h-6 w-6 text-text-tertiary" />
        <p className="mt-2 text-sm text-text-secondary">
          Drag a file here, or{" "}
          <label
            htmlFor="order-plan-import-file"
            className="cursor-pointer font-medium text-accent hover:underline"
          >
            browse to upload
          </label>
        </p>
        {fileName && <p className="mt-2 text-xs text-text-tertiary">{fileName}</p>}
      </div>

      {parsing && <p className="mt-3 text-[13px] text-text-tertiary">Reading file…</p>}
      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-danger/20 bg-danger-soft px-3 py-2.5 text-xs text-danger">
          <FileWarning className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      {results && !parsing && (
        <div className="mt-4 space-y-3">
          <p className="text-[12.5px] text-text-secondary">
            <span className="font-medium text-success">{validCount} ready to import</span>
            {errorRows.length > 0 && (
              <span className="text-danger"> · {errorRows.length} skipped</span>
            )}
          </p>
          {errorRows.length > 0 && (
            <div className="max-h-32 overflow-y-auto rounded-lg border border-border p-2.5 text-xs text-text-tertiary">
              {errorRows.map((r) => (
                <div key={r.rowNumber}>
                  Row {r.rowNumber}: {r.error}
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={validCount === 0 || importing}
              className="rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
            >
              {importing ? "Importing…" : `Import ${validCount || ""} order${validCount === 1 ? "" : "s"}`}
            </button>
            <button
              type="button"
              onClick={reset}
              className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm font-medium text-text-secondary hover:bg-page"
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
