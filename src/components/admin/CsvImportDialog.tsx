import { useState, useCallback, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, CheckCircle2, XCircle, AlertTriangle, Loader2, Download } from "lucide-react";

export interface CsvColumn {
  key: string;
  label: string;
  required?: boolean;
  validate?: (value: string) => string | null; // returns error message or null
  transform?: (value: string) => any;
}

export interface CsvImportResult {
  success: number;
  errors: Array<{ row: number; field: string; message: string }>;
  skipped: number;
  skippedNames?: string[];
}

interface CsvImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  columns: CsvColumn[];
  onImport: (rows: Record<string, any>[]) => Promise<CsvImportResult>;
  templateFileName?: string;
}

type Step = "upload" | "preview" | "importing" | "result";

interface ParsedRow {
  data: Record<string, string>;
  errors: Array<{ field: string; message: string }>;
  rowIndex: number;
}

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (inQuotes) {
        if (char === '"' && line[i + 1] === '"') {
          current += '"';
          i++;
        } else if (char === '"') {
          inQuotes = false;
        } else {
          current += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === "," || char === ";") {
          result.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine);
  return { headers, rows };
}

function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

export default function CsvImportDialog({
  open,
  onOpenChange,
  title,
  columns,
  onImport,
  templateFileName = "template.csv",
}: CsvImportDialogProps) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [headerMap, setHeaderMap] = useState<Record<string, string>>({});
  const [result, setResult] = useState<CsvImportResult | null>(null);

  const reset = useCallback(() => {
    setStep("upload");
    setParsedRows([]);
    setHeaderMap({});
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  }, []);

  const handleClose = (val: boolean) => {
    if (!val) reset();
    onOpenChange(val);
  };

  const downloadTemplate = () => {
    const header = columns.map((c) => c.key).join(",");
    const blob = new Blob([header + "\n"], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = templateFileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { headers, rows } = parseCSV(text);

      // Map CSV headers to column keys
      const map: Record<string, string> = {};
      headers.forEach((h, i) => {
        const normalized = normalizeHeader(h);
        const match = columns.find(
          (c) =>
            normalizeHeader(c.key) === normalized ||
            normalizeHeader(c.label) === normalized
        );
        if (match) map[String(i)] = match.key;
      });
      setHeaderMap(map);

      // Parse and validate rows
      const parsed: ParsedRow[] = rows.map((row, ri) => {
        const data: Record<string, string> = {};
        headers.forEach((_, i) => {
          const colKey = map[String(i)];
          if (colKey) data[colKey] = row[i] ?? "";
        });

        const errors: Array<{ field: string; message: string }> = [];
        columns.forEach((col) => {
          const val = data[col.key] ?? "";
          if (col.required && !val.trim()) {
            errors.push({ field: col.key, message: `${col.label} é obrigatório` });
          }
          if (val.trim() && col.validate) {
            const err = col.validate(val.trim());
            if (err) errors.push({ field: col.key, message: err });
          }
        });

        return { data, errors, rowIndex: ri + 2 }; // +2 for 1-indexed + header
      });

      setParsedRows(parsed);
      setStep("preview");
    };
    reader.readAsText(file);
  };

  const validRows = parsedRows.filter((r) => r.errors.length === 0);
  const errorRows = parsedRows.filter((r) => r.errors.length > 0);

  const handleImport = async () => {
    if (validRows.length === 0) return;
    setStep("importing");

    const transformed = validRows.map((r) => {
      const out: Record<string, any> = {};
      columns.forEach((col) => {
        const val = r.data[col.key] ?? "";
        out[col.key] = col.transform ? col.transform(val) : val.trim() || null;
      });
      return out;
    });

    try {
      const res = await onImport(transformed);
      setResult(res);
      setStep("result");
    } catch (err: any) {
      toast({ title: "Erro na importação", description: err.message, variant: "destructive" });
      setStep("preview");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            {title}
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="flex flex-col items-center gap-6 py-8">
            <div className="border-2 border-dashed border-border rounded-lg p-10 text-center w-full">
              <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground mb-4">
                Arraste um arquivo CSV ou clique para selecionar
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.txt"
                onChange={handleFile}
                className="hidden"
              />
              <Button variant="outline" onClick={() => fileRef.current?.click()}>
                Selecionar Arquivo
              </Button>
            </div>
            <Button variant="ghost" size="sm" onClick={downloadTemplate} className="gap-2">
              <Download className="h-4 w-4" />
              Baixar template CSV
            </Button>
            <div className="text-xs text-muted-foreground">
              <p className="font-medium mb-1">Colunas esperadas:</p>
              <div className="flex flex-wrap gap-1">
                {columns.map((c) => (
                  <Badge key={c.key} variant={c.required ? "default" : "outline"} className="text-xs">
                    {c.key}{c.required ? " *" : ""}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="flex flex-col gap-4 min-h-0 flex-1">
            <div className="flex items-center gap-3 text-sm">
              <Badge variant="default" className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                {validRows.length} válidas
              </Badge>
              {errorRows.length > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <XCircle className="h-3 w-3" />
                  {errorRows.length} com erros
                </Badge>
              )}
              <span className="text-muted-foreground">
                Total: {parsedRows.length} linhas
              </span>
            </div>

            <ScrollArea className="flex-1 border rounded-lg max-h-[400px]">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">#</th>
                      {columns.slice(0, 6).map((c) => (
                        <th key={c.key} className="px-3 py-2 text-left font-medium">{c.label}</th>
                      ))}
                      <th className="px-3 py-2 text-left font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {parsedRows.slice(0, 100).map((row, i) => (
                      <tr key={i} className={row.errors.length > 0 ? "bg-destructive/5" : ""}>
                        <td className="px-3 py-2 text-muted-foreground">{row.rowIndex}</td>
                        {columns.slice(0, 6).map((c) => (
                          <td key={c.key} className="px-3 py-2 max-w-[150px] truncate">
                            {row.data[c.key] || <span className="text-muted-foreground/50">—</span>}
                          </td>
                        ))}
                        <td className="px-3 py-2">
                          {row.errors.length > 0 ? (
                            <span className="text-destructive text-xs" title={row.errors.map(e => e.message).join(", ")}>
                              <AlertTriangle className="h-3 w-3 inline mr-1" />
                              {row.errors[0].message}
                            </span>
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedRows.length > 100 && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  Mostrando 100 de {parsedRows.length} linhas
                </p>
              )}
            </ScrollArea>

            {errorRows.length > 0 && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs">
                <p className="font-medium text-destructive mb-1">
                  Erros encontrados ({errorRows.length} linhas):
                </p>
                <ul className="list-disc pl-4 space-y-0.5 max-h-24 overflow-y-auto">
                  {errorRows.slice(0, 20).map((r, i) => (
                    <li key={i} className="text-destructive/80">
                      Linha {r.rowIndex}: {r.errors.map((e) => e.message).join("; ")}
                    </li>
                  ))}
                  {errorRows.length > 20 && (
                    <li className="text-muted-foreground">...e mais {errorRows.length - 20} erros</li>
                  )}
                </ul>
              </div>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={reset}>Voltar</Button>
              <Button onClick={handleImport} disabled={validRows.length === 0} className="gap-2">
                Importar {validRows.length} linha{validRows.length !== 1 ? "s" : ""}
              </Button>
            </div>
          </div>
        )}

        {step === "importing" && (
          <div className="flex flex-col items-center gap-4 py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Importando dados...</p>
          </div>
        )}

        {step === "result" && result && (
          <div className="flex flex-col gap-4 py-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
              <div>
                <p className="font-semibold text-foreground">Importação concluída</p>
                <p className="text-sm text-muted-foreground">
                  {result.success} inserido{result.success !== 1 ? "s" : ""} com sucesso
                  {result.skipped > 0 && `, ${result.skipped} atualizado${result.skipped !== 1 ? "s" : ""} (já existiam)`}
                </p>
                {result.skippedNames && result.skippedNames.length > 0 && (
                  <div className="mt-2 rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3 text-xs">
                    <p className="font-medium text-yellow-700 mb-1">Vinhos atualizados (já existiam):</p>
                    <ul className="list-disc pl-4 space-y-0.5 max-h-24 overflow-y-auto">
                      {result.skippedNames.map((name, i) => (
                        <li key={i} className="text-yellow-600">{name}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs">
                <p className="font-medium text-destructive mb-1">
                  {result.errors.length} erro{result.errors.length !== 1 ? "s" : ""} durante importação:
                </p>
                <ul className="list-disc pl-4 space-y-0.5 max-h-32 overflow-y-auto">
                  {result.errors.map((e, i) => (
                    <li key={i} className="text-destructive/80">
                      Linha {e.row}: {e.field} — {e.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button onClick={() => handleClose(false)}>Fechar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
