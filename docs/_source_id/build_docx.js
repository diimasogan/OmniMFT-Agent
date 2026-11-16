const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, ShadingType,
  BorderStyle, AlignmentType, ImageRun, LevelFormat, Footer, Header, PageNumber, PageBreak, TableOfContents,
} = require("docx");
const K = require("./content");

const OUT = process.argv[2];
const ASSETS = path.join(__dirname, "assets");
const NAVY = "0B2545", TEAL = "0E7C74", MUTED = "5B6B7A", LINE = "C9D6E2", TINT = "EEF5F9", TEALTINT = "E3F4F2";
const CONTENT_W = 9638; // A4 width 11906 - 2 x 1134 margins (DXA)
const FONT = "Calibri";

const p = (text, opts = {}) => new Paragraph({ spacing: { after: 120, line: 300 }, ...opts.para,
  children: [new TextRun({ text, font: FONT, size: 22, color: opts.color, bold: opts.bold, italics: opts.italics })] });
const h1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(t)] });
const h2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(t)] });
const bullet = (t, boldLead) => new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 80, line: 290 },
  children: boldLead ? [new TextRun({ text: boldLead + " ", bold: true, font: FONT, size: 22 }), new TextRun({ text: t, font: FONT, size: 22 })]
                     : [new TextRun({ text: t, font: FONT, size: 22 })] });
const numbered = (t, ref) => new Paragraph({ numbering: { reference: ref, level: 0 }, spacing: { after: 80, line: 290 },
  children: [new TextRun({ text: t, font: FONT, size: 22 })] });

const border = { style: BorderStyle.SINGLE, size: 4, color: LINE };
const borders = { top: border, bottom: border, left: border, right: border };
function table(headers, rows, widths, opts = {}) {
  const cell = (text, w, head, shade) => new TableCell({
    width: { size: w, type: WidthType.DXA }, borders,
    shading: head ? { type: ShadingType.CLEAR, color: "auto", fill: NAVY } : shade ? { type: ShadingType.CLEAR, color: "auto", fill: shade } : undefined,
    margins: { top: 80, bottom: 80, left: 110, right: 110 },
    children: [new Paragraph({ children: [new TextRun({ text, font: FONT, size: head ? 20 : 19, bold: head || undefined,
      color: head ? "FFFFFF" : undefined })] })],
  });
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: widths,
    rows: [new TableRow({ tableHeader: true, children: headers.map((h, i) => cell(h, widths[i], true)) }),
           ...rows.map((r, ri) => new TableRow({ children: r.map((c, i) => cell(c, widths[i], false,
             opts.shadeCol === i ? (c === "Lulus" ? TEALTINT : undefined) : (ri % 2 ? TINT : undefined))) }))],
  });
}
const img = (file, wpx, hpx, alt) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: 80 },
  children: [new ImageRun({ type: "png", data: fs.readFileSync(path.join(ASSETS, file)),
    transformation: { width: wpx, height: hpx }, altText: { title: alt, description: alt, name: alt } })] });
const caption = (t) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 },
  children: [new TextRun({ text: t, italics: true, size: 18, color: MUTED, font: FONT })] });
const spacer = () => new Paragraph({ spacing: { after: 120 }, children: [] });

// ---- cover
const cover = [
  new Paragraph({ spacing: { before: 2400, after: 200 }, children: [new TextRun({ text: K.title, font: "Cambria", size: 64, bold: true, color: NAVY })] }),
  new Paragraph({ spacing: { after: 400 }, children: [new TextRun({ text: K.subtitle, font: FONT, size: 28, color: TEAL })] }),
  new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: TEAL, space: 1 } }, spacing: { after: 300 }, children: [] }),
  p("Dokumentasi Solusi & Panduan Demo", { bold: true }),
  p(K.version, { color: MUTED }),
  p("Untuk: " + K.audience, { color: MUTED }),
  new Paragraph({ children: [new PageBreak()] }),
  new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: "Daftar Isi", font: "Cambria", size: 32, bold: true, color: NAVY })] }),
  new TableOfContents("Daftar Isi", { hyperlink: true, headingStyleRange: "1-2" }),
  p("(Klik kanan → Update Field di Word untuk memperbarui nomor halaman.)", { color: MUTED, italics: true }),
  new Paragraph({ children: [new PageBreak()] }),
];

// ---- body
const statRows = [K.stats.map((s) => s.value), K.stats.map((s) => s.label)];
const statTable = new Table({ width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: [2409, 2410, 2409, 2410],
  rows: statRows.map((r, ri) => new TableRow({ children: r.map((t, ci) => new TableCell({
    width: { size: [2409, 2410, 2409, 2410][ci], type: WidthType.DXA }, borders: { top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } },
    shading: { type: ShadingType.CLEAR, color: "auto", fill: TEALTINT }, margins: { top: ri ? 0 : 140, bottom: ri ? 140 : 0, left: 100, right: 100 },
    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: t, font: ri ? FONT : "Cambria",
      size: ri ? 18 : 40, bold: !ri, color: ri ? MUTED : TEAL })] })] })) })) });

const body = [
  h1("1. Ringkasan Eksekutif"), ...K.summary.map((t) => p(t)), spacer(), statTable, spacer(),
  h1("2. Kapabilitas Agent"), p("OmniMFT Ops Copilot menyediakan empat kapabilitas inti yang sesuai dengan kebutuhan operasional MFT:"),
  ...K.capabilities.flatMap((c) => [h2(c.name), p(c.text)]),
  h1("3. Arsitektur Solusi"),
  h2("3.1 " + K.fileFlow.title),
  p("Setiap file yang diunggah partner ke SecureTransport diteruskan otomatis ke Boomi untuk diproses:"),
  img("diagram-file-flow.png", 642, 120, "Diagram alur file partner ke SecureTransport ke Boomi"),
  caption("Gambar 1 — Alur file dari partner SFTP hingga diproses Boomi"),
  ...K.fileFlow.steps.map((s, i) => numbered(`${s.name}: ${s.detail}.`, "flow")),
  ...K.fileFlow.notes.map((t) => bullet(t)),
  h2("3.2 " + K.bridge.title),
  img("diagram-bridge.png", 642, 289, "Diagram outbound-only bridge antara on-premise dan Boomi Cloud"),
  caption("Gambar 2 — Agentstudio terhubung ke SecureTransport melalui bridge outbound-only"),
  ...K.bridge.points.map((t) => bullet(t)),
  p("Mengapa outbound-only: " + K.bridge.why, { italics: true, color: MUTED }),
  h2("3.3 Agent lokal (Claude Code)"),
  p("Untuk engineer, logika yang sama tersedia sebagai MCP server lokal (server.py) di Claude Code. Agent lokal mengakses SecureTransport secara langsung lewat VPN dan memakai persona OmniMFT dari CLAUDE.md."),
  h1("4. Komponen"),
  h2("4.1 Komponen Boomi"), p("Seluruh komponen berada di folder platform Training-Sandbox-WSL/OmniMFT-STInboundListener."),
  table(["Komponen", "Tipe", "Fungsi"], K.boomiComponents, [3300, 2100, 4238]), spacer(),
  h2("4.2 Tool agent di Agentstudio"),
  table(["Tool", "Jenis", "Fungsi"], K.tools, [3500, 1900, 4238]), spacer(),
  h2("4.3 Kode on-premise (~/boomi-project/OmniMFT-Agent)"),
  table(["File", "Fungsi"], K.localCode, [3000, 6638]), spacer(),
  h1("5. Keamanan & Kepatuhan"), ...K.security.map((s) => bullet(s.text, s.name + ":")),
  h1("6. Hasil Pengujian"), p("Pengujian dilakukan terhadap SecureTransport 5.5 lab dan Boomi Test Cloud pada November 2026."),
  table(["Skenario", "Hasil", "Status"], K.tests, [3300, 5038, 1300], { shadeCol: 2 }), spacer(),
  h1("7. Temuan Teknis & Solusinya"),
  table(["Temuan", "Penyebab", "Solusi"], K.findings, [2700, 3400, 3538]), spacer(),
  h1("8. Runbook Demo"), ...K.runbook.map((t) => numbered(t, "runbook")),
  h2("Skenario demo yang disarankan"),
  table(["Pertanyaan ke agent", "Yang terjadi"], K.demo.map((d) => [d.q, d.a]), [4400, 5238]), spacer(),
  h1("9. Keterbatasan"), ...K.limitations.map((t) => bullet(t)),
  h1("10. Langkah Berikutnya"), ...K.nextSteps.map((t) => numbered(t, "next")),
];

const doc = new Document({
  creator: "OmniMFT", title: K.title, description: K.subtitle,
  styles: {
    default: { document: { run: { font: FONT, size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: "Cambria", size: 34, bold: true, color: NAVY }, paragraph: { spacing: { before: 360, after: 160 }, keepNext: true, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: "Cambria", size: 26, bold: true, color: TEAL }, paragraph: { spacing: { before: 240, after: 100 }, keepNext: true, outlineLevel: 1 } },
    ],
  },
  numbering: { config: [
    { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] },
    ...["flow", "runbook", "next"].map((ref) => ({ reference: ref, levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.",
      alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 300 } } } }] })),
  ] },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
    headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: K.title + " — Dokumentasi Solusi", size: 16, color: MUTED, font: FONT })] })] }) },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER,
      children: [new TextRun({ children: ["Halaman ", PageNumber.CURRENT, " dari ", PageNumber.TOTAL_PAGES], size: 16, color: MUTED, font: FONT })] })] }) },
    children: [...cover, ...body],
  }],
});

Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(OUT, buf); console.log("wrote", OUT, buf.length, "bytes"); });
