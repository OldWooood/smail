#!/usr/bin/env bash
#
# One-off cleanup for the legacy (pre-0004) mailbox implementation.
#
# - Deletes old KV ownership/state keys: mailbox:* and mailbox-state:*
# - Applies the clean-slate D1 migration, which drops the old `emails` table
#   and creates `mailboxes` + the new mailbox-id-scoped `emails` table.
#
# Usage:
#   bash scripts/cleanup-legacy.sh            # production (remote)
#   bash scripts/cleanup-legacy.sh --local    # local wrangler state
#
# Old mail is intentionally destroyed. Make sure this is what you want.

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

TARGET=(--remote)
if [[ "${1:-}" == "--local" ]]; then
	TARGET=(--local)
elif [[ -n "${1:-}" ]]; then
	echo "Unknown argument: $1" >&2
	echo "Usage: bash scripts/cleanup-legacy.sh [--local]" >&2
	exit 1
fi

keys_file="$(mktemp)"
trap 'rm -f "$keys_file"' EXIT

parse_keys() {
	node -e '
let input = "";
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  const start = input.indexOf("[");
  const end = input.lastIndexOf("]");
  if (start === -1 || end === -1) return;
  for (const key of JSON.parse(input.slice(start, end + 1))) {
    if (key && typeof key.name === "string") console.log(key.name);
  }
});
'
}

echo "Collecting legacy KV keys..."
for prefix in "mailbox:" "mailbox-state:"; do
	pnpm exec wrangler kv key list --binding KV "${TARGET[@]}" --prefix "$prefix" \
		| parse_keys >> "$keys_file"
done

if [[ -s "$keys_file" ]]; then
	node -e '
const fs = require("fs");
const file = process.argv[1];
const keys = fs.readFileSync(file, "utf8").split("\n").filter(Boolean);
fs.writeFileSync(file, JSON.stringify(keys));
console.log(`Deleting ${keys.length} legacy KV key(s)...`);
' "$keys_file"
	pnpm exec wrangler kv bulk delete "$keys_file" --binding KV "${TARGET[@]}" --force
else
	echo "No legacy KV keys found."
fi

echo "Applying D1 migrations (0004 drops all legacy mail data)..."
pnpm exec wrangler d1 migrations apply DB "${TARGET[@]}"

echo "Done. Legacy mailbox claims and messages have been removed."
