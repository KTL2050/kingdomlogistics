"use client";

import { useState } from "react";
import { FileSpreadsheet, FileText } from "lucide-react";
import type { Shipment, KpiSummary } from "@/types";

export function ExportButtons({
  shipments,
  kpi,
  avgDelay,
  avgTransit,
}: {
  shipments: Shipment[];
  kpi: KpiSummary;
  avgDelay: number;
  avgTransit: number;
}) {
  const [exportingPdf, setExportingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function exportExcel() {
    setError(null);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();

      const headerFill: import("exceljs").Fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF2563EB" },
      };
      const thinBorder: Partial<import("exceljs").Borders> = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };

      // Same status colors used on the dashboard/charts, so the export
      // reads consistently with the rest of the app.
      const statusColors: Record<string, string> = {
        on_time: "FF17864F",
        delayed: "FFD0361C",
        not_started: "FFB6650A",
        completed: "FF2563EB",
      };
      const statusLabels: Record<string, string> = {
        on_time: "On Time",
        delayed: "Delayed",
        not_started: "Not Started",
        completed: "Completed",
      };

      const summarySheet = workbook.addWorksheet("Summary");
      summarySheet.columns = [
        { header: "Metric", key: "metric", width: 42 },
        { header: "Value", key: "value", width: 14 },
      ];
      summarySheet.addRows([
        { metric: "Total Shipments", value: kpi.total },
        {
          metric: "On-Time Rate (%)",
          value: kpi.total > 0 ? Math.round((kpi.onTime / kpi.total) * 100) : 0,
        },
        { metric: "Avg. Delay (days, delayed shipments only)", value: Number(avgDelay.toFixed(1)) },
        { metric: "Avg. Transit Time (days, ETD to final ETA)", value: Math.round(avgTransit) },
      ]);

      const shipmentsSheet = workbook.addWorksheet("Shipments");
      shipmentsSheet.columns = [
        { header: "Container", key: "container", width: 14 },
        { header: "Shipment #", key: "shipmentNumber", width: 16 },
        { header: "Customer", key: "customer", width: 20 },
        { header: "Origin", key: "origin", width: 14 },
        { header: "Destination", key: "destination", width: 14 },
        { header: "Shipping Line", key: "shippingLine", width: 26 },
        { header: "Status", key: "status", width: 15 },
        { header: "Current Stage", key: "currentStage", width: 20 },
        { header: "Delay (days)", key: "delayDays", width: 13 },
        { header: "ETD", key: "etd", width: 13 },
        { header: "Final ETA", key: "finalEta", width: 13 },
      ];

      shipments.forEach((s) => {
        shipmentsSheet.addRow({
          container: s.containerNumber,
          shipmentNumber: s.shipmentNumber,
          customer: s.customer,
          origin: s.origin,
          destination: s.destination,
          shippingLine: s.shippingLine,
          status: statusLabels[s.health] ?? s.health,
          currentStage: s.currentStatus,
          delayDays: s.delayDays,
          etd: s.etd,
          finalEta: s.finalEta,
        });
      });

      // Header row styling + borders on every used cell, for both sheets.
      [summarySheet, shipmentsSheet].forEach((sheet) => {
        const headerRow = sheet.getRow(1);
        headerRow.eachCell((cell) => {
          cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
          cell.fill = headerFill;
        });
        sheet.eachRow((row) => {
          row.eachCell((cell) => {
            cell.border = thinBorder;
          });
        });
      });

      // Color the Status column to match each shipment's health, same
      // as the colored badges shown throughout the app.
      const statusColIndex = shipmentsSheet.getColumn("status").number;
      shipmentsSheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const shipment = shipments[rowNumber - 2];
        const color = statusColors[shipment.health];
        if (!color) return;
        const cell = row.getCell(statusColIndex);
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: color } };
      });

      const dateLabel = new Date().toISOString().slice(0, 10);
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `shipment-report-${dateLabel}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Couldn't build the Excel file — try again.");
    }
  }

  async function exportPdf() {
    setError(null);
    setExportingPdf(true);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      const node = document.getElementById("reports-export-area");
      if (!node) {
        setError("Couldn't find the report content to export.");
        return;
      }

      const canvas = await html2canvas(node, { scale: 2, backgroundColor: "#ffffff" });
      const imgData = canvas.toDataURL("image/png");

      const pdf = new jsPDF({ orientation: "portrait", unit: "px", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 24;
      const imgWidth = pageWidth - margin * 2;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.setFontSize(13);
      pdf.text("Shipment Report", margin, margin);
      pdf.setFontSize(8);
      pdf.setTextColor(120);
      pdf.text(
        new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }),
        margin,
        margin + 12
      );

      // A tall screenshot gets split across pages by drawing the same
      // full image on each page, shifted up further each time — the
      // standard way to paginate a single long image in jsPDF.
      const contentStartY = margin + 24;
      let heightLeft = imgHeight;
      let position = contentStartY;

      pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight);
      heightLeft -= pageHeight - contentStartY;

      while (heightLeft > 0) {
        pdf.addPage();
        position = heightLeft - imgHeight;
        pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const dateLabel = new Date().toISOString().slice(0, 10);
      pdf.save(`shipment-report-${dateLabel}.pdf`);
    } catch {
      setError("Couldn't build the PDF — try again.");
    } finally {
      setExportingPdf(false);
    }
  }

  return (
    <div className="mb-4 flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-2">
        <button
          onClick={exportExcel}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-[13px] font-medium text-text-secondary hover:bg-page"
        >
          <FileSpreadsheet className="h-4 w-4" />
          Export Excel
        </button>
        <button
          onClick={exportPdf}
          disabled={exportingPdf}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-[13px] font-medium text-text-secondary hover:bg-page disabled:opacity-50"
        >
          <FileText className="h-4 w-4" />
          {exportingPdf ? "Generating…" : "Export PDF"}
        </button>
      </div>
      {error && <p className="text-[12px] text-danger">{error}</p>}
    </div>
  );
}