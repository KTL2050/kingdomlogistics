"use client";

import { useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import { buildPlannedOrdersFromRows, normalizeHeader, type ImportRowResult } from "@/lib/order-import";
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

function rowsFromGrid(grid: (string | undefined)[][]): { rowNumber: number; values: Record<string, unknown> }[] {
  if (grid.length === 0) return [];
  const headerMap = grid[0].map((h) => normalizeHeader(String(h ?? "")));

  return grid.slice(1).map((row, i) => {
    const values: Record<string, unknown> = {};
    headerMap.forEach((field, colIndex) => {
      if (field) values[field] = row[colIndex];
    });
    return { rowNumber: i + 2, values }; // +2: 1-indexed, plus the header row
  });
}

export function ImportPlannedOrdersModal({
  open,
  onClose,
  onImport,
}: {
  open: boolean;
  onClose: () => void;
  onImport: (orders: PlannedOrder[]) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [results, setResults] = useState<ImportRowResult[] | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

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
      let grid: (string | undefined)[][];

      if (file.name.toLowerCase().endsWith(".csv")) {
        const text = await file.text();
        grid = parseCsv(text);
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
        setError("No data rows found — check the file has a header row plus at least one order.");
        setParsing(false);
        return;
      }

      setResults(buildPlannedOrdersFromRows(rows));
    } catch {
      setError("Couldn't read that file — make sure it's a valid .xlsx or .csv export.");
    }
    setParsing(false);
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
    onClose();
  }

  const errorRows = results?.filter((r) => r.error) ?? [];
  const validCount = results ? results.length - errorRows.length : 0;

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-lg rounded-xl border border-border bg-surface p-5 shadow-lg">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-text-primary">Import order plan</h2>
          <button
            onClick={() => {
              reset();
              onClose();
            }}
            aria-label="Close"
            className="flex h-7 w-7 items-center justify-center rounded-md text-text-tertiary hover:bg-page"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-[12.5px] text-text-secondary">
          An .xlsx or .csv file with columns: Container, Order Date, Order
          Cycle, Leadtime, Mombasa ETA, Store Date, Actual, Status. Company
          is detected from the container prefix automatically. One row
          becomes one order schedule — if your sheet has full history for
          the same container, you&apos;ll get one schedule per row rather
          than one merged schedule.
        </p>

        <div className="mt-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
            className="hidden"
            id="order-plan-import-file"
          />
          <label
            htmlFor="order-plan-import-file"
            className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border-strong px-4 py-6 text-sm text-text-secondary hover:bg-page"
          >
            <Upload className="h-4 w-4" />
            {fileName ?? "Choose a .xlsx or .csv file"}
          </label>
        </div>

        {parsing && <p className="mt-3 text-[13px] text-text-tertiary">Reading file…</p>}
        {error && <p className="mt-3 text-xs text-danger">{error}</p>}

        {results && !parsing && (
          <div className="mt-4 space-y-2">
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
          </div>
        )}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              reset();
              onClose();
            }}
            className="rounded-lg border border-border px-3.5 py-2 text-sm font-medium text-text-secondary hover:bg-page"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirmImport}
            disabled={!results || validCount === 0 || importing}
            className="rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
          >
            {importing ? "Importing…" : `Import ${validCount || ""} order${validCount === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
