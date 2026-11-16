// Architecture diagrams as SVG (inline in HTML) + PNG (DOCX/PPTX).
const C = { navy: "0B2545", teal: "13A89E", tealDk: "0E7C74", amber: "E8913A", ink: "1B2B3A", muted: "5B6B7A",
            line: "C9D6E2", paper: "FFFFFF", tint: "EEF5F9", tealTint: "E3F4F2", amberTint: "FDF0E3" };
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const F = "font-family=\"Arial, Helvetica, sans-serif\"";

function box(x, y, w, h, title, sub, fill, stroke, titleColor = C.ink, ts = 21) {
  const lines = Array.isArray(sub) ? sub : [sub];
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="#${fill}" stroke="#${stroke}" stroke-width="2"/>
  <text x="${x + w / 2}" y="${y + 36}" ${F} font-size="${ts}" font-weight="700" fill="#${titleColor}" text-anchor="middle">${esc(title)}</text>
  ${lines.map((l, i) => `<text x="${x + w / 2}" y="${y + 64 + i * 24}" ${F} font-size="16" fill="#${C.muted}" text-anchor="middle">${esc(l)}</text>`).join("")}`;
}
const marker = `<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
  <path d="M0,0 L10,5 L0,10 z" fill="#${C.navy}"/></marker>
  <marker id="aht" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
  <path d="M0,0 L10,5 L0,10 z" fill="#${C.teal}"/></marker></defs>`;
const arrow = (x1, y1, x2, y2, color = C.navy, both = false, dash = "") =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#${color}" stroke-width="3" ${dash ? `stroke-dasharray="${dash}"` : ""} marker-end="url(#${color === C.teal ? "aht" : "ah"})" ${both ? `marker-start="url(#${color === C.teal ? "aht" : "ah"})"` : ""}/>`;
const label = (x, y, t, color = C.navy, size = 15, anchor = "middle", weight = "700") =>
  `<text x="${x}" y="${y}" ${F} font-size="${size}" font-weight="${weight}" fill="#${color}" text-anchor="${anchor}">${esc(t)}</text>`;

function fileFlowSvg(steps) {
  const W = 1600, H = 300, bw = 268, gap = 45, x0 = 22, y = 70, bh = 150;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${marker}
  <rect width="${W}" height="${H}" rx="20" fill="#${C.paper}"/>
  ${label(W / 2, 40, "Partner SFTP  →  SecureTransport (on-prem, VPN)  →  Boomi Cloud", C.navy, 20)}`;
  steps.forEach((st, i) => {
    const x = x0 + i * (bw + gap);
    const onprem = i <= 2;
    const words = st.detail.split(" "); const ls = []; let cur = "";
    words.forEach((w) => { if ((cur + " " + w).trim().length > 26) { ls.push(cur.trim()); cur = w; } else cur += " " + w; });
    if (cur.trim()) ls.push(cur.trim());
    s += box(x, y, bw, bh, `${i + 1}. ${st.name}`, ls, onprem ? C.tint : C.tealTint, onprem ? C.line : C.teal, C.ink, 17);
    if (i < steps.length - 1) s += arrow(x + bw + 4, y + bh / 2, x + bw + gap - 4, y + bh / 2);
  });
  s += label(x0 + (3 * bw + 2 * gap) / 2, 262, "On-premise (lab, via FortiClient VPN)", C.muted, 16, "middle", "400");
  s += label(x0 + 3 * (bw + gap) + (2 * bw + gap) / 2, 262, "Boomi Cloud (Test atom)", C.tealDk, 16, "middle", "400");
  return s + "</svg>";
}

function bridgeSvg() {
  const W = 1600, H = 720;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${marker}
  <rect width="${W}" height="${H}" rx="20" fill="#${C.paper}"/>
  <rect x="24" y="24" width="560" height="672" rx="18" fill="#${C.tint}" stroke="#${C.line}" stroke-width="2"/>
  ${label(304, 62, "ON-PREMISE (lab + laptop)", C.navy, 19)}
  <rect x="1016" y="24" width="560" height="672" rx="18" fill="#${C.tealTint}" stroke="#${C.teal}" stroke-width="2"/>
  ${label(1296, 62, "BOOMI CLOUD", C.tealDk, 19)}`;
  s += box(64, 110, 480, 140, "Axway SecureTransport 5.5", ["192.168.0.21 · Admin API 8444 · SFTP 8022", "Stays private"], C.paper, C.line);
  s += box(64, 410, 480, 190, "OmniMFT bridge worker", ["bridge_worker.py (laptop/host)", "Snapshots every ±60 s · queue polling ±5 s", "Allow-listed actions · credentials in .env"], C.paper, C.navy);
  s += arrow(304, 404, 304, 256, C.navy, true);
  s += label(320, 336, "Admin REST API via VPN", C.navy, 16, "start");
  s += box(1056, 110, 480, 130, "Disk V2 store  work/omnimft", ["snapshots/ · requests/ · results/", "no DELETE"], C.paper, C.teal);
  s += box(1056, 300, 480, 200, "Bridge listeners (WSS)", ["upsertOmnimftDoc · getOmnimftDoc", "createOmnimftRequest", "queryOmnimftRequests"], C.paper, C.teal);
  s += arrow(1296, 248, 1296, 292, C.teal, true);
  s += box(1056, 580, 480, 96, "Agentstudio: OmniMFT Ops Copilot", "read snapshots · queue actions · get results", C.amberTint, C.amber);
  s += arrow(1296, 572, 1296, 508, C.navy, true);
  s += label(800, 422, "publish snapshots & results (outbound HTTPS)", C.navy, 16);
  s += arrow(550, 440, 1048, 440, C.navy);
  s += arrow(550, 482, 1048, 482, C.navy);
  s += label(800, 512, "fetch queued actions (outbound HTTPS)", C.navy, 16);
  s += `<rect x="610" y="582" width="380" height="96" rx="14" fill="#${C.amberTint}" stroke="#${C.amber}" stroke-width="2"/>`;
  s += label(800, 620, "Internet · Zscaler", C.amber, 18);
  s += label(800, 650, "Inbound ports to on-prem: NONE", C.ink, 16);
  return s + "</svg>";
}

module.exports = { C, fileFlowSvg, bridgeSvg };
