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

echo "Đang kéo mã từ Apps Script xuống (scriptId trong .clasp.json)..."
npx clasp pull
echo "Xong. Kiểm tra diff: git status && git diff"
