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
    mail: await icon(fa.FaEnvelope), cloud: await icon(fa.FaCloud), server: await icon(fa.FaServer), share: await icon(fa.FaShareNodes),
    flag: await icon(fa.FaFlagCheckered), arrow: await icon(fa.FaArrowRight, HEX.accent2),
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
  const numCircle = (s, x, y, d, n, fill = C.accent1) => {
    s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: fill }, line: { color: fill, width: 0 }, objectName: "Number " + n });
    s.addText(String(n), { isTextBox: true, x, y, w: d, h: d, margin: 0, fontSize: 16, bold: true, color: C.background1, align: "center", valign: "middle" });
  };
  const txt = (s, text, o) => s.addText(text, { isTextBox: true, margin: 0, color: C.text1, fontSize: 14, valign: "top", ...o });
  const twoListCards = (s, cols) => cols.forEach(([list, head, ic, col, numbered], ci) => {
    const x = 0.5 + ci * 4.6;
    card(s, x, 1.2, 4.4, 3.8, C.background2, head + " card");
    iconCircle(s, x + 0.25, 1.4, 0.5, ic, col, head + " icon");
    txt(s, head, { x: x + 0.9, y: 1.45, w: 3.3, h: 0.4, fontSize: 16, bold: true, color: C.text2, valign: "middle" });
    txt(s, list.map((t, i) => ({ text: t, options: { bullet: numbered ? { type: "number" } : true, breakLine: i < list.length - 1 } })),
        { x: x + 0.3, y: 2.05, w: 3.9, h: 2.85, fontSize: 12, paraSpaceAfter: 5 });
  });

  // ---------------- 1. title
  pres.addSection({ title: "Opening" });
  let s = pres.addSlide({ masterName: "TITLE_DARK", sectionTitle: "Opening" });
  s.addText(K.title, { placeholder: "title" });
  s.addText("AI agent for Managed File Transfer operations — Axway SecureTransport × Boomi", { placeholder: "body" });
  iconCircle(s, 0.6, 0.55, 0.8, ICON.robot, C.accent1, "Robot icon");
  txt(s, K.version, { x: 0.6, y: 4.75, w: 7, h: 0.35, fontSize: 12, color: C.accent5 });
  notes(s, "Introduce OmniMFT Ops Copilot: an AI agent that helps the MFT team run SecureTransport, route partner files and inform the team — through conversation.");

  // ---------------- 2. summary
  pres.addSection({ title: "Solution" });
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Solution" });
  s.addText("One agent for all MFT operations", { placeholder: "title" });
  txt(s, [
    { text: "The MFT team simply asks in natural language to track transfers, diagnose failures, monitor certificates, reprocess files, onboard partners and notify the team.", options: { breakLine: true } },
    { text: " ", options: { breakLine: true, fontSize: 8 } },
    { text: "Available in Boomi Agentstudio for business users and in Claude Code for engineers — with the same logic and the same tests.", options: {} },
  ], { x: 0.5, y: 1.3, w: 4.3, h: 3.4, fontSize: 16, paraSpaceAfter: 6 });
  K.stats.forEach((st, i) => {
    const x = 5.2 + (i % 2) * 2.2, y = 1.3 + Math.floor(i / 2) * 1.75;
    card(s, x, y, 2.0, 1.55, C.accent6, "Stat card " + (i + 1));
    txt(s, st.value, { x: x + 0.15, y: y + 0.2, w: 1.7, h: 0.75, fontSize: 36, bold: true, color: C.accent3, fontFace: THEME.headFontFace, align: "center", valign: "middle" });
    txt(s, st.label, { x: x + 0.15, y: y + 0.95, w: 1.7, h: 0.5, fontSize: 12, color: C.accent4, align: "center" });
  });
  notes(s, "Key message: every MFT operations need from one conversation. The numbers on the right describe what is live today.");

  // ---------------- background
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Solution" });
  s.addText("Background: why OmniMFT", { placeholder: "title" });
  K.background.painPoints.forEach((x, i) => {
    const cx = 0.5 + (i % 3) * 3.05, cy = 1.2 + Math.floor(i / 3) * 1.9;
    card(s, cx, cy, 2.9, 1.75, C.background2, x.name + " card");
    iconCircle(s, cx + 0.2, cy + 0.2, 0.5, ICON[x.icon], C.accent2, x.name + " icon");
    txt(s, x.name, { x: cx + 0.85, y: cy + 0.22, w: 1.95, h: 0.5, fontSize: 14, bold: true, color: C.text2, valign: "middle" });
    txt(s, x.text, { x: cx + 0.2, y: cy + 0.8, w: 2.55, h: 0.9, fontSize: 11 });
  });
  notes(s, K.background.intro.join("\n\n"));

  // ---------------- business value
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Solution" });
  s.addText("Business value", { placeholder: "title" });
  K.businessValue.forEach((x, i) => {
    const cx = 0.5 + (i % 4) * 2.3, cy = 1.2 + Math.floor(i / 4) * 1.9;
    card(s, cx, cy, 2.15, 1.75, i % 2 ? C.background2 : C.accent6, x.name + " card");
    iconCircle(s, cx + 0.18, cy + 0.18, 0.45, ICON[x.icon], C.accent1, x.name + " icon");
    txt(s, x.name, { x: cx + 0.18, y: cy + 0.72, w: 1.85, h: 0.45, fontSize: 13, bold: true, color: C.text2 });
    txt(s, x.outcome, { x: cx + 0.18, y: cy + 1.15, w: 1.85, h: 0.55, fontSize: 11, color: C.accent3 });
  });
  notes(s, K.businessValue.map((x) => `${x.name}: ${x.text} Outcome: ${x.outcome}.`).join("\n") + "\nValues are qualitative; no baseline measurements were taken yet.");

  // ---------------- 3. capabilities
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Solution" });
  s.addText("Four core capabilities", { placeholder: "title" });
  K.capabilities.forEach((c, i) => {
    const x = 0.5 + (i % 2) * 4.6, y = 1.25 + Math.floor(i / 2) * 1.95;
    card(s, x, y, 4.4, 1.8, C.background2, "Capability card " + (i + 1));
    iconCircle(s, x + 0.25, y + 0.3, 0.6, ICON[c.icon], C.accent1, c.name + " icon");
    txt(s, c.name, { x: x + 1.05, y: y + 0.25, w: 3.15, h: 0.4, fontSize: 16, bold: true, color: C.text2 });
    txt(s, c.text, { x: x + 1.05, y: y + 0.68, w: 3.2, h: 1.05, fontSize: 11.5, color: C.text1 });
  });
  notes(s, "The four capabilities from the OmniMFT specification, now including e-mail notifications and multi-route onboarding.");

  // ---------------- use cases
  pres.addSection({ title: "Use cases" });
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Use cases" });
  s.addText("Use case highlights", { placeholder: "title" });
  const ucIcons = [ICON.search, ICON.shield, ICON.user, ICON.sync, ICON.mail, ICON.cloud];
  K.useCases.forEach((u, i) => {
    const cx = 0.5 + (i % 3) * 3.05, cy = 1.2 + Math.floor(i / 3) * 1.9;
    card(s, cx, cy, 2.9, 1.75, C.background2, u.name + " card");
    iconCircle(s, cx + 0.2, cy + 0.2, 0.5, ucIcons[i], C.accent1, u.name + " icon");
    txt(s, u.name, { x: cx + 0.85, y: cy + 0.12, w: 1.95, h: 0.62, fontSize: 12.5, bold: true, color: C.text2, valign: "middle" });
    txt(s, u.persona, { x: cx + 0.2, y: cy + 0.78, w: 2.55, h: 0.42, fontSize: 10, italic: true, color: C.accent4 });
    txt(s, u.value, { x: cx + 0.2, y: cy + 1.18, w: 2.55, h: 0.54, fontSize: 10.5, color: C.accent3 });
  });
  notes(s, K.useCases.map((u, i) => `${i + 1}. ${u.name} (${u.persona}). Trigger: ${u.trigger} Value: ${u.value}`).join("\n"));
  const beforeAfter = (items, offset, title) => {
    const sl = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Use cases" });
    sl.addText(title, { placeholder: "title" });
    txt(sl, "Before", { x: 2.9, y: 1.05, w: 3.1, h: 0.3, fontSize: 12, bold: true, color: C.accent4 });
    txt(sl, "With OmniMFT", { x: 6.25, y: 1.05, w: 3.2, h: 0.3, fontSize: 12, bold: true, color: C.accent3 });
    items.forEach((u, i) => {
      const cy = 1.4 + i * 1.22;
      txt(sl, `${offset + i + 1}. ${u.name}`, { x: 0.5, y: cy, w: 2.25, h: 1.1, fontSize: 12.5, bold: true, color: C.text2, valign: "middle" });
      card(sl, 2.85, cy, 3.2, 1.1, C.background2, "Before " + (offset + i + 1));
      txt(sl, u.before, { x: 3.0, y: cy + 0.08, w: 2.9, h: 0.95, fontSize: 10.5, color: C.accent4, valign: "middle" });
      card(sl, 6.2, cy, 3.3, 1.1, C.accent6, "After " + (offset + i + 1));
      txt(sl, u.after, { x: 6.35, y: cy + 0.08, w: 3.0, h: 0.95, fontSize: 10.5, color: C.text1, valign: "middle" });
    });
    sl.addNotes(items.map((u, i) => `${offset + i + 1}. ${u.name} — Trigger: ${u.trigger} Before: ${u.before} With OmniMFT: ${u.after} Value: ${u.value}`).join("\n\n"));
  };
  beforeAfter(K.useCases.slice(0, 3), 0, "Before vs. with OmniMFT (1/2)");
  beforeAfter(K.useCases.slice(3), 3, "Before vs. with OmniMFT (2/2)");

  // ---------------- 4. file flow
  pres.addSection({ title: "Architecture" });
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Architecture" });
  s.addText("File flow: partner → ST → Boomi", { placeholder: "title" });
  s.addImage({ path: path.join(ASSETS, "diagram-file-flow.png"), x: 0.5, y: 1.2, w: 9.0, h: 1.69, objectName: "File flow diagram",
               altText: "Diagram of the file flow from the SFTP partner to SecureTransport to Boomi" });
  K.fileFlow.notes.forEach((t, i) => {
    const y = 3.3 + i * 0.85;
    iconCircle(s, 0.6, y, 0.55, i ? ICON.sync : ICON.warn, i ? C.accent3 : C.accent2, "Note icon " + (i + 1));
    txt(s, t, { x: 1.35, y: y + 0.02, w: 8.0, h: 0.6, fontSize: 14, valign: "middle" });
  });
  notes(s, "Files arrive over SFTP and ST pushes them via HTTPS PUT to the Boomi listener. The subprocess unwraps the multipart body, rejects empty files, writes an audit line and returns a JSON receipt.");

  // ---------------- 5. routes
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Architecture" });
  s.addText("Three delivery routes per partner", { placeholder: "title" });
  K.routes.forEach((r, i) => {
    const x = 0.5 + i * 3.05;
    card(s, x, 1.2, 2.9, 2.75, i === 2 ? C.accent6 : C.background2, "Route " + r.route);
    iconCircle(s, x + 0.2, 1.4, 0.55, [ICON.cloud, ICON.server, ICON.share][i], i === 2 ? C.accent2 : C.accent1, r.route + " icon");
    txt(s, r.route, { x: x + 0.9, y: 1.45, w: 1.9, h: 0.45, fontSize: 22, bold: true, color: C.text2, valign: "middle", fontFace: THEME.headFontFace });
    txt(s, r.use, { x: x + 0.2, y: 2.1, w: 2.5, h: 0.8, fontSize: 12.5, bold: true, color: C.accent3 });
    txt(s, r.objects, { x: x + 0.2, y: 2.95, w: 2.5, h: 0.95, fontSize: 11, color: C.accent4 });
  });
  card(s, 0.5, 4.15, 9.0, 0.85, C.background2, "Route note card");
  txt(s, "SSH targets come only from registered profiles; their credentials stay on the on-prem host. Every route starts with a dry-run and rolls back on failure.",
      { x: 0.75, y: 4.2, w: 8.5, h: 0.75, fontSize: 13, valign: "middle" });
  notes(s, "boomi processes files in Boomi; ssh delivers them to an SFTP inbox such as 192.168.0.21:/usecase/inbox; both uses an Advanced Routing fan-out so one Send To Partner step delivers to Boomi and the inbox at the same time. All three routes were verified with live file transfers.");

  // ---------------- 6. bridge
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Architecture" });
  s.addText("Agentstudio without opening the firewall", { placeholder: "title" });
  s.addImage({ path: path.join(ASSETS, "diagram-bridge.png"), x: 0.5, y: 1.2, w: 5.6, h: 2.52, objectName: "Bridge diagram",
               altText: "Diagram of the outbound-only bridge between on-premise and Boomi Cloud" });
  [["Outbound only", "On-prem bridge worker → HTTPS → Boomi Cloud, Zscaler-compliant."],
   ["Snapshots every ±1 min", "Transfers, certificates, Boomi history and health."],
   ["Action queue", "Onboarding, resubmit and live search run on-prem."]].forEach(([h, t], i) => {
    const y = 1.2 + i * 0.95;
    iconCircle(s, 6.4, y, 0.5, [ICON.lock, ICON.eye, ICON.bolt][i], C.accent1, h + " icon");
    txt(s, h, { x: 7.05, y, w: 2.5, h: 0.3, fontSize: 14, bold: true, color: C.text2 });
    txt(s, t, { x: 7.05, y: y + 0.3, w: 2.5, h: 0.6, fontSize: 11.5 });
  });
  card(s, 0.5, 4.05, 9.0, 0.9, C.accent6, "Key message card");
  txt(s, "SecureTransport stays private behind the VPN. Inbound ports into the on-prem network: none.",
      { x: 0.75, y: 4.1, w: 8.5, h: 0.8, fontSize: 16, bold: true, color: C.accent3, valign: "middle" });
  notes(s, "The corporate laptop runs Zscaler and ST is only reachable via VPN, so tunnels are not allowed. The outbound-only pattern mirrors how a Boomi Atom communicates: always from inside out.");

  // ---------------- 7. notifications
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Architecture" });
  s.addText("Notifications: e-mail & WhatsApp", { placeholder: "title" });
  const nIcons = [ICON.cloud, ICON.mail, ICON.share, ICON.check];
  const nHeads = ["Cloud-only", "Severity-tagged", "E-mail & WhatsApp", "Approved & audited"];
  K.notifications.forEach((t, i) => {
    const x = 0.5 + (i % 2) * 4.6, y = 1.2 + Math.floor(i / 2) * 1.9;
    card(s, x, y, 4.4, 1.75, C.background2, nHeads[i] + " card");
    iconCircle(s, x + 0.25, y + 0.25, 0.55, nIcons[i], i === 3 ? C.accent2 : C.accent1, nHeads[i] + " icon");
    txt(s, nHeads[i], { x: x + 1.0, y: y + 0.3, w: 3.2, h: 0.45, fontSize: 16, bold: true, color: C.text2, valign: "middle" });
    txt(s, t, { x: x + 0.25, y: y + 0.9, w: 3.95, h: 0.8, fontSize: 11 });
  });
  notes(s, "Notifications run in Boomi Cloud: e-mail via the shared Boomi Training (Mail) connection, WhatsApp via the Meta Cloud API (template omnimft_system_alert, pending Meta approval). Every task can offer to notify; each message needs approval.");

  // ---------------- 8. tools
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Architecture" });
  s.addText("12 tools in Agentstudio", { placeholder: "title" });
  const reads = K.tools.filter((t) => t[1] === "Read"), acts = K.tools.filter((t) => t[1] !== "Read");
  twoListCards(s, [[reads.map((t) => t[0]), "Read — instant", ICON.eye, C.accent1, false],
                   [acts.map((t) => t[0] + (t[1].includes("approval") ? "  ✔ approval" : "")), "Actions — queued", ICON.bolt, C.accent2, false]]);
  notes(s, "Read tools answer from snapshots within seconds. Action tools queue requests for the bridge; resubmit, onboarding execution and e-mails require human approval in Agentstudio.");

  // ---------------- web portal (2 slides)
  pres.addSection({ title: "Web portal" });
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Web portal" });
  s.addText("Web portal: the copilot on localhost", { placeholder: "title" });
  K.portal.features.forEach((x, i) => {
    const cx = 0.5 + (i % 2) * 3.05, cy = 1.2 + Math.floor(i / 2) * 1.95;
    card(s, cx, cy, 2.9, 1.8, i === 1 ? C.accent6 : C.background2, x.name + " card");
    iconCircle(s, cx + 0.2, cy + 0.2, 0.5, ICON[x.icon], i === 1 ? C.accent2 : C.accent1, x.name + " icon");
    txt(s, x.name, { x: cx + 0.85, y: cy + 0.22, w: 1.95, h: 0.5, fontSize: 14, bold: true, color: C.text2, valign: "middle" });
    txt(s, x.text, { x: cx + 0.2, y: cy + 0.82, w: 2.55, h: 0.92, fontSize: 10.5 });
  });
  card(s, 6.75, 1.2, 2.75, 3.75, C.text2, "Modes card");
  txt(s, "Two modes", { x: 6.95, y: 1.35, w: 2.4, h: 0.4, fontSize: 16, bold: true, color: C.background1 });
  txt(s, K.portal.modes.map(([m, t], i) => [{ text: m, options: { bold: true, color: C.accent1, breakLine: true } },
      { text: t, options: { color: C.background1, breakLine: true } }, ...(i === 0 ? [{ text: " ", options: { fontSize: 6, breakLine: true } }] : [])]).flat(),
      { x: 6.95, y: 1.8, w: 2.4, h: 2.0, fontSize: 11, paraSpaceAfter: 2 });
  txt(s, [{ text: "Start", options: { bold: true, color: C.accent1, breakLine: true } },
          { text: "python3 -I portal/portal_server.py → localhost:8080/?mode=live", options: { color: C.background1 } }],
      { x: 6.95, y: 3.9, w: 2.4, h: 0.95, fontSize: 10.5 });
  notes(s, K.portal.intro + "\n\n" + K.portal.features.map((x) => `${x.name}: ${x.text}`).join("\n") + "\n\n" + K.portal.run);

  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Web portal" });
  s.addText(K.portal.patternTitle, { placeholder: "title" });
  K.portal.pattern.forEach(([h, t], i) => {
    const x = 0.5 + i * 2.3;
    numCircle(s, x + 0.78, 1.3, 0.7, i + 1, i === 3 ? C.accent2 : C.accent1);
    if (i < K.portal.pattern.length - 1) s.addImage({ data: ICON.arrow, x: x + 1.83, y: 1.5, w: 0.3, h: 0.3, objectName: "Pattern arrow " + (i + 1), altText: "arrow" });
    txt(s, h, { x, y: 2.15, w: 2.25, h: 0.4, fontSize: 15, bold: true, color: C.text2, align: "center" });
    txt(s, t, { x: x + 0.08, y: 2.55, w: 2.1, h: 1.0, fontSize: 11, color: C.accent4, align: "center" });
  });
  card(s, 0.5, 3.75, 9.0, 1.2, C.background2, "Portal architecture card");
  iconCircle(s, 0.75, 4.05, 0.6, ICON.lock, C.accent3, "Proxy icon");
  txt(s, [{ text: "Browser → portal_server.py (127.0.0.1) → Boomi listeners → bridge → SecureTransport", options: { bold: true, color: C.text2, breakLine: true } },
          { text: "The local proxy is required (Boomi refuses browser CORS calls) and keeps the Boomi credentials in .env; it allow-lists three endpoints and blocks other websites.", options: {} }],
      { x: 1.6, y: 3.85, w: 7.7, h: 1.0, fontSize: 12, valign: "middle" });
  notes(s, K.portal.pattern.map(([h, t]) => `${h}: ${t}`).join("\n") + "\n\nExample prompts:\n" + K.portal.prompts.map(([q, a]) => `- ${q} → ${a}`).join("\n") + "\n\n" + K.portal.architecture.join("\n"));

  // ---------------- 9-10. conversation starters
  pres.addSection({ title: "Conversation starters" });
  const starterSlide = (items, offset, title, withNote) => {
    const sl = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Conversation starters" });
    sl.addText(title, { placeholder: "title" });
    items.forEach((x, i) => {
      const y = 1.15 + i * 1.24;
      card(sl, 0.5, y, 9.0, 1.12, i % 2 ? C.background2 : C.accent6, "Starter " + (offset + i + 1));
      numCircle(sl, 0.7, y + 0.28, 0.55, offset + i + 1, (offset + i) === 4 ? C.accent2 : C.accent1);
      txt(sl, "“" + x.text + "”", { x: 1.5, y: y + 0.12, w: 7.8, h: 0.5, fontSize: 14, bold: true, italic: true, color: C.text2, valign: "middle" });
      txt(sl, [{ text: "Purpose: ", options: { bold: true, color: C.accent3 } }, { text: x.purpose, options: {} }],
          { x: 1.5, y: y + 0.64, w: 7.8, h: 0.42, fontSize: 12 });
    });
    if (withNote) {
      card(sl, 0.5, 3.75, 9.0, 1.15, C.background2, "Starter note card");
      iconCircle(sl, 0.75, 3.98, 0.6, ICON.warn, C.accent2, "Note icon");
      txt(sl, K.starterNote, { x: 1.6, y: 3.85, w: 7.7, h: 0.95, fontSize: 13, valign: "middle" });
    }
    sl.addNotes(items.map((x, i) => `Starter ${offset + i + 1}: ${x.text} — Purpose: ${x.purpose} What the agent does: ${x.flow}`).join("\n\n") + (withNote ? "" : "\n\nDemo note: " + K.starterNote));
  };
  starterSlide(K.starters.slice(0, 3), 0, "Conversation starters (1/2)", false);
  starterSlide(K.starters.slice(3), 3, "Conversation starters (2/2)", false);

  // ---------------- 11. onboarding timeline
  pres.addSection({ title: "Demo" });
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Demo" });
  s.addText("Partner onboarding from chat", { placeholder: "title" });
  const steps = [["Plan", "Dry-run: account, sites, subscription, routes"], ["Approve", "Approve button in Agentstudio"],
                 ["Queue", "Request lands in Boomi"], ["Execute", "Bridge creates it in ST + rollback"], ["Result", "SFTP host, port, user, folder"]];
  steps.forEach(([h, t], i) => {
    const x = 0.5 + i * 1.86;
    numCircle(s, x + 0.53, 1.45, 0.7, i + 1, i === 1 ? C.accent2 : C.accent1);
    if (i < steps.length - 1) s.addImage({ data: ICON.arrow, x: x + 1.45, y: 1.65, w: 0.3, h: 0.3, objectName: "Arrow " + (i + 1), altText: "arrow" });
    txt(s, h, { x, y: 2.35, w: 1.76, h: 0.4, fontSize: 15, bold: true, color: C.text2, align: "center" });
    txt(s, t, { x: x + 0.05, y: 2.75, w: 1.66, h: 0.9, fontSize: 12, color: C.accent4, align: "center" });
  });
  card(s, 0.5, 3.95, 9.0, 0.95, C.background2, "Timing card");
  txt(s, [{ text: "±30–60 seconds ", options: { bold: true, color: C.accent3 } }, { text: "from request to SFTP connection details — for route boomi, ssh or both. The partner password stays securely on the on-prem host.", options: {} }],
      { x: 0.75, y: 4.0, w: 8.5, h: 0.85, fontSize: 14, valign: "middle" });
  notes(s, "Stress human control: the agent always shows the plan first, executes only after approval, any mid-way failure is rolled back, and it can e-mail an onboarding summary afterwards.");

  // ---------------- 12. runbook + resubmit demo
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Demo" });
  s.addText("Running the demo", { placeholder: "title" });
  twoListCards(s, [[["Connect FortiClient VPN", "Start the bridge: ./start-bridge.sh", "Open Agentstudio or the web portal (localhost:8080)",
                     "Pick a conversation starter and approve actions", "Afterwards: ./start-bridge.sh --stop"], "Demo runbook", ICON.list, C.accent1, true],
                   [["demo_resubmit.py prepare (fixable failure)", "Ask why it failed → HTTP 404 on the path", "demo_resubmit.py fix (operator fix)",
                     "Ask the agent to resubmit and e-mail the result", "demo_resubmit.py status / cleanup"], "Resubmit demo", ICON.sync, C.accent2, true]]);
  notes(s, "Before the demo: VPN connected and bridge running. For the resubmit story, prepare a fixable failure first, run fix right before asking the agent to resubmit, so ST's automatic retry does not get there first.");

  // ---------------- 13. security
  pres.addSection({ title: "Security & Results" });
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Security & Results" });
  s.addText("Security & compliance", { placeholder: "title" });
  K.security.forEach((x0, i) => {
    const x = 0.5 + (i % 3) * 3.05, y = 1.2 + Math.floor(i / 3) * 1.9;
    card(s, x, y, 2.9, 1.75, C.background2, x0.name + " card");
    iconCircle(s, x + 0.2, y + 0.2, 0.5, ICON[x0.icon], C.accent3, x0.name + " icon");
    txt(s, x0.name, { x: x + 0.85, y: y + 0.22, w: 1.95, h: 0.5, fontSize: 13, bold: true, color: C.text2, valign: "middle" });
    txt(s, x0.text, { x: x + 0.2, y: y + 0.8, w: 2.55, h: 0.9, fontSize: 10.5 });
  });
  notes(s, "Six layers of control: no inbound ports, credentials stay on-prem, human approval for every change and e-mail, action allow-list, agent guardrails and an audit trail in Boomi.");

  // ---------------- 14. test results
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Security & Results" });
  s.addText("Test results", { placeholder: "title" });
  const rows = [["Scenario", "Result"],
    ["Routes", "boomi, ssh and both delivered live; empty file rejected"], ["Resubmit", "404 diagnosed, fixed, file reached Boomi"],
    ["Partner check", "Complete, incomplete, deleted and orphaned partners found"], ["Re-onboarding", "Leftover routes removed, partner re-created"],
    ["Notifications", "E-mail SENT; WhatsApp awaits template approval"], ["Agentstudio", "v11.0 ACTIVE, 6 starters"],
    ["Web portal", "Live bridge via proxy, external e-mail SENT, guards hold"]];
  s.addTable(rows.map((r, ri) => r.map((c) => ({ text: c, options: {
    bold: ri === 0, color: ri === 0 ? HEX.lt1 : HEX.dk1, fill: { color: ri === 0 ? HEX.dk2 : (ri % 2 ? HEX.lt2 : HEX.lt1) },
    fontSize: ri === 0 ? 13 : 12, fontFace: "Calibri", valign: "middle", margin: [3, 6, 3, 6] } }))),
    { x: 0.5, y: 1.2, w: 6.4, colW: [1.6, 4.8], rowH: 0.44, border: { type: "solid", pt: 0.5, color: HEX.accent5 } });
  [[`${K.tests.filter((t) => t[2] === "Passed").length}/${K.tests.length}`, `passed · ${K.tests.filter((t) => t[2] !== "Passed").length} pending`], ["3", "routes verified live"], ["v11.0", "ACTIVE in Production"]].forEach(([v, l], i) => {
    const y = 1.2 + i * 1.22;
    card(s, 7.2, y, 2.3, 1.08, C.accent6, "Result stat " + (i + 1));
    txt(s, v, { x: 7.3, y: y + 0.08, w: 2.1, h: 0.6, fontSize: 26, bold: true, color: C.accent3, align: "center", valign: "middle", fontFace: THEME.headFontFace });
    txt(s, l, { x: 7.3, y: y + 0.66, w: 2.1, h: 0.35, fontSize: 12, color: C.accent4, align: "center" });
  });
  notes(s, "Every scenario was tested against the SecureTransport 5.5 lab and Boomi Test Cloud with live file transfers, including both delivery routes, the resubmit flow and e-mail delivery to an external domain.");

  // ---------------- 15. findings
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Security & Results" });
  s.addText("Technical challenges solved", { placeholder: "title" });
  K.findings.slice(0, 4).forEach((f, i) => {
    const x = 0.5 + (i % 2) * 4.6, y = 1.2 + Math.floor(i / 2) * 1.95;
    card(s, x, y, 4.4, 1.8, C.background2, "Finding card " + (i + 1));
    iconCircle(s, x + 0.2, y + 0.2, 0.45, ICON.warn, C.accent2, "Issue icon " + (i + 1));
    txt(s, f[0], { x: x + 0.8, y: y + 0.2, w: 3.45, h: 0.5, fontSize: 13, bold: true, color: C.text2, valign: "middle" });
    txt(s, [{ text: "Solution: ", options: { bold: true, color: C.accent3 } }, { text: f[2], options: {} }], { x: x + 0.25, y: y + 0.85, w: 3.95, h: 0.85, fontSize: 12 });
  });
  notes(s, "Real integration obstacles and how they were solved — evidence that the solution is proven, not just a concept.");

  // ---------------- 16. next steps
  pres.addSection({ title: "Closing" });
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Closing" });
  s.addText("Next steps", { placeholder: "title" });
  K.nextSteps.forEach((t, i) => {
    const y = 1.2 + i * 0.75;
    numCircle(s, 0.6, y + 0.07, 0.5, i + 1, i === 0 ? C.accent2 : C.accent1);
    txt(s, t, { x: 1.35, y, w: 8.1, h: 0.65, fontSize: 14, valign: "middle" });
  });
  notes(s, "Main next step: move the bridge to a lab server so it runs 24/7, then harden credentials and SSH host keys.");

  // ---------------- 17. closing
  s = pres.addSlide({ masterName: "TITLE_DARK", sectionTitle: "Closing" });
  s.addText("Thank you", { placeholder: "title" });
  s.addText("A cloud AI agent that runs on-premise MFT — without opening the firewall. Questions?", { placeholder: "body" });
  iconCircle(s, 0.6, 0.55, 0.8, ICON.flag, C.accent1, "Finish icon");
  notes(s, "Close with the key message and open the Q&A.");

  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log("wrote", OUT);
})();
