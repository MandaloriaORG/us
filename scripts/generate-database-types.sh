#!/bin/sh

set -eu

mandaloria_types_target="src/lib/database.types.ts"
mandaloria_types_tmp="$(mktemp)"

cleanup_types_tmp() {
  rm -f "$mandaloria_types_tmp"
}

trap cleanup_types_tmp EXIT HUP INT TERM

pnpm dlx supabase@latest gen types typescript --linked --schema public > "$mandaloria_types_tmp"
test -s "$mandaloria_types_tmp"
mv "$mandaloria_types_tmp" "$mandaloria_types_target"
trap - EXIT HUP INT TERM

pnpm exec prettier --write "$mandaloria_types_target"
