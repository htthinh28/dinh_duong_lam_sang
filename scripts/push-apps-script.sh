#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -n "${CLASPRC_JSON:-}" ]; then
  echo "$CLASPRC_JSON" > ~/.clasprc.json
fi

if ! npx clasp show-authorized-user 2>/dev/null | grep -q '@'; then
  echo "Chưa đăng nhập clasp. Chạy: npx clasp login"
  exit 1
fi

echo "Đang đẩy lên Apps Script (scriptId trong .clasp.json)..."
npx clasp push -f
echo "Xong. Mở triển khai web: npx clasp open-script"
