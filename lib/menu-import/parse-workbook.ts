import * as XLSX from "xlsx";
import type { DetectedSheet, ParsedWorkbook } from "./types";
import { sanitizeCellText } from "./normalize";

const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8 MB
const MAX_ROWS_PER_SHEET = 5000;
const MAX_COLS = 40;
const SAMPLE_ROWS = 8;

const ALLOWED_MIME = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "application/csv",
  "text/plain",
  "application/octet-stream",
]);

export function assertSafeUpload(fileName: string, mimeType: string, size: number) {
  if (size <= 0) throw new Error("The uploaded file is empty.");
  if (size > MAX_FILE_BYTES) throw new Error("File is too large. Maximum size is 8 MB.");
  const lower = fileName.toLowerCase();
  if (!lower.endsWith(".xlsx") && !lower.endsWith(".xls") && !lower.endsWith(".csv")) {
    throw new Error("Only .xlsx, .xls, or .csv files are supported.");
  }
  if (mimeType && !ALLOWED_MIME.has(mimeType) && !mimeType.startsWith("text/")) {
    // Some browsers send empty or odd MIME types — extension check above is authoritative.
    if (mimeType.includes("javascript") || mimeType.includes("html")) {
      throw new Error("This file type is not allowed.");
    }
  }
}

function gridFromSheet(sheet: XLSX.WorkSheet): string[][] {
  const rows = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
    header: 1,
    raw: false, // prefer formatted display values; never execute formulas
    defval: "",
    blankrows: false,
  });
  return rows
    .slice(0, MAX_ROWS_PER_SHEET)
    .map((row) => {
      const cells = Array.isArray(row) ? row : [];
      return Array.from({ length: Math.min(MAX_COLS, Math.max(cells.length, 1)) }, (_, index) =>
        sanitizeCellText(cells[index]),
      );
    })
    .filter((row) => row.some((cell) => cell.trim().length > 0));
}

function detectHeaderRow(grid: string[][]): number {
  // Prefer the first non-empty row that looks like headers (mostly text, few numbers).
  for (let i = 0; i < Math.min(grid.length, 10); i += 1) {
    const row = grid[i] ?? [];
    const nonEmpty = row.filter((cell) => cell.trim());
    if (nonEmpty.length < 2) continue;
    const numeric = nonEmpty.filter((cell) => /^-?\d+(?:\.\d+)?$/.test(cell.replace(/,/g, ""))).length;
    if (numeric / nonEmpty.length <= 0.4) return i;
  }
  return 0;
}

export function parseWorkbookBuffer(buffer: Buffer): ParsedWorkbook {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellFormula: false,
    cellHTML: false,
    cellStyles: false,
    sheetStubs: false,
  });

  const sheets: DetectedSheet[] = [];
  const grids: Record<string, string[][]> = {};

  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    if (!sheet) continue;
    const rawGrid = gridFromSheet(sheet);
    if (!rawGrid.length) continue;
    const headerIndex = detectHeaderRow(rawGrid);
    const headers = (rawGrid[headerIndex] ?? []).map((cell, index) => cell.trim() || `Column ${index + 1}`);
    const body = rawGrid.slice(headerIndex);
    // Keep header as first row in stored grid for remapping.
    grids[name] = body;
    sheets.push({
      name,
      rowCount: Math.max(0, body.length - 1),
      headers,
      sampleRows: body.slice(1, 1 + SAMPLE_ROWS),
    });
  }

  if (!sheets.length) throw new Error("No readable sheets with data were found in this file.");
  return { sheets, grids };
}
