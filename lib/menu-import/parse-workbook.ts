import type { DetectedSheet, ParsedWorkbook } from "./types";
import { sanitizeCellText } from "./normalize";
import { parseCsvGrid, readXlsxSheets } from "@/lib/spreadsheet";

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
  if (!lower.endsWith(".xlsx") && !lower.endsWith(".csv")) {
    throw new Error("Only .xlsx or .csv files are supported.");
  }
  if (mimeType && !ALLOWED_MIME.has(mimeType) && !mimeType.startsWith("text/")) {
    if (mimeType.includes("javascript") || mimeType.includes("html")) {
      throw new Error("This file type is not allowed.");
    }
  }
}

function limitGrid(rows: string[][]): string[][] {
  return rows
    .slice(0, MAX_ROWS_PER_SHEET)
    .map((row) =>
      Array.from({ length: Math.min(MAX_COLS, Math.max(row.length, 1)) }, (_, index) =>
        sanitizeCellText(row[index] ?? ""),
      ),
    )
    .filter((row) => row.some((cell) => cell.trim().length > 0));
}

function detectHeaderRow(grid: string[][]): number {
  for (let i = 0; i < Math.min(grid.length, 10); i += 1) {
    const row = grid[i] ?? [];
    const nonEmpty = row.filter((cell) => cell.trim());
    if (nonEmpty.length < 2) continue;
    const numeric = nonEmpty.filter((cell) => /^-?\d+(?:\.\d+)?$/.test(cell.replace(/,/g, ""))).length;
    if (numeric / nonEmpty.length <= 0.4) return i;
  }
  return 0;
}

function workbookFromGrids(named: Array<{ name: string; rows: string[][] }>): ParsedWorkbook {
  const sheets: DetectedSheet[] = [];
  const grids: Record<string, string[][]> = {};
  for (const entry of named) {
    const rawGrid = limitGrid(entry.rows);
    if (!rawGrid.length) continue;
    const headerIndex = detectHeaderRow(rawGrid);
    const headers = (rawGrid[headerIndex] ?? []).map((cell, index) => cell.trim() || `Column ${index + 1}`);
    const body = rawGrid.slice(headerIndex);
    grids[entry.name] = body;
    sheets.push({
      name: entry.name,
      rowCount: Math.max(0, body.length - 1),
      headers,
      sampleRows: body.slice(1, 1 + SAMPLE_ROWS),
    });
  }
  if (!sheets.length) throw new Error("No readable sheets with data were found in this file.");
  return { sheets, grids };
}

export async function parseWorkbookBuffer(buffer: Buffer): Promise<ParsedWorkbook> {
  const zip = buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4b;
  if (!zip) {
    const text = buffer.toString("utf8");
    if (!text.includes(",") && !text.includes("\t")) {
      throw new Error("This workbook could not be read. Save it as .xlsx or .csv and try again.");
    }
    return workbookFromGrids([{ name: "Menu", rows: parseCsvGrid(text) }]);
  }
  const sheets = await readXlsxSheets(buffer);
  return workbookFromGrids(sheets);
}
