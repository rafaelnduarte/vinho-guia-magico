/**
 * Export data as a CSV file that Excel can open natively (with BOM for UTF-8).
 */
export function exportToCsv(filename: string, headers: string[], rows: string[][]) {
  const BOM = "\uFEFF";
  const escape = (v: string) => {
    if (v.includes(",") || v.includes('"') || v.includes("\n")) {
      return `"${v.replace(/"/g, '""')}"`;
    }
    return v;
  };
  const csv =
    BOM +
    [headers.map(escape).join(";"), ...rows.map((r) => r.map(escape).join(";"))].join("\r\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
