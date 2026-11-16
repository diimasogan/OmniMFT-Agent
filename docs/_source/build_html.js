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
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  warn: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>',
  robot: '<rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 4v4M9 13v1M15 13v1M9 17h6"/>',
  server: '<rect x="4" y="4" width="16" height="7" rx="1.5"/><rect x="4" y="13" width="16" height="7" rx="1.5"/><path d="M8 7.5h.01M8 16.5h.01"/>',
};
const icon = (n) => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ICONS.check}</svg>`;
const table = (heads, rows, statusCol = -1) => `<div class="tbl"><table><thead><tr>${heads.map((h) => `<th>${e(h)}</th>`).join("")}</tr></thead><tbody>${
  rows.map((r) => `<tr>${r.map((c, i) => `<td>${i === statusCol ? `<span class="pill">${e(c)}</span>` : i === 0 ? `<strong>${e(c)}</strong>` : e(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;

const sections = [
  ["summary", "Summary"], ["background", "Background"], ["value", "Value"], ["usecases", "Use cases"], ["capabilities", "Capabilities"], ["architecture", "Architecture"], ["portal", "Web portal"], ["starters", "Starters"], ["components", "Components"],
  ["security", "Security"], ["tests", "Tests"], ["demo", "Demo"], ["next", "Next steps"],
];

const html = `<!doctype html>
<html lang="en">
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
.q{font-weight:700;color:var(--navy);margin:0 0 6px!important;font-size:17px}
.starter{display:flex;gap:16px;align-items:flex-start}.starter p{margin:0 0 6px}
.snum{flex:none;width:40px;height:40px;border-radius:50%;background:var(--teal);color:#fff;font:700 18px/40px Cambria,Georgia,serif;text-align:center}
.snum.amber{background:var(--amber)}
.outcome{color:var(--teal-ink)!important;font-weight:600;margin-top:8px!important}
.uc h3{font-size:19px;margin-bottom:6px}.uc .meta{font-size:14px;margin:0 0 10px}
.ba{display:grid;grid-template-columns:1fr 1fr;gap:12px}.ba div{border-radius:12px;padding:12px 14px;font-size:15px;color:var(--ink)}
.ba span{display:block;font-weight:700;font-size:12px;letter-spacing:.06em;text-transform:uppercase;margin-bottom:4px}
.before{background:var(--surface2)}.before span{color:var(--muted)}.after{background:var(--teal-tint)}.after span{color:var(--teal-ink)}
@media (max-width:820px){.ba{grid-template-columns:1fr}}
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
  <div class="eyebrow">Solution Documentation &amp; Demo Guide</div>
  <h1>${e(K.title)}</h1>
  <p>${e(K.subtitle)}</p>
  <div class="meta">${e(K.version)} · ${e(K.audience)}</div>
</div></header>
<nav class="toc" aria-label="Contents"><div class="wrap">
  ${sections.map(([id, t]) => `<a href="#${id}">${t}</a>`).join("")}
  <span class="spacer"></span>
  <button class="tgl" id="present" title="One section per screen (F = full screen)">Presentation mode</button>
  <button class="tgl" id="theme" title="Toggle light/dark theme">Theme</button>
</div></nav>
<main class="wrap">
<section id="summary"><h2>Executive summary</h2>
  ${K.summary.map((t, i) => `<p class="${i ? "" : "lead"}">${e(t)}</p>`).join("")}
  <div class="stats">${K.stats.map((s) => `<div class="stat"><b>${e(s.value)}</b><span>${e(s.label)}</span></div>`).join("")}</div>
</section>
<section id="background"><h2>Background</h2>
  ${K.background.intro.map((t, i) => `<p class="${i ? "" : "lead"}">${e(t)}</p>`).join("")}
  <h3 style="margin-top:20px">Pain points</h3>
  <div class="grid g3">${K.background.painPoints.map((x) => `<div class="card amber"><div class="ihead">${icon(x.icon)}<h3>${e(x.name)}</h3></div><p>${e(x.text)}</p></div>`).join("")}</div>
</section>
<section id="value"><h2>Business value</h2>
  <p class="lead">OmniMFT turns MFT operations from console work into governed, conversational automation. Values are qualitative; no baseline measurements were taken yet.</p>
  <div class="grid g2">${K.businessValue.map((x) => `<div class="card"><div class="ihead">${icon(x.icon)}<h3>${e(x.name)}</h3></div><p>${e(x.text)}</p><p class="outcome">→ ${e(x.outcome)}</p></div>`).join("")}</div>
</section>
<section id="usecases"><h2>Use case highlights</h2>
  <p class="lead">Six use cases cover the daily MFT operations lifecycle — each one is live and demonstrable today.</p>
  <div class="grid">${K.useCases.map((u, i) => `<div class="card uc"><h3>${i + 1}. ${e(u.name)}</h3>
    <p class="meta"><strong>Persona:</strong> ${e(u.persona)} &nbsp;·&nbsp; <strong>Trigger:</strong> ${e(u.trigger)}</p>
    <div class="ba"><div class="before"><span>Before</span>${e(u.before)}</div><div class="after"><span>With OmniMFT</span>${e(u.after)}</div></div>
    <p class="outcome">Business value: ${e(u.value)}</p></div>`).join("")}</div>
</section>
<section id="capabilities"><h2>Four core capabilities</h2>
  <div class="grid g2">${K.capabilities.map((c) => `<div class="card"><div class="ihead">${icon(c.icon)}<h3>${e(c.name)}</h3></div><p>${e(c.text)}</p></div>`).join("")}</div>
</section>
<section id="architecture"><h2>Solution architecture</h2>
  <h3>${e(K.fileFlow.title)}</h3>
  <figure>${fileFlowSvg(K.fileFlow.steps)}<figcaption>Figure 1 — File flow from the SFTP partner to processing in Boomi</figcaption></figure>
  <ul class="clean">${K.fileFlow.notes.map((t) => `<li>${e(t)}</li>`).join("")}</ul>
  <h3 style="margin-top:28px">${e(K.bridge.title)}</h3>
  <figure>${bridgeSvg()}<figcaption>Figure 2 — Agentstudio reaches SecureTransport through the outbound-only bridge</figcaption></figure>
  <ul class="clean">${K.bridge.points.map((t) => `<li>${e(t)}</li>`).join("")}</ul>
  <p class="note"><strong>Why outbound-only?</strong> ${e(K.bridge.why)}</p>
  <h3 style="margin-top:28px">Delivery routes</h3>
  ${table(["Route", "Objects created in ST", "Result"], K.routes.map((r) => [r.route, r.objects, r.use]))}
  <ul class="clean">${K.routeNotes.map((t) => `<li>${e(t)}</li>`).join("")}</ul>
  <h3 style="margin-top:28px">Notifications: e-mail &amp; WhatsApp</h3>
  <div class="grid g2">${K.notifications.map((t, i) => `<div class="card${i === 3 ? " amber" : ""}"><div class="ihead">${icon(["file", "list", "user", "check"][i])}<h3>${["Cloud-only", "Severity-tagged", "E-mail &amp; WhatsApp", "Approved &amp; audited"][i]}</h3></div><p>${e(t)}</p></div>`).join("")}</div>
  <h3 style="margin-top:28px">Local agent (Claude Code)</h3>
  <p>For engineers, the same logic is available as a local MCP server in Claude Code that reaches SecureTransport directly over the VPN.</p>
</section>
<section id="portal"><h2>${e(K.portal.title)}</h2>
  <p class="lead">${e(K.portal.intro)}</p>
  <div class="grid g2">${K.portal.features.map((x) => `<div class="card"><div class="ihead">${icon(x.icon)}<h3>${e(x.name)}</h3></div><p>${e(x.text)}</p></div>`).join("")}</div>
  <h3 style="margin-top:28px">${e(K.portal.patternTitle)}</h3>
  <div class="grid g2">${K.portal.pattern.map(([h, t], i) => `<div class="card starter"><div class="snum${i === 3 ? " amber" : ""}">${i + 1}</div><div><h3>${e(h)}</h3><p>${e(t)}</p></div></div>`).join("")}</div>
  <h3 style="margin-top:28px">Example prompts</h3>
  ${table(["Prompt", "What the portal does"], K.portal.prompts)}
  <h3 style="margin-top:28px">Modes</h3>
  ${table(["Mode", "Behaviour", "Open"], K.portal.modes)}
  <h3 style="margin-top:28px">Architecture &amp; guards</h3>
  <ul class="clean">${K.portal.architecture.map((t) => `<li>${e(t)}</li>`).join("")}</ul>
  <p class="note"><strong>How to start:</strong> ${e(K.portal.run)}</p>
</section>
<section id="starters"><h2>Conversation starters</h2>
  <p class="lead">Six ready-made prompts in Agentstudio and in the web portal. Each one demonstrates a key use case end to end and doubles as a demo script.</p>
  <div class="grid">${K.starters.map((x, i) => `<div class="card starter"><div class="snum${i === 4 ? " amber" : ""}">${i + 1}</div><div>
    <p class="q">“${e(x.text)}”</p><p><strong>Purpose:</strong> ${e(x.purpose)}</p><p><strong>What the agent does:</strong> ${e(x.flow)}</p></div></div>`).join("")}</div>
  <p class="note" style="margin-top:14px">${e(K.starterNote)}</p>
</section>
<section id="components"><h2>Components</h2>
  <h3>Boomi components</h3><p style="color:var(--muted)">Platform folder: Training-Sandbox-WSL/OmniMFT-STInboundListener</p>
  ${table(["Component", "Type", "Purpose"], K.boomiComponents)}
  <h3 style="margin-top:24px">Agentstudio agent tools</h3>${table(["Tool", "Kind", "Purpose"], K.tools)}
  <h3 style="margin-top:24px">On-premise code</h3>${table(["File", "Purpose"], K.localCode)}
</section>
<section id="security"><h2>Security &amp; compliance</h2>
  <div class="grid g3">${K.security.map((s) => `<div class="card"><div class="ihead">${icon(s.icon)}<h3>${e(s.name)}</h3></div><p>${e(s.text)}</p></div>`).join("")}</div>
</section>
<section id="tests"><h2>Test results</h2>
  ${table(["Scenario", "Result", "Status"], K.tests, 2)}
  <h3 style="margin-top:24px">Technical challenges solved</h3>${table(["Finding", "Cause", "Solution"], K.findings)}
</section>
<section id="demo"><h2>Demo guide</h2>
  <div class="grid g2">
    <div class="card"><div class="ihead">${icon("list")}<h3>Runbook</h3></div><ol class="clean">${K.runbook.map((t) => `<li>${e(t)}</li>`).join("")}</ol></div>
    <div class="card amber"><div class="ihead">${icon("sync")}<h3>Resubmit demo</h3></div><ol class="clean">${K.resubmitDemo.map((t) => `<li>${e(t)}</li>`).join("")}</ol></div>
  </div>
</section>
<section id="next"><h2>Limitations &amp; next steps</h2>
  <div class="grid g2">
    <div class="card"><h3>Limitations</h3><ul class="clean">${K.limitations.map((t) => `<li>${e(t)}</li>`).join("")}</ul></div>
    <div class="card"><h3>Next steps</h3><ol class="clean">${K.nextSteps.map((t) => `<li>${e(t)}</li>`).join("")}</ol></div>
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
