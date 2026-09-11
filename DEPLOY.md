# Deploy RPS Sign ke VPS Biznet (Docker Compose + Caddy/HTTPS)

Panduan produksi memakai Docker Compose. Semua layanan (aplikasi, PostgreSQL,
MinIO, Mailpit, reverse proxy Caddy dengan HTTPS otomatis) berjalan sebagai
kontainer. Estimasi 20–40 menit.

## 0. Prasyarat
- VPS Biznet Ubuntu 22.04/24.04 LTS, akses SSH.
- **RAM minimal 2 GB** (build Next.js + LibreOffice). Bila 1 GB, wajib tambah swap (Langkah 2).
- **Domain/subdomain** yang bisa diarahkan ke IP VPS (mis. `rps.namakampus.ac.id`). HTTPS butuh domain.
- Port **80** dan **443** terbuka ke internet.

> Ganti `rps.contoh.ac.id` dengan domain Anda dan `IP_VPS` dengan IP publik VPS Biznet Anda di semua contoh.

---

## 1. Masuk & amankan VPS
```bash
ssh root@IP_VPS
apt update && apt -y upgrade
# Buat user non-root (opsional tapi disarankan)
adduser deploy && usermod -aG sudo deploy
```

Firewall — hanya SSH, HTTP, HTTPS:
```bash
apt -y install ufw
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
ufw status
```

## 2. (Wajib jika RAM ≤ 2 GB) Tambah swap 2 GB
```bash
fallocate -l 2G /swapfile && chmod 600 /swapfile
mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
free -h
```

## 3. Install Docker + Compose plugin
```bash
curl -fsSL https://get.docker.com | sh
docker --version && docker compose version
# (opsional) agar user 'deploy' bisa docker tanpa sudo:
usermod -aG docker deploy   # lalu logout & login lagi
```

## 4. Ambil kode ke VPS
**Cara A — Git (disarankan).** Dorong proyek ke repo (GitHub/GitLab privat) dari PC Anda dulu, lalu:
```bash
cd /opt
git clone https://github.com/USER/rps-sign.git
cd rps-sign
```

**Cara B — salin langsung dari Windows** (PowerShell di PC Anda; `node_modules`/`.next` tidak perlu ikut):
```powershell
# jalankan di PC, bukan di VPS
scp -r "D:\Project nurma\rps-sign" deploy@IP_VPS:/opt/rps-sign
```
> Bila memakai Cara B, hapus dulu folder berat agar transfer cepat: `node_modules`, `.next`, `.storage`.

## 5. Konfigurasi environment produksi
Buat/edit file `.env` di dalam folder proyek pada VPS (dipakai Docker Compose untuk mengisi `${DOMAIN}` & `${AUTH_SECRET}`):
```bash
cd /opt/rps-sign
cat > .env <<'EOF'
DOMAIN=rps.contoh.ac.id
AUTH_SECRET=GANTI_DENGAN_HASIL_PERINTAH_DI_BAWAH
EOF

# Buat AUTH_SECRET acak kuat lalu tempel ke .env:
openssl rand -base64 32
```
Tempel hasil `openssl` ke baris `AUTH_SECRET=`. (Nilai DATABASE_URL, S3, SMTP sudah
diatur otomatis oleh `docker-compose.yml` untuk jaringan internal kontainer.)

## 6. Arahkan domain ke VPS (DNS)
Di panel DNS domain Anda (Biznet atau registrar), buat **A record**:
```
Host: rps (atau @)   Type: A   Value: IP_VPS   TTL: 3600
```
Tunggu propagasi (cek: `ping rps.contoh.ac.id` menunjukkan IP_VPS). HTTPS Caddy
baru berhasil jika DNS sudah mengarah.

## 7. Jalankan (build + start semua layanan)
```bash
cd /opt/rps-sign
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```
Build pertama memakan beberapa menit (compile Next.js + pasang LibreOffice).
Pantau:
```bash
docker compose logs -f app
docker compose logs -f caddy   # lihat proses penerbitan sertifikat HTTPS
```

## 8. Isi data awal (SEKALI saja)
Layanan `migrate` hanya menerapkan skema (tidak seed) agar restart tidak menghapus data.
Jalankan seed satu kali untuk membuat akun demo + contoh dokumen:
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml \
  run --rm migrate pnpm exec tsx prisma/seed.ts
```
> ⚠️ Perintah seed **menghapus lalu mengisi ulang** data. Jangan dijalankan lagi setelah dipakai produksi kecuali memang ingin reset.

## 9. Verifikasi
- Buka `https://rps.contoh.ac.id` → halaman login RPS Sign dengan gembok HTTPS.
- Cek kesehatan: `curl https://rps.contoh.ac.id/api/health` → `{"status":"ok"}`.
- Login demo: `admin@yppi-rembang.ac.id` / `Password123!`.

---

## 10. WAJIB setelah online (keamanan)
1. **Ganti kata sandi akun demo** (login sebagai admin → Pengguna) atau hapus akun yang tak dipakai. Jangan biarkan `Password123!` di produksi.
2. **Email nyata**: default memakai Mailpit (menangkap email, tidak mengirim keluar).
   Untuk pengiriman nyata, ubah env `app` di `docker-compose.prod.yml`:
   ```yaml
   MAIL_DRIVER: smtp
   SMTP_HOST: smtp.penyedia-anda.com
   SMTP_PORT: "587"
   SMTP_USER: "..."
   SMTP_PASS: "..."
   SMTP_SECURE: "false"
   MAIL_FROM: "RPS Sign <no-reply@domain-anda>"
   ```
   lalu `docker compose ... up -d`.
3. **Backup rutin** (lihat bawah). Jangan pernah commit `.env` berisi rahasia.
4. Pastikan `ufw` aktif — Postgres/MinIO/Mailpit tidak boleh diakses dari internet.

## 11. Operasional
Update aplikasi setelah ada perubahan kode:
```bash
cd /opt/rps-sign && git pull    # atau salin ulang
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Backup database:
```bash
docker compose exec db pg_dump -U rps rps_sign > backup_$(date +%F).sql
```

Restore:
```bash
cat backup_YYYY-MM-DD.sql | docker compose exec -T db psql -U rps -d rps_sign
```

Lihat status / hentikan:
```bash
docker compose ps
docker compose -f docker-compose.yml -f docker-compose.prod.yml down    # stop (data tetap di volume)
```

Akses UI Mailpit (opsional, via SSH tunnel dari PC Anda — tidak diekspos publik):
```bash
ssh -L 8025:localhost:8025 deploy@IP_VPS
# lalu buka http://localhost:8025 di browser PC
```

## 12. Catatan
- Skema diterapkan via `prisma db push` (cukup untuk mulai). Untuk evolusi skema
  terkontrol, buat migrasi: `pnpm db:migrate` di dev, commit folder `prisma/migrations`,
  lalu di server `migrate` akan memakai `prisma migrate deploy`.
- File dokumen/tanda tangan disimpan di MinIO (volume `minio_data`) dan hanya diakses
  lewat URL bertanda-tangan HMAC — tidak ada URL publik permanen.
- Konversi DOCX memakai LibreOffice yang sudah terpasang di image `app`.
