# MAMIYU Robux Store Discord Bot

Bot Discord untuk toko Robux MAMIYU dengan:
- `/setup` membuat struktur server otomatis
- `/price` menampilkan harga
- `/buy` membuat order private
- Dropdown nominal Robux
- Input username Roblox
- Pilihan metode pembayaran
- Status order
- Tombol "Saya Sudah Bayar"
- Staff approve/reject
- Order logs
- Close order
- Konfigurasi harga dan pembayaran dari `config.json`

## 1. Persiapan

Install Node.js 20+.

Buat application/bot di Discord Developer Portal dan aktifkan:
- Server Members Intent
- Message Content Intent tidak wajib untuk versi ini
- Bot permission: Manage Channels, Manage Roles, Send Messages, Embed Links, Read Message History

Salin token, Application ID, dan Server ID ke `.env`.

## 2. Install

```bash
npm install
```

## 3. Register slash commands

```bash
npm run deploy
```

## 4. Jalankan bot

```bash
npm start
```

## 5. Setup server

Di server Discord jalankan:

```text
/setup
```

Bot akan membuat:
- 📢 INFORMATION
- 🛒 ROBUX STORE
- 🎫 ORDERS
- 🔐 STAFF
- role MAMIYU STAFF
- channel announcement
- price-list
- create-order
- testimonials
- order-logs
- payment-logs
- staff-chat

Setelah itu jalankan `/buy`.

## Penting tentang pembayaran

Poster menyediakan metode:
- OVO
- GoPay
- DANA
- Bank Transfer

Nomor rekening/akun pembayaran tidak terlihat pada poster. Isi sendiri bagian `paymentAccounts` di `config.json`.

Bot ini tidak otomatis mengirim Robux atau mengakses akun Roblox. Bot hanya mengelola order, pembayaran, bukti pembayaran, dan status proses. Pengiriman Robux dilakukan oleh staff melalui metode yang memang kamu gunakan.

## Alur customer

`/buy`
→ pilih nominal
→ masukkan username Roblox
→ order private dibuat
→ pilih payment
→ lakukan pembayaran
→ upload bukti pembayaran
→ klik `Saya Sudah Bayar`
→ staff verifikasi
→ `Payment Verified`
→ staff proses
→ `Completed`

