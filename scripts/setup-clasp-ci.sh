#!/usr/bin/env bash
# Thiết lập 1 lần để GitHub Actions tự push Apps Script sau mỗi commit lên main.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "=== Thiết lập clasp CI (push Apps Script tự động) ==="
echo ""

if ! command -v npx >/dev/null 2>&1; then
  echo "Cần Node.js và npm."
  exit 1
fi

if [ ! -f ~/.clasprc.json ]; then
  echo "Chưa có ~/.clasprc.json — đang mở đăng nhập Google..."
  npx clasp login
fi

if ! npx clasp show-authorized-user 2>/dev/null | grep -q '@'; then
  echo "Đăng nhập clasp thất bại. Chạy lại: npx clasp login"
  exit 1
fi

echo "Tài khoản clasp:"
npx clasp show-authorized-user
echo ""

if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  echo "Đang lưu CLASPRC_JSON vào GitHub Secrets..."
  gh secret set CLASPRC_JSON < ~/.clasprc.json
  echo "Xong. Secret CLASPRC_JSON đã được cập nhật."
  echo ""
  echo "Từ giờ mỗi khi push lên main (sửa index.html, js.html, css.html, Mã.js, ...)"
  echo "workflow «Push to Apps Script» sẽ tự chạy clasp push."
else
  echo "Chưa có gh CLI hoặc chưa đăng nhập GitHub."
  echo "Copy toàn bộ nội dung sau vào GitHub → Settings → Secrets → Actions → CLASPRC_JSON:"
  echo "---"
  cat ~/.clasprc.json
  echo "---"
fi

echo ""
echo "Kiểm tra: push thử lên main hoặc chạy workflow «Push to Apps Script» (workflow_dispatch)."
