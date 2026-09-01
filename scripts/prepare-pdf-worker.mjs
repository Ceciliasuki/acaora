import { copyFile, mkdir, stat } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const defaultSource = fileURLToPath(new URL("../node_modules/pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url));
const defaultOutput = fileURLToPath(new URL("../public/pdf.worker.min.mjs", import.meta.url));

export async function preparePdfWorker({ sourcePath = defaultSource, outputPath = defaultOutput } = {}) {
  const source = await stat(sourcePath);
  if (!source.isFile() || source.size === 0) {
    throw new Error(`PDF_WORKER_INVALID: ${sourcePath}`);
  }

  await mkdir(dirname(outputPath), { recursive: true });
  await copyFile(sourcePath, outputPath);
  const output = await stat(outputPath);
  if (output.size !== source.size) {
    throw new Error(`PDF_WORKER_COPY_INCOMPLETE: expected ${source.size} bytes, wrote ${output.size}`);
  }

  return { sourcePath, outputPath, bytes: output.size };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const result = await preparePdfWorker();
  process.stdout.write(`Prepared PDF.js worker (${result.bytes} bytes)\n`);
}
