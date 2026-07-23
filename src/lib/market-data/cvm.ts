import { createHash } from "node:crypto";

import { unzipSync } from "fflate";
import iconv from "iconv-lite";
import Papa from "papaparse";

export interface CvmCsvArchive {
  checksum: string;
  files: Array<{
    filename: string;
    headers: string[];
    rows: Record<string, string>[];
  }>;
}

export function parseCvmCsv(
  csvContent: string,
): { headers: string[]; rows: Record<string, string>[] } {
  const parsedCsv = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    delimiter: ";",
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.trim(),
  });

  return {
    headers: parsedCsv.meta.fields ?? [],
    rows: parsedCsv.data,
  };
}

export function parseCvmZipArchive(archiveBytes: Uint8Array): CvmCsvArchive {
  const checksum = createHash("sha256").update(archiveBytes).digest("hex");
  const unzippedFiles = unzipSync(archiveBytes);
  const files = Object.entries(unzippedFiles)
    .filter(([filename]) => filename.toLowerCase().endsWith(".csv"))
    .map(([filename, fileBytes]) => {
      const decodedContent = iconv.decode(Buffer.from(fileBytes), "latin1");
      const parsedCsv = parseCvmCsv(decodedContent);
      return {
        filename,
        headers: parsedCsv.headers,
        rows: parsedCsv.rows,
      };
    });

  return { checksum, files };
}

export async function downloadCvmArchive(
  archiveUrl: string,
): Promise<CvmCsvArchive> {
  const response = await fetch(archiveUrl, {
    headers: { Accept: "application/zip, application/octet-stream" },
    cache: "no-store",
    signal: AbortSignal.timeout(45_000),
  });

  if (!response.ok) {
    throw new Error(`CVM respondeu com status ${response.status}.`);
  }

  return parseCvmZipArchive(new Uint8Array(await response.arrayBuffer()));
}
