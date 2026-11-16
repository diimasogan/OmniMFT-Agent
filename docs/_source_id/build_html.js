const fs = require("fs");
const K = require("./content");
const { fileFlowSvg, bridgeSvg } = require("./diagrams");
const OUT = process.argv[2];
const e = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const ICONS = { // simple inline SVG glyphs (stroke icons)
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
  sync: '<path d="M4 12a8 8 0 0 1 14-5l2 2M20 12a8 8 0 0 1-14 5l-2-2"/><path d="M20 4v5h-5M4 20v-5h5"/>',
  user: '<circle cx="10" cy="8" r="4"/><path d="M2 21c1-4 4-6 8-6s7 2 8 6M19 8v6M16 11h6"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/>',
  ban: '<circle cx="12" cy="12" r="9"/><path d="M6 6l12 12"/>',
  file: '<path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4M9 13h6M9 17h6"/>',
};
const icon = (n) => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ICONS.check}</svg>`;
const table = (heads, rows, statusCol = -1) => `<div class="tbl"><table><thead><tr>${heads.map((h) => `<th>${e(h)}</th>`).join("")}</tr></thead><tbody>${
  rows.map((r) => `<tr>${r.map((c, i) => `<td>${i === statusCol ? `<span class="pill">${e(c)}</span>` : i === 0 ? `<strong>${e(c)}</strong>` : e(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;

const sections = [
  ["ringkasan", "Ringkasan"], ["kapabilitas", "Kapabilitas"], ["arsitektur", "Arsitektur"], ["komponen", "Komponen"],
  ["keamanan", "Keamanan"], ["pengujian", "Pengujian"], ["demo", "Demo"], ["lanjut", "Langkah lanjut"],
];

const html = `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>OmniMFT Ops Copilot</title>
<meta name="description" content="${e(K.subtitle)}">
<style>
:root{--bg:#F6F9FB;--surface:#FFFFFF;--surface2:#EEF5F9;--ink:#1B2B3A;--muted:#5B6B7A;--line:#D5E0EA;
 --navy:#0B2545;--teal:#13A89E;--teal-ink:#0E7C74;--teal-tint:#E3F4F2;--amber:#E8913A;--amber-tint:#FDF0E3;--shadow:0 1px 2px rgba(11,37,69,.06),0 6px 20px rgba(11,37,69,.06)}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#0B1622;--surface:#122233;--surface2:#16293D;--ink:#E6EEF5;--muted:#9FB1C2;
 --line:#233A52;--navy:#CFE3F5;--teal:#2FC4B8;--teal-ink:#5ED6CB;--teal-tint:#123A3A;--amber:#F2A65E;--amber-tint:#3A2A17;--shadow:none}}
:root[data-theme="dark"]{--bg:#0B1622;--surface:#122233;--surface2:#16293D;--ink:#E6EEF5;--muted:#9FB1C2;--line:#233A52;--navy:#CFE3F5;
 --teal:#2FC4B8;--teal-ink:#5ED6CB;--teal-tint:#123A3A;--amber:#F2A65E;--amber-tint:#3A2A17;--shadow:none}
*{box-sizing:border-box}html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 "Segoe UI",Calibri,Arial,sans-serif}
a{color:var(--teal-ink)}
.wrap{max-width:1120px;margin:0 auto;padding:0 16px}
header.hero{background:#0B2545;color:#fff;padding:56px 0 44px}
.hero .eyebrow{color:#7FD8CF;font-weight:600;letter-spacing:.06em;text-transform:uppercase;font-size:13px}
.hero h1{font:700 clamp(32px,5vw,52px)/1.1 Cambria,Georgia,serif;margin:10px 0 12px}
.hero p{color:#CFE3F5;max-width:760px;margin:0;font-size:18px}
.hero .meta{margin-top:18px;color:#9FB8CF;font-size:14px}
nav.toc{position:sticky;top:0;z-index:5;background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(8px);border-bottom:1px solid var(--line)}
nav.toc .wrap{display:flex;gap:6px;overflow-x:auto;padding-top:10px;padding-bottom:10px;align-items:center}
nav.toc a{white-space:nowrap;text-decoration:none;color:var(--muted);font-size:14px;padding:6px 10px;border-radius:999px}
nav.toc a:hover{background:var(--surface2);color:var(--ink)}
nav.toc .spacer{flex:1}
button.tgl{border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:999px;padding:6px 12px;font-size:13px;cursor:pointer;white-space:nowrap}
section{padding:44px 0 8px;scroll-margin-top:56px}
h2{font:700 30px/1.2 Cambria,Georgia,serif;color:var(--navy);margin:0 0 14px}
h3{font-size:18px;margin:0 0 6px;color:var(--ink)}
.lead{font-size:18px;color:var(--muted);max-width:820px}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-top:22px}
.stat{background:var(--teal-tint);border-radius:14px;padding:18px;text-align:center}
.stat b{display:block;font:700 34px/1.1 Cambria,Georgia,serif;color:var(--teal-ink)}
.stat span{color:var(--muted);font-size:14px}
.grid{display:grid;gap:14px}.g2{grid-template-columns:repeat(2,1fr)}.g3{grid-template-columns:repeat(3,1fr)}
.card{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:20px;box-shadow:var(--shadow)}
.card p{margin:0;color:var(--muted)}
.ihead{display:flex;gap:12px;align-items:center;margin-bottom:8px}
.ico{width:40px;height:40px;flex:none;padding:9px;border-radius:50%;background:var(--teal);stroke:#fff;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.amber .ico{background:var(--amber)}
figure{margin:18px 0;background:#fff;border:1px solid var(--line);border-radius:16px;padding:10px;overflow:auto}
figure svg{display:block;width:100%;height:auto;min-width:640px}
figcaption{color:var(--muted);font-size:14px;text-align:center;padding:6px}
ul.clean,ol.clean{padding-left:22px;margin:10px 0}ul.clean li,ol.clean li{margin:6px 0}
.note{background:var(--amber-tint);border-radius:12px;padding:14px 16px;color:var(--ink)}
.tbl{overflow-x:auto;border:1px solid var(--line);border-radius:14px;background:var(--surface)}
table{border-collapse:collapse;width:100%;min-width:620px;font-size:15px}
th{background:#0B2545;color:#fff;text-align:left;padding:10px 14px;font-weight:600}
td{padding:10px 14px;border-top:1px solid var(--line);vertical-align:top}
tbody tr:nth-child(even) td{background:var(--surface2)}
.pill{display:inline-block;background:var(--teal-tint);color:var(--teal-ink);font-weight:700;border-radius:999px;padding:2px 10px;font-size:13px}
.q{font-weight:700;color:var(--navy)}
footer{padding:40px 0 60px;color:var(--muted);font-size:14px}
/* presentation mode: one section per screen */
body.present nav.toc{display:none}
body.present section,body.present header.hero{min-height:100vh;display:flex;flex-direction:column;justify-content:center}
body.present section{border-top:1px solid var(--line)}
@media (max-width:820px){.stats{grid-template-columns:repeat(2,1fr)}.g2,.g3{grid-template-columns:1fr}h2{font-size:26px}}
@media print{nav.toc,button.tgl{display:none}section{break-inside:avoid}body{background:#fff}}
</style>
</head>
<body>
<header class="hero"><div class="wrap">
  <div class="eyebrow">Dokumentasi Solusi &amp; Panduan Demo</div>
  <h1>${e(K.title)}</h1>
  <p>${e(K.subtitle)}</p>
  <div class="meta">${e(K.version)} · ${e(K.audience)}</div>
</div></header>
<nav class="toc" aria-label="Daftar isi"><div class="wrap">
  ${sections.map(([id, t]) => `<a href="#${id}">${t}</a>`).join("")}
  <span class="spacer"></span>
  <button class="tgl" id="present" title="Satu bagian per layar (F = layar penuh)">Mode presentasi</button>
  <button class="tgl" id="theme" title="Ganti tema terang/gelap">Tema</button>
</div></nav>
<main class="wrap">
<section id="ringkasan"><h2>Ringkasan eksekutif</h2>
  ${K.summary.map((t, i) => `<p class="${i ? "" : "lead"}">${e(t)}</p>`).join("")}
  <div class="stats">${K.stats.map((s) => `<div class="stat"><b>${e(s.value)}</b><span>${e(s.label)}</span></div>`).join("")}</div>
</section>
<section id="kapabilitas"><h2>Empat kapabilitas inti</h2>
  <div class="grid g2">${K.capabilities.map((c) => `<div class="card"><div class="ihead">${icon(c.icon)}<h3>${e(c.name)}</h3></div><p>${e(c.text)}</p></div>`).join("")}</div>
</section>
<section id="arsitektur"><h2>Arsitektur solusi</h2>
  <h3>${e(K.fileFlow.title)}</h3>
  <figure>${fileFlowSvg(K.fileFlow.steps)}<figcaption>Gambar 1 — Alur file dari partner SFTP hingga diproses Boomi</figcaption></figure>
  <ul class="clean">${K.fileFlow.notes.map((t) => `<li>${e(t)}</li>`).join("")}</ul>
  <h3 style="margin-top:28px">${e(K.bridge.title)}</h3>
  <figure>${bridgeSvg()}<figcaption>Gambar 2 — Agentstudio terhubung ke SecureTransport melalui bridge outbound-only</figcaption></figure>
  <ul class="clean">${K.bridge.points.map((t) => `<li>${e(t)}</li>`).join("")}</ul>
  <p class="note"><strong>Mengapa outbound-only?</strong> ${e(K.bridge.why)}</p>
  <h3 style="margin-top:28px">Agent lokal (Claude Code)</h3>
  <p>Untuk engineer, logika yang sama tersedia sebagai MCP server lokal di Claude Code yang mengakses SecureTransport langsung lewat VPN.</p>
</section>
<section id="komponen"><h2>Komponen</h2>
  <h3>Komponen Boomi</h3><p style="color:var(--muted)">Folder platform: Training-Sandbox-WSL/OmniMFT-STInboundListener</p>
  ${table(["Komponen", "Tipe", "Fungsi"], K.boomiComponents)}
  <h3 style="margin-top:24px">Tool agent di Agentstudio</h3>${table(["Tool", "Jenis", "Fungsi"], K.tools)}
  <h3 style="margin-top:24px">Kode on-premise</h3>${table(["File", "Fungsi"], K.localCode)}
</section>
<section id="keamanan"><h2>Keamanan &amp; kepatuhan</h2>
  <div class="grid g3">${K.security.map((s) => `<div class="card"><div class="ihead">${icon(s.icon)}<h3>${e(s.name)}</h3></div><p>${e(s.text)}</p></div>`).join("")}</div>
</section>
<section id="pengujian"><h2>Hasil pengujian</h2>
  ${table(["Skenario", "Hasil", "Status"], K.tests, 2)}
  <h3 style="margin-top:24px">Tantangan teknis yang diselesaikan</h3>${table(["Temuan", "Penyebab", "Solusi"], K.findings)}
</section>
<section id="demo"><h2>Panduan demo</h2>
  <div class="grid g2">
    <div class="card"><div class="ihead">${icon("list")}<h3>Runbook</h3></div><ol class="clean">${K.runbook.map((t) => `<li>${e(t)}</li>`).join("")}</ol></div>
    <div class="card amber"><div class="ihead">${icon("search")}<h3>Skenario yang disarankan</h3></div>
      ${K.demo.map((d) => `<p style="margin:0 0 10px"><span class="q">“${e(d.q)}”</span><br>${e(d.a)}</p>`).join("")}</div>
  </div>
</section>
<section id="lanjut"><h2>Keterbatasan &amp; langkah berikutnya</h2>
  <div class="grid g2">
    <div class="card"><h3>Keterbatasan</h3><ul class="clean">${K.limitations.map((t) => `<li>${e(t)}</li>`).join("")}</ul></div>
    <div class="card"><h3>Langkah berikutnya</h3><ol class="clean">${K.nextSteps.map((t) => `<li>${e(t)}</li>`).join("")}</ol></div>
  </div>
</section>
</main>
<footer class="wrap">${e(K.title)} · ${e(K.version)}</footer>
<script>
(function(){
  var root=document.documentElement, KEY="omnimft-theme";
  try{var t=localStorage.getItem(KEY); if(t) root.setAttribute("data-theme",t);}catch(e){}
  document.getElementById("theme").addEventListener("click",function(){
    var cur=root.getAttribute("data-theme")||(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");
    var next=cur==="dark"?"light":"dark"; root.setAttribute("data-theme",next);
    try{localStorage.setItem(KEY,next);}catch(e){}
  });
  document.getElementById("present").addEventListener("click",function(){document.body.classList.toggle("present");});
  document.addEventListener("keydown",function(ev){
    if(ev.key==="f"||ev.key==="F"){ if(!document.fullscreenElement){document.documentElement.requestFullscreen&&document.documentElement.requestFullscreen();} else {document.exitFullscreen();} }
  });
})();
</script>
</body>
</html>`;
fs.writeFileSync(OUT, html);
console.log("wrote", OUT, html.length, "chars");
