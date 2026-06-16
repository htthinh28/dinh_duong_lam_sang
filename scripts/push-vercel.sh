#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -z "${VERCEL_TOKEN:-}" ]; then
  echo "Thiếu VERCEL_TOKEN. Lấy token tại: https://vercel.com/account/settings/tokens"
  echo "  export VERCEL_TOKEN=..."
  exit 1
fi

ARGS=(deploy --prod --yes --cwd thu-vien --token "$VERCEL_TOKEN")
if [ -n "${VERCEL_ORG_ID:-}" ] && [ -n "${VERCEL_PROJECT_ID:-}" ]; then
  ARGS+=(--scope "$VERCEL_ORG_ID")
fi

echo "Đang deploy thư mục thu-vien/ lên Vercel (production)..."
npx vercel "${ARGS[@]}"
echo "Xong."
