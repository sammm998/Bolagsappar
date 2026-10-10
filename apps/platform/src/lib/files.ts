// Filer läses i webbläsaren med pdf.js och SheetJS. Originalfilen lämnar aldrig datorn.
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { readFile } from '@bolagsappar/core/filetypes';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
export const readLocal = (file: File) => readFile(file, { pdfjs });
export { pdfjs };

export function download(filename: string, data: BlobPart | Uint8Array, mime = 'application/octet-stream') {
  const blob = data instanceof Blob ? data : new Blob([data as BlobPart], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
