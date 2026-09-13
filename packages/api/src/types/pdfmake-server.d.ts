// @types/pdfmake types the main "src/printer.js" entry (imported as `import
// PdfPrinter from 'pdfmake'`) but has no declaration for the bundled vfs
// fonts module, so that one is declared minimally here.
declare module 'pdfmake/build/vfs_fonts.js' {
  const vfs: Record<string, string> | { pdfMake?: { vfs: Record<string, string> } };
  export default vfs;
}
