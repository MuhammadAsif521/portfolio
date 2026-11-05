// Entry of the pdf.js web worker: bundled as its own file by the Angular build (see pdfjs.ts).
// The module installs its message handler on `self`.
import 'pdfjs-dist/build/pdf.worker.min.mjs';
