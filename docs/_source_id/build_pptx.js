const fs = require("fs");
const path = require("path");
const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const fa = require("react-icons/fa6");
const K = require("./content");
const { applyTheme } = require(process.env.PPTX_SKILL + "/scripts/apply_theme.js");

const OUT = process.argv[2];
const ASSETS = path.join(__dirname, "assets");
const THEME = {
  name: "OmniMFT", headFontFace: "Cambria", bodyFontFace: "Calibri",
  colors: { dk1: "1B2B3A", lt1: "FFFFFF", dk2: "0B2545", lt2: "EEF5F9", accent1: "13A89E", accent2: "E8913A",
            accent3: "0E7C74", accent4: "5B6B7A", accent5: "C9D6E2", accent6: "E3F4F2", hlink: "13A89E", folHlink: "0E7C74" },
};
const HEX = THEME.colors;

async function icon(Comp, color = "FFFFFF") {
  const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(Comp, { color: "#" + color, size: 256 }));
  const buf = await sharp(Buffer.from(svg)).resize(256, 256).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}

(async () => {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9"; // 10 x 5.625 in
  pres.title = K.title; pres.subject = K.subtitle; pres.author = "OmniMFT";
  pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
  const C = pres.SchemeColor;

  const ICON = {
    search: await icon(fa.FaMagnifyingGlass), shield: await icon(fa.FaShieldHalved), sync: await icon(fa.FaArrowsRotate),
    user: await icon(fa.FaUserPlus), lock: await icon(fa.FaLock), key: await icon(fa.FaKey), check: await icon(fa.FaCircleCheck),
    list: await icon(fa.FaListCheck), ban: await icon(fa.FaBan), file: await icon(fa.FaFileLines), bolt: await icon(fa.FaBolt),
    eye: await icon(fa.FaEye), warn: await icon(fa.FaTriangleExclamation), robot: await icon(fa.FaRobot),
    arrow: await icon(fa.FaArrowRight, HEX.accent2),
  };

  // ---------------- layouts
  pres.defineSlideMaster({
    title: "TITLE_DARK", background: { color: C.text2 },
    objects: [
      { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 1.55, w: 8.8, h: 1.1, fontSize: 44, bold: true, color: C.background1, valign: "bottom", margin: 0 }, text: "" } },
      { placeholder: { options: { name: "body", type: "body", x: 0.6, y: 2.8, w: 8.4, h: 1.0, fontSize: 18, color: C.accent6, valign: "top", margin: 0 }, text: "" } },
    ],
  });
  pres.defineSlideMaster({
    title: "CONTENT", background: { color: C.background1 },
    margin: [0.5, 0.5, 0.6, 0.5],
    objects: [
      { placeholder: { options: { name: "title", type: "title", x: 0.5, y: 0.3, w: 9.0, h: 0.75, fontSize: 28, bold: true, color: C.text2, valign: "middle", margin: 0 }, text: "" } },
      { text: { text: "OmniMFT Ops Copilot", options: { x: 0.5, y: 5.2, w: 4, h: 0.3, fontSize: 10, color: C.accent4, margin: 0 } } },
    ],
    slideNumber: { x: 9.0, y: 5.2, w: 0.5, h: 0.3, fontSize: 10, color: C.accent4, align: "right" },
  });

  const notes = (s, t) => s.addNotes(t);
  const card = (s, x, y, w, h, fill = C.background2, name = "card") =>
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.12, fill: { color: fill }, line: { color: fill, width: 0 }, objectName: name });
  const iconCircle = (s, x, y, d, img, fill = C.accent1, name = "icon") => {
    s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: fill }, line: { color: fill, width: 0 }, objectName: name + " circle" });
    s.addImage({ data: img, x: x + d * 0.25, y: y + d * 0.25, w: d * 0.5, h: d * 0.5, objectName: name, altText: name });
  };
  const txt = (s, text, o) => s.addText(text, { isTextBox: true, margin: 0, color: C.text1, fontSize: 14, valign: "top", ...o });

  // ---------------- 1. title
  pres.addSection({ title: "Pembuka" });
  let s = pres.addSlide({ masterName: "TITLE_DARK", sectionTitle: "Pembuka" });
  s.addText(K.title, { placeholder: "title" });
  s.addText("AI agent untuk operasional Managed File Transfer — Axway SecureTransport × Boomi", { placeholder: "body" });
  iconCircle(s, 0.6, 0.55, 0.8, ICON.robot, C.accent1, "Robot icon");
  txt(s, K.version, { x: 0.6, y: 4.75, w: 6, h: 0.35, fontSize: 12, color: C.accent5 });
  notes(s, "Perkenalkan OmniMFT Ops Copilot: AI agent yang membantu tim MFT mengelola SecureTransport dan alur file ke Boomi lewat percakapan.");

  // ---------------- 2. summary
  pres.addSection({ title: "Solusi" });
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Solusi" });
  s.addText("Satu agent untuk semua operasional MFT", { placeholder: "title" });
  txt(s, [
    { text: "Tim MFT cukup bertanya dalam bahasa natural untuk melacak transfer, mendiagnosis kegagalan, memantau sertifikat, memproses ulang file, dan meng-onboard partner baru.", options: { breakLine: true } },
    { text: " ", options: { breakLine: true, fontSize: 8 } },
    { text: "Tersedia di Boomi Agentstudio untuk pengguna bisnis dan di Claude Code untuk engineer — dengan logika dan pengujian yang sama.", options: {} },
  ], { x: 0.5, y: 1.3, w: 4.3, h: 3.4, fontSize: 16, paraSpaceAfter: 6 });
  K.stats.forEach((st, i) => {
    const x = 5.2 + (i % 2) * 2.2, y = 1.3 + Math.floor(i / 2) * 1.75;
    card(s, x, y, 2.0, 1.55, C.accent6, "Stat card " + (i + 1));
    txt(s, st.value, { x: x + 0.15, y: y + 0.2, w: 1.7, h: 0.75, fontSize: 36, bold: true, color: C.accent3, fontFace: THEME.headFontFace, align: "center", valign: "middle" });
    txt(s, st.label, { x: x + 0.15, y: y + 0.95, w: 1.7, h: 0.5, fontSize: 12, color: C.accent4, align: "center" });
  });
  notes(s, "Pesan utama: semua kebutuhan operasional MFT dari satu percakapan. Angka di kanan berasal dari pengujian nyata di lab.");

  // ---------------- 3. capabilities
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Solusi" });
  s.addText("Empat kapabilitas inti", { placeholder: "title" });
  K.capabilities.forEach((c, i) => {
    const x = 0.5 + (i % 2) * 4.6, y = 1.25 + Math.floor(i / 2) * 1.95;
    card(s, x, y, 4.4, 1.8, C.background2, "Capability card " + (i + 1));
    iconCircle(s, x + 0.25, y + 0.3, 0.6, ICON[c.icon], C.accent1, c.name + " icon");
    txt(s, c.name, { x: x + 1.05, y: y + 0.25, w: 3.15, h: 0.4, fontSize: 16, bold: true, color: C.text2 });
    txt(s, c.text, { x: x + 1.05, y: y + 0.68, w: 3.2, h: 1.05, fontSize: 11.5, color: C.text1 });
  });
  notes(s, "Empat kapabilitas sesuai spesifikasi OmniMFT: tracking & audit, penjaga sertifikat, orkestrasi Boomi, dan pembuatan use-case/onboarding partner.");

  // ---------------- 4. file flow
  pres.addSection({ title: "Arsitektur" });
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Arsitektur" });
  s.addText("Alur file partner → ST → Boomi", { placeholder: "title" });
  s.addImage({ path: path.join(ASSETS, "diagram-file-flow.png"), x: 0.5, y: 1.2, w: 9.0, h: 1.69, objectName: "File flow diagram",
               altText: "Diagram alur file dari partner SFTP ke SecureTransport ke Boomi" });
  K.fileFlow.notes.forEach((t, i) => {
    const y = 3.3 + i * 0.85;
    iconCircle(s, 0.6, y, 0.55, i ? ICON.sync : ICON.warn, i ? C.accent3 : C.accent2, "Note icon " + (i + 1));
    txt(s, t, { x: 1.35, y: y + 0.02, w: 8.0, h: 0.6, fontSize: 14, valign: "middle" });
  });
  notes(s, "File diunggah lewat SFTP, ST mendorongnya via HTTPS PUT ke listener Boomi. Subprocess membuka pembungkus multipart, menolak file kosong, mencatat audit, dan membalas receipt JSON.");

  // ---------------- 5. bridge
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Arsitektur" });
  s.addText("Agentstudio tanpa membuka firewall", { placeholder: "title" });
  s.addImage({ path: path.join(ASSETS, "diagram-bridge.png"), x: 0.5, y: 1.2, w: 5.6, h: 2.52, objectName: "Bridge diagram",
               altText: "Diagram outbound-only bridge antara on-premise dan Boomi Cloud" });
  const bp = [["Hanya koneksi keluar", "Bridge worker on-prem → HTTPS → Boomi Cloud, patuh Zscaler."],
              ["Snapshot ±1 menit", "Transfer, sertifikat, riwayat Boomi, dan health."],
              ["Antrean aksi", "Onboarding, resubmit, pencarian live dieksekusi on-prem."]];
  bp.forEach(([h, t], i) => {
    const y = 1.2 + i * 0.95;
    iconCircle(s, 6.4, y, 0.5, [ICON.lock, ICON.eye, ICON.bolt][i], C.accent1, h + " icon");
    txt(s, h, { x: 7.05, y, w: 2.5, h: 0.3, fontSize: 14, bold: true, color: C.text2 });
    txt(s, t, { x: 7.05, y: y + 0.3, w: 2.5, h: 0.6, fontSize: 11.5 });
  });
  card(s, 0.5, 4.05, 9.0, 0.9, C.accent6, "Key message card");
  txt(s, "SecureTransport tetap privat di balik VPN. Port masuk ke jaringan on-prem: tidak ada.",
      { x: 0.75, y: 4.1, w: 8.5, h: 0.8, fontSize: 16, bold: true, color: C.accent3, valign: "middle" });
  notes(s, "Laptop korporat memakai Zscaler dan ST hanya terjangkau via VPN, jadi tunnel tidak boleh. Pola outbound-only sama dengan cara Boomi Atom berkomunikasi: selalu dari dalam ke luar.");

  // ---------------- 6. tools
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Arsitektur" });
  s.addText("10 tool di Agentstudio", { placeholder: "title" });
  const reads = K.tools.filter((t) => t[1] === "Baca"), acts = K.tools.filter((t) => t[1] !== "Baca");
  [[reads, "Baca — instan", ICON.eye, C.accent1], [acts, "Aksi — lewat antrean", ICON.bolt, C.accent2]].forEach(([list, head, ic, col], ci) => {
    const x = 0.5 + ci * 4.6;
    card(s, x, 1.2, 4.4, 3.8, C.background2, head + " card");
    iconCircle(s, x + 0.25, 1.4, 0.5, ic, col, head + " icon");
    txt(s, head, { x: x + 0.9, y: 1.45, w: 3.3, h: 0.4, fontSize: 16, bold: true, color: C.text2, valign: "middle" });
    txt(s, list.map((t, i) => ({ text: t[0] + (t[1].includes("persetujuan") ? "  ✔ persetujuan" : ""),
      options: { bullet: true, breakLine: i < list.length - 1 } })), { x: x + 0.3, y: 2.05, w: 3.9, h: 2.8, fontSize: 13, paraSpaceAfter: 6, fontFace: "Calibri" });
  });
  notes(s, "Tool baca menjawab dari snapshot dalam beberapa detik. Tool aksi mengantrekan permintaan untuk bridge; resubmit dan eksekusi onboarding wajib persetujuan manusia di Agentstudio.");

  // ---------------- 7. demo scenarios
  pres.addSection({ title: "Demo" });
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Demo" });
  s.addText("Skenario demo", { placeholder: "title" });
  K.demo.forEach((d, i) => {
    const x = 0.5 + (i % 2) * 4.6, y = 1.2 + Math.floor(i / 2) * 1.95;
    card(s, x, y, 4.4, 1.8, i % 2 ? C.background2 : C.accent6, "Demo card " + (i + 1));
    txt(s, "“" + d.q + "”", { x: x + 0.25, y: y + 0.2, w: 3.9, h: 0.75, fontSize: 14, bold: true, italic: true, color: C.text2 });
    txt(s, d.a, { x: x + 0.25, y: y + 1.0, w: 3.9, h: 0.7, fontSize: 12, color: C.accent4 });
  });
  notes(s, "Urutan demo yang disarankan: kegagalan transfer, sertifikat, korelasi file kosong ST ↔ Boomi, lalu onboarding partner baru secara live.");

  // ---------------- 8. onboarding timeline
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Demo" });
  s.addText("Onboarding partner dari chat", { placeholder: "title" });
  const steps = [["Rencana", "Dry-run: akun, site, subscription"], ["Persetujuan", "Tombol approve di Agentstudio"],
                 ["Antrean", "Request masuk ke Boomi"], ["Eksekusi", "Bridge membuat di ST + rollback"], ["Hasil", "Host, port, user, folder SFTP"]];
  steps.forEach(([h, t], i) => {
    const x = 0.5 + i * 1.86;
    s.addShape(pres.shapes.OVAL, { x: x + 0.53, y: 1.45, w: 0.7, h: 0.7, fill: { color: i === 1 ? C.accent2 : C.accent1 }, line: { color: C.background1, width: 0 }, objectName: "Step " + (i + 1) });
    txt(s, String(i + 1), { x: x + 0.53, y: 1.45, w: 0.7, h: 0.7, fontSize: 20, bold: true, color: C.background1, align: "center", valign: "middle" });
    if (i < steps.length - 1) s.addImage({ data: ICON.arrow, x: x + 1.45, y: 1.65, w: 0.3, h: 0.3, objectName: "Arrow " + (i + 1), altText: "arrow" });
    txt(s, h, { x, y: 2.35, w: 1.76, h: 0.4, fontSize: 15, bold: true, color: C.text2, align: "center" });
    txt(s, t, { x: x + 0.05, y: 2.75, w: 1.66, h: 0.9, fontSize: 12, color: C.accent4, align: "center" });
  });
  card(s, 0.5, 3.95, 9.0, 0.95, C.background2, "Timing card");
  txt(s, [{ text: "±30–60 detik ", options: { bold: true, color: C.accent3 } }, { text: "dari permintaan sampai detail koneksi SFTP. Password partner dibuat otomatis dan tetap tersimpan aman di host on-prem.", options: {} }],
      { x: 0.75, y: 4.0, w: 8.5, h: 0.85, fontSize: 14, valign: "middle" });
  notes(s, "Tekankan kontrol manusia: agent selalu menunjukkan rencana dulu, eksekusi hanya setelah approve, dan kegagalan di tengah otomatis di-rollback.");

  // ---------------- 9. security
  pres.addSection({ title: "Keamanan & Hasil" });
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Keamanan & Hasil" });
  s.addText("Keamanan & kepatuhan", { placeholder: "title" });
  K.security.forEach((x0, i) => {
    const x = 0.5 + (i % 3) * 3.05, y = 1.2 + Math.floor(i / 3) * 1.9;
    card(s, x, y, 2.9, 1.75, C.background2, x0.name + " card");
    iconCircle(s, x + 0.2, y + 0.2, 0.5, ICON[x0.icon], C.accent3, x0.name + " icon");
    txt(s, x0.name, { x: x + 0.85, y: y + 0.22, w: 1.95, h: 0.5, fontSize: 13, bold: true, color: C.text2, valign: "middle" });
    txt(s, x0.text, { x: x + 0.2, y: y + 0.8, w: 2.55, h: 0.9, fontSize: 10.5 });
  });
  notes(s, "Enam lapis kontrol: tanpa port masuk, kredensial tetap on-prem, persetujuan manusia, allow-list aksi, guardrail agent, dan jejak audit di Boomi.");

  // ---------------- 10. test results
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Keamanan & Hasil" });
  s.addText("Hasil pengujian", { placeholder: "title" });
  const rows = [["Skenario", "Hasil"], ...K.tests.filter((_, i) => [0, 1, 2, 5, 6, 7].includes(i)).map((t) => [t[0], t[1]])];
  s.addTable(rows.map((r, ri) => r.map((c) => ({ text: c, options: {
    bold: ri === 0, color: ri === 0 ? HEX.lt1 : HEX.dk1, fill: { color: ri === 0 ? HEX.dk2 : (ri % 2 ? HEX.lt2 : HEX.lt1) },
    fontSize: ri === 0 ? 13 : 12, fontFace: "Calibri", valign: "middle", margin: [3, 6, 3, 6] } }))),
    { x: 0.5, y: 1.2, w: 6.4, colW: [2.4, 4.0], rowH: 0.48, border: { type: "solid", pt: 0.5, color: HEX.accent5 } });
  [["8/8", "skenario lulus"], ["4096 B", "file biner utuh"], ["ACTIVE", "agent di Production"]].forEach(([v, l], i) => {
    const y = 1.2 + i * 1.22;
    card(s, 7.2, y, 2.3, 1.08, C.accent6, "Result stat " + (i + 1));
    txt(s, v, { x: 7.3, y: y + 0.08, w: 2.1, h: 0.6, fontSize: 26, bold: true, color: C.accent3, align: "center", valign: "middle", fontFace: THEME.headFontFace });
    txt(s, l, { x: 7.3, y: y + 0.66, w: 2.1, h: 0.35, fontSize: 12, color: C.accent4, align: "center" });
  });
  notes(s, "Semua skenario diuji terhadap SecureTransport 5.5 lab dan Boomi Test Cloud, termasuk file biner dan penolakan file kosong yang tercermin kembali di File Tracking ST.");

  // ---------------- 11. findings
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Keamanan & Hasil" });
  s.addText("Tantangan teknis yang diselesaikan", { placeholder: "title" });
  K.findings.slice(0, 4).forEach((f, i) => {
    const x = 0.5 + (i % 2) * 4.6, y = 1.2 + Math.floor(i / 2) * 1.95;
    card(s, x, y, 4.4, 1.8, C.background2, "Finding card " + (i + 1));
    iconCircle(s, x + 0.2, y + 0.2, 0.45, ICON.warn, C.accent2, "Issue icon " + (i + 1));
    txt(s, f[0], { x: x + 0.8, y: y + 0.2, w: 3.45, h: 0.5, fontSize: 13, bold: true, color: C.text2, valign: "middle" });
    txt(s, [{ text: "Solusi: ", options: { bold: true, color: C.accent3 } }, { text: f[2], options: {} }], { x: x + 0.25, y: y + 0.85, w: 3.95, h: 0.85, fontSize: 12 });
  });
  notes(s, "Contoh nyata hambatan integrasi dan solusinya — menunjukkan bahwa solusi sudah teruji, bukan sekadar konsep.");

  // ---------------- 12. runbook + next steps
  pres.addSection({ title: "Penutup" });
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Penutup" });
  s.addText("Menjalankan demo & langkah berikutnya", { placeholder: "title" });
  [[K.runbook, "Runbook demo", ICON.list, C.accent1], [K.nextSteps, "Langkah berikutnya", ICON.bolt, C.accent2]].forEach(([list, head, ic, col], ci) => {
    const x = 0.5 + ci * 4.6;
    card(s, x, 1.2, 4.4, 3.8, C.background2, head + " card");
    iconCircle(s, x + 0.25, 1.4, 0.5, ic, col, head + " icon");
    txt(s, head, { x: x + 0.9, y: 1.45, w: 3.3, h: 0.4, fontSize: 16, bold: true, color: C.text2, valign: "middle" });
    txt(s, list.map((t, i) => ({ text: t, options: { bullet: { type: "number" }, breakLine: i < list.length - 1 } })),
        { x: x + 0.3, y: 2.05, w: 3.9, h: 2.85, fontSize: 12, paraSpaceAfter: 5 });
  });
  notes(s, "Sebelum demo: VPN tersambung dan bridge berjalan. Langkah lanjut utama: pindahkan bridge ke server lab agar berjalan 24/7.");

  // ---------------- 13. closing
  s = pres.addSlide({ masterName: "TITLE_DARK", sectionTitle: "Penutup" });
  s.addText("Terima kasih", { placeholder: "title" });
  s.addText("AI agent di cloud yang mengelola MFT on-premise — tanpa membuka firewall. Tanya jawab.", { placeholder: "body" });
  iconCircle(s, 0.6, 0.55, 0.8, ICON.check, C.accent1, "Check icon");
  notes(s, "Tutup dengan pesan utama dan buka sesi tanya jawab.");

  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log("wrote", OUT);
})();
