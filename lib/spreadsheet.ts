import ExcelJS from "exceljs";

/**
 * Workbook adapter. Replaces the unmaintained `xlsx` parser.
 * Formula cells are not evaluated; only a cached result is read, otherwise the cell is blank.
 */

export type SheetGrid = { name: string; rows: string[][] };

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text ?? "").join("");
    }
    if ("text" in value && typeof value.text === "string") return value.text;
    if ("result" in value && value.result != null && typeof value.result !== "object") {
      return cellText(value.result as ExcelJS.CellValue);
    }
    if ("formula" in value) return "";
  }
  return "";
}

export async function readXlsxSheets(buffer: Buffer): Promise<SheetGrid[]> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  } catch {
    throw new Error("This workbook could not be read. Save it as .xlsx and try again.");
  }
  const sheets: SheetGrid[] = [];
  workbook.eachSheet((sheet) => {
    const rows: string[][] = [];
    sheet.eachRow({ includeEmpty: false }, (row) => {
      const values = row.values;
      const cells = Array.isArray(values) ? values.slice(1) : [];
      rows.push(cells.map((value) => cellText(value as ExcelJS.CellValue)));
    });
    sheets.push({ name: sheet.name, rows });
  });
  return sheets;
}

export async function writeXlsxSheets(sheets: Array<{ name: string; rows: Array<Array<string | number>> }>): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  for (const spec of sheets) {
    const sheet = workbook.addWorksheet(spec.name.slice(0, 31) || "Sheet");
    for (const row of spec.rows) sheet.addRow(row);
  }
  const out = await workbook.xlsx.writeBuffer();
  return Buffer.from(out);
}

export function parseCsvGrid(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const source = text.replace(/^\uFEFF/, "");
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
      continue;
    }
    if (char === ",") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (char === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += char;
  }
  if (cell.length || row.length) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows.filter((entry) => entry.some((value) => value.trim().length > 0));
}

export function gridToCsv(rows: Array<Array<string | number>>): string {
  return rows
    .map((row) =>
      row
        .map((value) => {
          const text = String(value ?? "");
          return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
        })
        .join(","),
    )
    .join("\n");
}
