# Thư viện tra cứu (TĐYT Phương Châu)

Thư mục này là bản **module THƯ VIỆN** trong CDSS, đồng bộ từ Desktop:

`C:\Users\admin\Desktop\Thu vien\index thu vien.txt` (ưu tiên) hoặc file HTML lớn trong cùng thư mục.

File chính host web: `index.html` (đồng bộ từ `index thu vien.txt`). Kèm `chandoan-html/`, `pdfs/`, `Nghi dinh 90 2026.html`.

## Cập nhật từ Desktop

```powershell
cd "g:\My Drive\App script\Dinh duong\thu-vien"
powershell -ExecutionPolicy Bypass -File .\sync-from-desktop.ps1
cd ..
git add thu-vien
git commit -m "Cap nhat thu vien tu Desktop"
git push origin main
```

## Dùng trong CDSS

Ứng dụng CDSS mở thư viện qua iframe (sidebar **THƯ VIỆN**). URL mặc định:

`https://htthinh28.github.io/dinh_duong_lam_sang/thu-vien/`

Có thể đổi trong Google Sheet → sheet **SYS_CONFIG** → key `THU_VIEN_URL`.

## Host trên GitHub Pages

1. Đẩy thư mục `thu-vien/` lên repo [dinh_duong_lam_sang](https://github.com/htthinh28/dinh_duong_lam_sang).
2. GitHub → **Settings** → **Pages** → Source: branch `main`, folder `/ (root)`.
3. Truy cập: `https://htthinh28.github.io/dinh_duong_lam_sang/thu-vien/`

**Lưu ý:** File `index.html` ~30MB; lần tải đầu có thể chậm. Thư mục này **không** được `clasp push` (xem `.claspignore`). Dữ liệu `chandoan-html/*.mjs` dùng đuôi `.mjs` (không phải `.js`) để tránh clasp đẩy nhầm lên Apps Script — gây lỗi `window is not defined`.
