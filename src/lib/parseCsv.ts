export interface ParsedCsv {
  headers: string[];
  rows: string[][];
}

type CsvDelimiter = "," | ";";

function getFirstRecord(text: string): string {
  let record = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        record += '""';
        i++;
        continue;
      }

      inQuotes = !inQuotes;
      record += char;
      continue;
    }

    if (!inQuotes && (char === "\n" || char === "\r")) {
      break;
    }

    record += char;
  }

  return record;
}

function countDelimiterOccurrences(record: string, delimiter: CsvDelimiter): number {
  let count = 0;
  let inQuotes = false;

  for (let i = 0; i < record.length; i++) {
    const char = record[i];

    if (char === '"') {
      if (inQuotes && record[i + 1] === '"') {
        i++;
        continue;
      }

      inQuotes = !inQuotes;
      continue;
    }

    if (!inQuotes && char === delimiter) {
      count++;
    }
  }

  return count;
}

function detectDelimiter(text: string): CsvDelimiter {
  const firstRecord = getFirstRecord(text);
  const commaCount = countDelimiterOccurrences(firstRecord, ",");
  const semicolonCount = countDelimiterOccurrences(firstRecord, ";");

  return semicolonCount > commaCount ? ";" : ",";
}

export function parseCSV(text: string): ParsedCsv {
  const source = text.replace(/^\uFEFF/, "");

  if (!source.trim()) {
    return { headers: [], rows: [] };
  }

  const delimiter = detectDelimiter(source);
  const parsedRows: string[][] = [];
  let row: string[] = [];
  let current = "";
  let inQuotes = false;

  const pushCell = () => {
    row.push(current.trim());
    current = "";
  };

  const pushRow = () => {
    if (row.some((cell) => cell.length > 0)) {
      parsedRows.push(row);
    }
    row = [];
  };

  for (let i = 0; i < source.length; i++) {
    const char = source[i];

    if (char === '"') {
      if (inQuotes && source[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === delimiter) {
      pushCell();
      continue;
    }

    if (!inQuotes && (char === "\n" || char === "\r")) {
      pushCell();
      pushRow();

      if (char === "\r" && source[i + 1] === "\n") {
        i++;
      }
      continue;
    }

    current += char;
  }

  if (current.length > 0 || row.length > 0) {
    pushCell();
    pushRow();
  }

  const [headers = [], ...rows] = parsedRows;
  return { headers, rows };
}

export function normalizeCsvHeader(header: string): string {
  return header
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}