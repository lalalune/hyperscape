#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TOOLS_VERSION="${ANCHOR_SBF_TOOLS_VERSION:-v1.44}"
PROGRAMS=(
  "fight_oracle"
  "gold_clob_market"
)

extract_marker_json() {
  local marker="$1"
  sed -n "/--- IDL begin ${marker} ---/,/--- IDL end ${marker} ---/p" | sed '1d;$d'
}

generate_idl() {
  local program="$1"
  local program_output
  local address_output
  local program_json
  local address_json
  local address

  echo "[anchor-build] idl ${program}"

  program_output="$(
    cargo test -p "${program}" --lib __anchor_private_print_idl_program --features idl-build -- --nocapture --test-threads=1 2>/dev/null
  )"
  program_json="$(printf '%s' "${program_output}" | extract_marker_json "program")"
  if [[ -z "${program_json}" ]]; then
    echo "[anchor-build] failed to extract program IDL JSON for ${program}" >&2
    exit 1
  fi

  address_output="$(
    cargo test -p "${program}" --lib __anchor_private_print_idl_address --features idl-build -- --nocapture --test-threads=1 2>/dev/null
  )"
  address_json="$(printf '%s' "${address_output}" | extract_marker_json "address")"
  if [[ -z "${address_json}" ]]; then
    echo "[anchor-build] failed to extract program address for ${program}" >&2
    exit 1
  fi

  address="$(printf '%s' "${address_json}" | jq -r 'fromjson')"
  if [[ -z "${address}" || "${address}" == "null" ]]; then
    echo "[anchor-build] extracted invalid address for ${program}" >&2
    exit 1
  fi

  printf '%s' "${program_json}" | jq --arg addr "${address}" '
    def strip_ns:
      if type == "string" then (split("::") | last) else . end;

    .address = $addr
    | (.accounts //= [])
    | (.types //= [])
    | .accounts |= map(.name |= strip_ns)
    | .types |= map(.name |= strip_ns)
    | walk(
        if type == "object" and has("defined") then
          if (.defined | type) == "object" and (.defined | has("name")) then
            .defined.name |= strip_ns
          elif (.defined | type) == "string" then
            .defined |= strip_ns
          else
            .
          end
        else
          .
        end
      )
  ' >"${ROOT_DIR}/target/idl/${program}.json"
}

mkdir -p "${ROOT_DIR}/target/idl"

if ! cargo --list | grep -q "build-sbf"; then
  echo "[anchor-build] cargo-build-sbf not found, skipping sbf build"
else
  for program in "${PROGRAMS[@]}"; do
    echo "[anchor-build] sbf ${program} (tools=${TOOLS_VERSION})"
    cargo build-sbf --tools-version "${TOOLS_VERSION}" --manifest-path "${ROOT_DIR}/programs/${program}/Cargo.toml"
  done
fi

for program in "${PROGRAMS[@]}"; do
  generate_idl "${program}"
done

echo "[anchor-build] complete"
