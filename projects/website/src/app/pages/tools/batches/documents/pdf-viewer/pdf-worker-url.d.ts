/**
 * pdf.js worker, imported with the build's `file` loader (`with { loader: 'file' }`): the build copies the
 * file into the output and the import resolves to its public URL, so no CDN and no extra build config.
 */
declare module 'pdfjs-dist/build/pdf.worker.min.mjs' {
  const url: string;
  export default url;
}
