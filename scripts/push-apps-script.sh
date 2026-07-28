#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -n "${CLASPRC_JSON:-}" ]; then
  echo "$CLASPRC_JSON" > ~/.clasprc.json
  chmod 600 ~/.clasprc.json 2>/dev/null || true
fi

if [ ! -f ~/.clasprc.json ]; then
  echo "Chưa có xác thực clasp."
  echo "Local:  npx clasp login && npm run push:script"
  echo "CI:     thêm secret CLASPRC_JSON — chạy npm run setup:clasp-ci"
  exit 1
fi

if ! npx clasp show-authorized-user 2>/dev/null | grep -q '@'; then
  echo "Chưa đăng nhập clasp hoặc token hết hạn."
  echo "Local:  npx clasp login"
  echo "CI:     npm run setup:clasp-ci  (cập nhật lại CLASPRC_JSON)"
  exit 1
fi

echo "Đang đẩy lên Apps Script (scriptId trong .clasp.json)..."
npx clasp push -f
echo "Xong. Mở triển khai web: npx clasp open-script"
