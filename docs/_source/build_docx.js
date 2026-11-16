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
             opts.shadeCol === i ? (c === "Passed" ? TEALTINT : undefined) : (ri % 2 ? TINT : undefined))) }))],
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
  p("Solution Documentation & Demo Guide", { bold: true }),
  p(K.version, { color: MUTED }),
  p("For: " + K.audience, { color: MUTED }),
  new Paragraph({ children: [new PageBreak()] }),
  new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: "Contents", font: "Cambria", size: 32, bold: true, color: NAVY })] }),
  new TableOfContents("Contents", { hyperlink: true, headingStyleRange: "1-2" }),
  p("(Right-click → Update Field in Word to refresh page numbers.)", { color: MUTED, italics: true }),
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
  h1("1. Executive Summary"), ...K.summary.map((t) => p(t)), spacer(), statTable, spacer(),
  h1("2. Background"), ...K.background.intro.map((t) => p(t)),
  h2("Pain points"),
  table(["Pain point", "What happens today"], K.background.painPoints.map((x) => [x.name, x.text]), [2600, 7038]), spacer(),
  h1("3. Business Value"),
  p("OmniMFT Ops Copilot turns MFT operations from console work into governed, conversational automation. The value is summarised below; figures are qualitative because no baseline measurements were taken yet."),
  table(["Value", "How OmniMFT delivers it", "Business outcome"], K.businessValue.map((x) => [x.name, x.text, x.outcome]), [2300, 4338, 3000]), spacer(),
  h1("4. Use Case Highlights"),
  p("Six use cases cover the daily MFT operations lifecycle. Each one is live and demonstrable today."),
  ...K.useCases.flatMap((u, i) => [h2(`4.${i + 1} ${u.name}`),
    table(["Aspect", "Description"], [["Persona", u.persona], ["Trigger", u.trigger], ["Before", u.before], ["With OmniMFT", u.after], ["Business value", u.value]], [2000, 7638]),
    spacer()]),
  h1("5. Agent Capabilities"), p("OmniMFT Ops Copilot provides four core capabilities that match the needs of MFT operations:"),
  ...K.capabilities.flatMap((c) => [h2(c.name), p(c.text)]),
  h1("6. Solution Architecture"),
  h2("6.1 " + K.fileFlow.title),
  p("Every file a partner uploads to SecureTransport is forwarded automatically to Boomi for processing:"),
  img("diagram-file-flow.png", 642, 120, "Diagram of the file flow from partner to SecureTransport to Boomi"),
  caption("Figure 1 — File flow from the SFTP partner to processing in Boomi"),
  ...K.fileFlow.steps.map((s, i) => numbered(`${s.name}: ${s.detail}.`, "flow")),
  ...K.fileFlow.notes.map((t) => bullet(t)),
  h2("6.2 " + K.bridge.title),
  img("diagram-bridge.png", 642, 289, "Diagram of the outbound-only bridge between on-premise and Boomi Cloud"),
  caption("Figure 2 — Agentstudio reaches SecureTransport through the outbound-only bridge"),
  ...K.bridge.points.map((t) => bullet(t)),
  p("Why outbound-only: " + K.bridge.why, { italics: true, color: MUTED }),
  h2("6.3 Delivery routes"),
  p("Each partner is onboarded with one of three delivery routes:"),
  table(["Route", "Objects created in ST", "Result"], K.routes.map((r) => [r.route, r.objects, r.use]), [1100, 4600, 3938]), spacer(),
  ...K.routeNotes.map((t) => bullet(t)),
  h2("6.4 Notifications (e-mail & WhatsApp)"), ...K.notifications.map((t) => bullet(t)),
  h2("6.5 Local agent (Claude Code)"),
  p("For engineers, the same logic is available as a local MCP server (server.py) in Claude Code. The local agent reaches SecureTransport directly over the VPN and uses the OmniMFT persona from CLAUDE.md."),
  h1("7. Web Portal (localhost)"),
  p(K.portal.intro),
  h2("7.1 Features"), ...K.portal.features.map((x) => bullet(x.text, x.name + ":")),
  h2("7.2 " + K.portal.patternTitle),
  table(["Step", "What happens"], K.portal.pattern, [1600, 8038]), spacer(),
  h2("7.3 Example prompts"),
  table(["Prompt", "What the portal does"], K.portal.prompts, [4300, 5338]), spacer(),
  h2("7.4 Modes"),
  table(["Mode", "Behaviour", "Open"], K.portal.modes, [1400, 4900, 3338]), spacer(),
  h2("7.5 Architecture & guards"), ...K.portal.architecture.map((t) => bullet(t)),
  p("How to start: " + K.portal.run, { italics: true, color: MUTED }),
  h1("8. Conversation Starters"),
  p("The agent offers six conversation starters in Agentstudio and in the web portal. Each one demonstrates a key use case end to end and doubles as a ready-made demo script:"),
  table(["#", "Conversation starter", "Purpose", "What the agent does"], K.starters.map((x, i) => [String(i + 1), x.text, x.purpose, x.flow]), [450, 2900, 2800, 3488]), spacer(),
  p(K.starterNote, { italics: true, color: MUTED }),
  h1("9. Components"),
  h2("9.1 Boomi components"), p("All components live in the platform folder Training-Sandbox-WSL/OmniMFT-STInboundListener."),
  table(["Component", "Type", "Purpose"], K.boomiComponents, [3300, 2100, 4238]), spacer(),
  h2("9.2 Agentstudio agent tools"),
  table(["Tool", "Kind", "Purpose"], K.tools, [3500, 1900, 4238]), spacer(),
  h2("9.3 On-premise code (~/boomi-project/OmniMFT-Agent)"),
  table(["File", "Purpose"], K.localCode, [3000, 6638]), spacer(),
  h1("10. Security & Compliance"), ...K.security.map((s) => bullet(s.text, s.name + ":")),
  h1("11. Test Results"), p("Tests were run against the SecureTransport 5.5 lab and Boomi Test Cloud in November 2026."),
  table(["Scenario", "Result", "Status"], K.tests, [3300, 5038, 1300], { shadeCol: 2 }), spacer(),
  h1("12. Technical Findings & Solutions"),
  table(["Finding", "Cause", "Solution"], K.findings, [2700, 3400, 3538]), spacer(),
  h1("13. Demo Runbook"), ...K.runbook.map((t) => numbered(t, "runbook")),
  h2("Resubmit demo (fixable failure)"), ...K.resubmitDemo.map((t) => numbered(t, "resubmit")),
  h1("14. Limitations"), ...K.limitations.map((t) => bullet(t)),
  h1("15. Next Steps"), ...K.nextSteps.map((t) => numbered(t, "next")),
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
    ...["flow", "runbook", "next", "resubmit"].map((ref) => ({ reference: ref, levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.",
      alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 300 } } } }] })),
  ] },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
    headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: K.title + " — Solution Documentation", size: 16, color: MUTED, font: FONT })] })] }) },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER,
      children: [new TextRun({ children: ["Page ", PageNumber.CURRENT, " of ", PageNumber.TOTAL_PAGES], size: 16, color: MUTED, font: FONT })] })] }) },
    children: [...cover, ...body],
  }],
});

Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(OUT, buf); console.log("wrote", OUT, buf.length, "bytes"); });
