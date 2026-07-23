"use client";

import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  LoaderCircle,
  UploadCloud,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrencyFromCents } from "@/lib/formatters";
import type { PortfolioImportRow } from "@/types/investment";

interface ImportPreview {
  filename: string;
  checksum: string;
  fileContent: string;
  rows: PortfolioImportRow[];
  fileErrors: string[];
  summary: {
    totalRows: number;
    validRows: number;
    duplicateRows: number;
    invalidRows: number;
  };
}

export function CsvImporter() {
  const fileInputReference = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ImportPreview>();
  const [previewLoading, setPreviewLoading] = useState(false);
  const [confirmationLoading, setConfirmationLoading] = useState(false);

  async function createPreview(file: File) {
    setPreviewLoading(true);
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch("/api/portfolio/import/preview", {
      method: "POST",
      body: formData,
    });
    const responseBody = await response.json();
    setPreviewLoading(false);

    if (!response.ok) {
      toast.error(responseBody.message ?? "Não foi possível ler o arquivo.");
      return;
    }

    setPreview(responseBody);
  }

  async function confirmImport() {
    if (!preview) {
      return;
    }

    setConfirmationLoading(true);
    const response = await fetch("/api/portfolio/import/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: preview.filename,
        checksum: preview.checksum,
        fileContent: preview.fileContent,
      }),
    });
    const responseBody = await response.json();
    setConfirmationLoading(false);

    if (!response.ok) {
      toast.error(responseBody.message ?? "A importação falhou.");
      return;
    }

    toast.success(
      `${responseBody.importedCount} linhas importadas; ${responseBody.duplicateCount} duplicadas ignoradas.`,
    );
    setPreview(undefined);
    if (fileInputReference.current) {
      fileInputReference.current.value = "";
    }
  }

  const confirmationBlocked =
    !preview ||
    preview.fileErrors.length > 0 ||
    preview.summary.invalidRows > 0 ||
    preview.summary.validRows === 0;

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>1. Selecione seu CSV</CardTitle>
          <CardDescription>
            UTF-8, separado por ponto e vírgula e com até 2 MB
          </CardDescription>
        </CardHeader>
        <CardContent>
          <label
            htmlFor="portfolio-file"
            className="flex cursor-pointer flex-col items-center rounded-xl border border-dashed bg-muted/25 px-6 py-10 text-center transition-colors hover:border-primary/50 hover:bg-primary/[0.03]"
          >
            {previewLoading ? (
              <LoaderCircle className="size-8 animate-spin text-primary" />
            ) : (
              <UploadCloud className="size-8 text-primary" />
            )}
            <span className="mt-3 text-sm font-medium">
              Clique para selecionar o arquivo
            </span>
            <span className="mt-1 text-xs text-muted-foreground">
              Nenhum dado é salvo antes da confirmação
            </span>
          </label>
          <input
            ref={fileInputReference}
            id="portfolio-file"
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(event) => {
              const selectedFile = event.target.files?.[0];
              if (selectedFile) {
                void createPreview(selectedFile);
              }
            }}
          />
          <Button variant="link" className="mt-2 px-0" asChild>
            <a href="/modelo-movimentacoes.csv" download>
              <Download aria-hidden="true" />
              Baixar modelo CSV
            </a>
          </Button>
        </CardContent>
      </Card>

      {preview ? (
        <Card>
          <CardHeader className="flex-row items-start justify-between">
            <div>
              <CardTitle>2. Confira a prévia</CardTitle>
              <CardDescription>{preview.filename}</CardDescription>
            </div>
            <FileSpreadsheet className="size-5 text-primary" aria-hidden="true" />
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <SummaryCell label="Linhas" value={preview.summary.totalRows} />
              <SummaryCell label="Válidas" value={preview.summary.validRows} positive />
              <SummaryCell label="Duplicadas" value={preview.summary.duplicateRows} />
              <SummaryCell
                label="Com erro"
                value={preview.summary.invalidRows}
                negative={preview.summary.invalidRows > 0}
              />
            </div>

            {preview.fileErrors.length > 0 ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                {preview.fileErrors.map((fileError) => (
                  <p key={fileError} className="text-xs text-destructive">
                    {fileError}
                  </p>
                ))}
              </div>
            ) : null}

            <div className="max-h-[420px] overflow-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Linha</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Ticker</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.rows.map((previewRow) => {
                    const transaction = previewRow.transaction;
                    const displayValueCents = transaction
                      ? transaction.type === "COMPRA" ||
                        transaction.type === "VENDA"
                        ? transaction.quantity * transaction.unitPriceCents
                        : transaction.valueCents
                      : 0;
                    return (
                      <TableRow key={previewRow.rowNumber}>
                        <TableCell className="numeric">{previewRow.rowNumber}</TableCell>
                        <TableCell>
                          {previewRow.errors.length > 0 ? (
                            <span
                              className="flex items-center gap-1 text-xs text-destructive"
                              title={previewRow.errors.join(" ")}
                            >
                              <XCircle className="size-3.5" />
                              Erro
                            </span>
                          ) : previewRow.duplicate ? (
                            <Badge variant="outline">Duplicada</Badge>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-primary">
                              <CheckCircle2 className="size-3.5" />
                              Válida
                            </span>
                          )}
                        </TableCell>
                        <TableCell>{transaction?.type ?? "—"}</TableCell>
                        <TableCell className="font-medium">
                          {transaction?.ticker ?? "—"}
                        </TableCell>
                        <TableCell className="numeric text-xs">
                          {transaction?.operationDate ?? "—"}
                        </TableCell>
                        <TableCell className="numeric text-right">
                          {transaction
                            ? formatCurrencyFromCents(displayValueCents)
                            : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" asChild>
                <Link href="/carteira">Cancelar</Link>
              </Button>
              <Button
                disabled={confirmationBlocked || confirmationLoading}
                onClick={confirmImport}
              >
                {confirmationLoading ? (
                  <LoaderCircle className="animate-spin" />
                ) : (
                  <CheckCircle2 />
                )}
                Confirmar importação
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function SummaryCell({
  label,
  value,
  positive = false,
  negative = false,
}: {
  label: string;
  value: number;
  positive?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`numeric mt-1 text-lg font-semibold ${
          positive ? "text-primary" : negative ? "text-destructive" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}
