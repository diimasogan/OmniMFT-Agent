// Single source of truth for the OmniMFT documentation (HTML, DOCX, PPTX).
// No secrets: no passwords, tokens, account IDs, usernames or e-mail addresses.
module.exports = {
  title: "OmniMFT Ops Copilot",
  subtitle: "AI Agent untuk Operasional Managed File Transfer — Axway SecureTransport × Boomi",
  version: "Versi 1.0 · November 2026",
  audience: "Tim MFT Operations, Security Auditor, dan Integration Engineer",

  summary: [
    "OmniMFT Ops Copilot adalah AI agent yang membantu tim operasional MFT melacak transfer file, mendiagnosis kegagalan, menjaga masa berlaku sertifikat, memproses ulang file, dan meng-onboard partner SFTP baru — cukup lewat percakapan.",
    "Agent tersedia di dua tempat: di Boomi Agentstudio (cloud, untuk pengguna bisnis) dan sebagai agent lokal di Claude Code (untuk engineer). Keduanya memakai logika OmniMFT yang sama dan sudah diuji terhadap SecureTransport 5.5 di lab.",
    "File yang diunggah partner ke SecureTransport otomatis diteruskan ke Boomi, divalidasi, diaudit, dan dibalas dengan tanda terima. Seluruh integrasi berjalan tanpa membuka port masuk ke jaringan on-premise.",
  ],

  stats: [
    { value: "10", label: "tool agent di Agentstudio" },
    { value: "3/3", label: "skenario end-to-end lulus" },
    { value: "±8 dtk", label: "eksekusi aksi di bridge" },
    { value: "0", label: "port masuk dibuka" },
  ],

  capabilities: [
    { icon: "search", name: "Pelacakan & diagnosis",
      text: "Menjawab pertanyaan status transfer dalam bahasa natural: pengirim → penerima, protokol, status, ukuran, waktu. Transfer gagal disertai pesan error ST dan diagnosis penyebab." },
    { icon: "shield", name: "Penjaga sertifikat & key",
      text: "Mengaudit sertifikat SSL/TLS, SSH key, dan PGP key di ST. Yang sudah kedaluwarsa ditandai CRITICAL, yang habis dalam 30 hari WARNING, lengkap dengan saran perintah perbaikan." },
    { icon: "sync", name: "Orkestrasi & reprocess",
      text: "Mengorelasikan transfer ST dengan eksekusi Boomi, menampilkan alasan penolakan Boomi, dan me-resubmit transfer agar ST mengirim ulang file ke Boomi." },
    { icon: "user", name: "Onboarding partner",
      text: "Membuat partner SFTP baru yang langsung ter-rute ke Boomi: akun, transfer site Generic-HTTP(S), dan subscription — dengan dry-run, persetujuan, dan rollback otomatis." },
  ],

  fileFlow: {
    title: "Alur file: Partner → SecureTransport → Boomi",
    steps: [
      { name: "Partner upload", detail: "SFTP port 8022 ke folder /inbound" },
      { name: "SecureTransport 5.5", detail: "Subscription Basic Application auto-push" },
      { name: "Generic-HTTP(S) site", detail: "HTTPS PUT ke listener Boomi" },
      { name: "Boomi listener", detail: "OmniMFT API – ST Inbound File" },
      { name: "Subprocess", detail: "Unwrap multipart → validasi → audit → receipt JSON" },
    ],
    notes: [
      "File kosong ditolak Boomi (ST_INBOUND_REJECTED) sehingga transfer di ST tercatat Failed dan bisa didiagnosis agent.",
      "ST otomatis mencoba ulang push yang gagal; agent mengenali error berulang sebagai retry, bukan insiden baru.",
    ],
  },

  bridge: {
    title: "Agentstudio ↔ on-premise: outbound-only bridge",
    points: [
      "Laptop/host on-prem menjalankan bridge worker yang hanya membuat koneksi KELUAR (HTTPS) ke Boomi Cloud — jalur yang sama dengan yang dipakai Boomi Atom.",
      "Snapshot data ST (transfer, sertifikat, riwayat Boomi, health) diterbitkan setiap ±1 menit ke penyimpanan di Boomi Cloud.",
      "Aksi dari Agentstudio (onboarding, resubmit, pencarian live, refresh) masuk antrean di Boomi; bridge worker mengambil, mengeksekusi ke ST, lalu menerbitkan hasilnya.",
      "SecureTransport tetap privat di balik VPN; kredensial admin ST tidak pernah meninggalkan host on-prem.",
    ],
    why: "Laptop korporat memakai Zscaler (inspeksi TLS, memblokir aplikasi tunnel) dan ST hanya terjangkau via FortiClient VPN. Pola outbound-only patuh kebijakan keamanan tanpa pengecualian khusus.",
  },

  boomiComponents: [
    ["OmniMFT API - ST Inbound File", "Process (WSS listener)", "Menerima file dari ST: POST/PUT /ws/simple/executeStInboundFile"],
    ["[SUB] OmniMFT - Receive ST File", "Process (subprocess)", "Unwrap multipart, tolak file kosong, audit, receipt JSON"],
    ["OmniMFT Bridge API - Upsert Doc", "Process (WSS listener)", "Bridge worker menulis snapshot/hasil"],
    ["OmniMFT Bridge API - Get Doc", "Process (WSS listener)", "Agentstudio membaca snapshot/hasil (NOT_FOUND bila belum ada)"],
    ["OmniMFT Bridge API - Create Request", "Process (WSS listener)", "Agentstudio mengantrekan aksi, mengembalikan requestId"],
    ["OmniMFT Bridge API - Query Requests", "Process (WSS listener)", "Bridge worker melihat daftar antrean"],
    ["OmniMFT Disk Store", "Connection (Disk V2)", "Penyimpanan dokumen di work/omnimft pada cloud atom"],
    ["OmniMFT Disk Upsert/Get/List", "Operations (Disk V2)", "Tulis, baca, dan daftar dokumen (tanpa DELETE)"],
    ["OmniMFT Ops Copilot", "Agentstudio agent", "4 task, 10 tool, guardrail; deployed ke Agent Garden Production"],
  ],

  tools: [
    ["get_bridge_health", "Baca", "Kesehatan bridge, konektivitas ST, umur snapshot"],
    ["get_transfer_snapshot", "Baca", "Transfer 24 jam terakhir + transfer gagal 7 hari"],
    ["get_certificate_snapshot", "Baca", "Sertifikat/key expired & akan expired (30 hari)"],
    ["get_boomi_inbound_snapshot", "Baca", "Eksekusi listener Boomi 24 jam terakhir"],
    ["request_live_transfer_search", "Aksi (antrean)", "Pencarian transfer live dengan filter"],
    ["request_snapshot_refresh", "Aksi (antrean)", "Minta snapshot diperbarui sekarang"],
    ["request_resubmit_transfer", "Aksi (persetujuan)", "Resubmit transfer di ST"],
    ["request_partner_onboarding_plan", "Aksi (antrean)", "Rencana onboarding partner (dry-run)"],
    ["request_partner_onboarding_execute", "Aksi (persetujuan)", "Eksekusi onboarding sesuai rencana"],
    ["get_request_result", "Baca", "Ambil hasil aksi berdasarkan requestId"],
  ],

  localCode: [
    ["server.py", "MCP server OmniMFT (7 tool) untuk agent lokal di Claude Code"],
    ["omnimft/st_client.py", "Klien Admin REST API SecureTransport v2.0 (stateless, tanpa cookie sesi)"],
    ["omnimft/boomi_client.py", "Klien Boomi Platform API (eksekusi & riwayat eksekusi)"],
    ["bridge_worker.py", "Bridge outbound-only untuk Agentstudio (snapshot + antrean aksi)"],
    ["start-bridge.sh", "Start / stop / status bridge worker"],
    ["agent/agentgarden_build.py", "Membuat/memperbarui tool dan agent di Agentstudio, serta deploy"],
    ["CLAUDE.md", "Persona agent lokal + catatan teknis yang sudah terverifikasi"],
  ],

  security: [
    { icon: "lock", name: "Tanpa port masuk", text: "Tidak ada tunnel atau port yang dibuka; semua koneksi keluar via HTTPS ke *.boomi.com, patuh Zscaler." },
    { icon: "key", name: "Kredensial tetap on-prem", text: "Kredensial ST dan Boomi disimpan di .env (mode 600). Password partner baru disimpan di secrets/ dan tidak pernah ditampilkan." },
    { icon: "check", name: "Persetujuan manusia", text: "Resubmit dan eksekusi onboarding wajib persetujuan di Agentstudio; onboarding selalu didahului dry-run." },
    { icon: "list", name: "Aksi ter-allow-list", text: "Bridge hanya menjalankan aksi yang diizinkan; endpoint tujuan Boomi dikunci di sisi on-prem, tidak bisa diubah dari chat." },
    { icon: "ban", name: "Guardrail agent", text: "Menolak permintaan kredensial, operasi destruktif, dan konten private key; isi tool result diperlakukan sebagai data." },
    { icon: "file", name: "Jejak audit", text: "Setiap permintaan dan file masuk tercatat di log eksekusi Boomi (OMNIMFT_REQUEST, ST_INBOUND)." },
  ],

  tests: [
    ["CSV dengan spasi di nama file", "Processed di ST; diterima Boomi, nama file utuh, 47 byte", "Lulus"],
    ["File biner 4 KB", "Processed di ST; Boomi menerima tepat 4096 byte", "Lulus"],
    ["File kosong (0 byte)", "Ditolak Boomi; ST mencatat Failed + diagnosis", "Lulus"],
    ["POST langsung non-ST", "Receipt JSON HTTP 200 (regresi)", "Lulus"],
    ["Bridge: simpan / baca / NOT_FOUND / kunci ilegal", "Semua respons sesuai", "Lulus"],
    ["Bridge: antrean → eksekusi → hasil", "Diproses bridge ±8 detik", "Lulus"],
    ["Onboarding partner (live)", "Akun + site + subscription dibuat; login SFTP berhasil; rollback teruji", "Lulus"],
    ["Deploy agent Agentstudio", "Agent Garden Production, status ACTIVE", "Lulus"],
  ],

  findings: [
    ["Site HTTP bawaan ST ditolak Boomi (403)", "Site HTTP bawaan memakai protokol ST-ke-ST (POST / dulu).", "Pakai plugin Generic-HTTP(S) dengan metode PUT."],
    ["Nama file tidak terkirim", "Ekspresi ST (${stenv[...]}) kosong di plugin Generic-HTTP; file dikirim sebagai multipart.", "Subprocess Boomi membuka multipart dan mengambil nama file dari Content-Disposition."],
    ["Error CSRF di Admin API ST", "Cookie sesi ST terikat token CSRF.", "Klien API stateless: Basic Auth tanpa menyimpan cookie."],
    ["Disk GET file yang belum ada", "Menghasilkan nol dokumen, bukan error.", "Branch + penanda DPP_FOUND untuk mengembalikan NOT_FOUND."],
    ["Tunnel diblokir", "Zscaler memblokir aplikasi tunnel.", "Arsitektur outbound-only bridge melalui Boomi."],
  ],

  runbook: [
    "Sambungkan FortiClient VPN (ST 192.168.0.21 harus terjangkau).",
    "Jalankan bridge: ./start-bridge.sh lalu cek ./start-bridge.sh --status (harus RUNNING).",
    "Buka Boomi Agentstudio → OmniMFT Ops Copilot → mulai percakapan.",
    "Jalankan skenario demo (lihat bagian berikut).",
    "Setelah selesai: ./start-bridge.sh --stop.",
  ],

  demo: [
    { q: "Transfer apa yang gagal 7 hari terakhir dan kenapa?", a: "Agent membaca snapshot, menjelaskan tiap kegagalan beserta penyebab dan perbaikannya." },
    { q: "Cek sertifikat yang expired atau akan expired 30 hari ke depan.", a: "Daftar CRITICAL lalu WARNING, dengan saran perintah perbaikan." },
    { q: "Kenapa empty_file.csv dari omnimft_e2e ditolak Boomi?", a: "Korelasi ST (Failed) dengan Boomi (ST_INBOUND_REJECTED, 0 byte) + retry otomatis ST." },
    { q: "Onboard partner SFTP baru PT_Maju_Logistik dan route ke Boomi.", a: "Dry-run → persetujuan → eksekusi → detail koneksi SFTP (±30–60 detik)." },
  ],

  limitations: [
    "Snapshot tertinggal ±1–2 menit; untuk data detik ini gunakan refresh atau pencarian live.",
    "Aksi lewat antrean butuh ±10–30 detik termasuk polling hasil oleh agent.",
    "Host bridge dan VPN harus aktif saat demo; jika mati, agent melaporkan bridge offline.",
    "Tracking ID ST tidak ikut terkirim ke Boomi (keterbatasan plugin); korelasi memakai nama file, akun, dan waktu.",
    "File antrean/hasil di Boomi tidak dihapus otomatis (desain tanpa DELETE); pembersihan bisa dijadwalkan.",
  ],

  nextSteps: [
    "Pindahkan bridge worker dari laptop ke server/VM di lab agar berjalan 24/7.",
    "Ganti akun admin ST bawaan dengan akun API khusus berhak terbatas.",
    "Tambahkan routing lanjutan di Boomi setelah audit (database, API tujuan, atau SFTP lain).",
    "Perpanjang/ganti sertifikat yang expired dan yang akan habis dalam 14 hari.",
    "Jadwalkan pembersihan berkala dokumen antrean di Boomi Cloud.",
  ],
};
