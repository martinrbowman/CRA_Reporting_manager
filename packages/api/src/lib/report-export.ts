import PdfPrinter from 'pdfmake';
import vfsFonts from 'pdfmake/build/vfs_fonts.js';

// pdfmake's own TDocumentDefinitions type lives at a subpath ("pdfmake/interfaces")
// that NodeNext module resolution can't locate declarations for (the real
// package ships no interfaces.js, only @types does) — a locally-scoped loose
// type covers what buildReportDocDefinition actually needs.
type TDocumentDefinitions = Record<string, unknown>;

// pdfmake's browser build ships Roboto as base64 inside vfs_fonts — reused
// here for the server-side PdfPrinter so no external font files are needed
// (matters for an embedded/ARM deployment target with no font packages
// installed). The vfs shape has varied across pdfmake versions, so read it
// defensively rather than assuming one nesting.
type Vfs = Record<string, string>;
function resolveVfs(mod: unknown): Vfs {
  const asAny = mod as { pdfMake?: { vfs?: Vfs }; vfs?: Vfs } & Vfs;
  return asAny.pdfMake?.vfs ?? asAny.vfs ?? (asAny as Vfs);
}
const vfs = resolveVfs(vfsFonts);

const fonts = {
  Roboto: {
    normal: Buffer.from(vfs['Roboto-Regular.ttf'], 'base64'),
    bold: Buffer.from(vfs['Roboto-Medium.ttf'], 'base64'),
    italics: Buffer.from(vfs['Roboto-Italic.ttf'], 'base64'),
    bolditalics: Buffer.from(vfs['Roboto-MediumItalic.ttf'], 'base64'),
  },
};

const printer = new PdfPrinter(fonts);

export interface ReportExportData {
  reportId: string;
  reportType: 'early_warning' | 'full_notification' | 'final_report';
  status: string;
  regulator: string | null;
  referenceNumber: string | null;
  deadlineUtc: Date | null;
  submittedAtUtc: Date | null;
  submittedBy: string | null;
  content: Record<string, unknown>;
  product: { productName: string; modelNumber: string | null; manufacturerName: string } | null;
  vulnerabilityExternalId: string | null;
  vulnerabilitySummary: string | null;
}

const REPORT_TYPE_LABELS: Record<ReportExportData['reportType'], string> = {
  early_warning: 'Early Warning Notification (Art. 14 §2)',
  full_notification: 'Vulnerability Notification (Art. 14 §3)',
  final_report: 'Final Report (Art. 14 §5)',
};

function fmt(d: Date | null): string {
  return d ? d.toISOString().replace('T', ' ').slice(0, 19) + ' UTC' : '—';
}

function field(label: string, value: string | number | null | undefined) {
  return {
    columns: [
      { text: label, width: 160, bold: true, fontSize: 9, color: '#555' },
      { text: value === null || value === undefined || value === '' ? '—' : String(value), fontSize: 9 },
    ],
    margin: [0, 2, 0, 2] as [number, number, number, number],
  };
}

export function buildReportDocDefinition(data: ReportExportData): TDocumentDefinitions {
  const contentEntries = Object.entries(data.content ?? {});

  return {
    pageSize: 'A4',
    pageMargins: [40, 60, 40, 60],
    content: [
      { text: 'CRA Article 14 Vulnerability Reporting', fontSize: 16, bold: true },
      { text: REPORT_TYPE_LABELS[data.reportType], fontSize: 12, color: '#555', margin: [0, 2, 0, 16] },

      { text: 'Report', style: 'section' },
      field('Report ID', data.reportId),
      field('Status', data.status),
      field('Regulator', data.regulator),
      field('Reference number', data.referenceNumber),
      field('Deadline (UTC)', fmt(data.deadlineUtc)),
      field('Submitted at (UTC)', fmt(data.submittedAtUtc)),
      field('Submitted by', data.submittedBy),

      { text: 'Product', style: 'section' },
      field('Product name', data.product?.productName ?? '—'),
      field('Model number', data.product?.modelNumber ?? '—'),
      field('Manufacturer', data.product?.manufacturerName ?? '—'),

      { text: 'Vulnerability', style: 'section' },
      field('External ID', data.vulnerabilityExternalId),
      field('Summary', data.vulnerabilitySummary),

      { text: 'Report content', style: 'section' },
      contentEntries.length
        ? {
            table: {
              widths: ['30%', '70%'],
              body: contentEntries.map(([k, v]) => [
                { text: k, fontSize: 9, bold: true },
                { text: typeof v === 'string' ? v : JSON.stringify(v), fontSize: 9 },
              ]),
            },
            layout: 'lightHorizontalLines',
          }
        : { text: 'No additional content recorded.', fontSize: 9, italics: true, color: '#777' },
    ],
    styles: {
      section: { fontSize: 11, bold: true, margin: [0, 14, 0, 6], color: '#111' },
    },
    defaultStyle: { font: 'Roboto' },
    footer: (currentPage: number, pageCount: number) => ({
      text: `Generated ${new Date().toISOString()} — page ${currentPage} of ${pageCount} — CRA Compliance Platform`,
      fontSize: 7,
      color: '#999',
      alignment: 'center',
      margin: [0, 10, 0, 0],
    }),
  };
}

export function createReportPdf(data: ReportExportData) {
  const docDefinition = buildReportDocDefinition(data);
  // @types/pdfmake's TDocumentDefinitions isn't importable under NodeNext
  // resolution (see comment above) — the loose local type covers what this
  // module builds, so the mismatch is cast away at the one call site that
  // needs the real pdfmake type.
  return printer.createPdfKitDocument(docDefinition as unknown as Parameters<typeof printer.createPdfKitDocument>[0]);
}
