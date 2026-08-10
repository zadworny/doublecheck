#!/usr/bin/env bash

set -euo pipefail

: "${STELLAR_CONTRACT_ID:?Set STELLAR_CONTRACT_ID to the deployed registry contract}"
: "${STELLAR_KEEPER_IDENTITY:?Set STELLAR_KEEPER_IDENTITY to a funded Stellar CLI identity alias}"

STELLAR_KEEPER_NETWORK="${STELLAR_NETWORK:-testnet}"
STELLAR_KEEPER_BATCH="${STELLAR_KEEPALIVE_BATCH:-50}"
STELLAR_ENTITY_CURSOR=0
STELLAR_CLAIM_CURSOR=0

if ! command -v jq >/dev/null 2>&1; then
  echo "keepalive requires jq to read the contract cursor response" >&2
  exit 1
fi

while true; do
  STELLAR_KEEPER_RESULT="$(
    stellar contract invoke \
      --id "$STELLAR_CONTRACT_ID" \
      --source "$STELLAR_KEEPER_IDENTITY" \
      --network "$STELLAR_KEEPER_NETWORK" \
      --send yes \
      -- \
      keepalive \
      --entity_cursor "$STELLAR_ENTITY_CURSOR" \
      --claim_cursor "$STELLAR_CLAIM_CURSOR" \
      --limit "$STELLAR_KEEPER_BATCH"
  )"

  STELLAR_ENTITY_CURSOR="$(jq -er '.next_entity' <<<"$STELLAR_KEEPER_RESULT")"
  STELLAR_CLAIM_CURSOR="$(jq -er '.next_claim' <<<"$STELLAR_KEEPER_RESULT")"
  STELLAR_KEEPER_DONE="$(jq -er '.done' <<<"$STELLAR_KEEPER_RESULT")"
  STELLAR_ENTITIES_TOUCHED="$(jq -er '.entities_touched' <<<"$STELLAR_KEEPER_RESULT")"
  STELLAR_CLAIMS_TOUCHED="$(jq -er '.claims_touched' <<<"$STELLAR_KEEPER_RESULT")"

  echo "extended ${STELLAR_ENTITIES_TOUCHED} entities and ${STELLAR_CLAIMS_TOUCHED} claims"
  if [[ "$STELLAR_KEEPER_DONE" == "true" ]]; then
    break
  fi
done
