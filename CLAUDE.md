# CLAUDE.md — Dominion Protocol

## What This Is

Dominion is an epoch-based encrypted access control protocol for Nostr. HKDF-derived content keys per epoch/tier, AES-256-GCM encryption, Shamir secret sharing, tiered audiences.

## Commands

```bash
node node_modules/vitest/vitest.mjs run          # run all tests
node node_modules/typescript/bin/tsc --noEmit     # typecheck
npm run build                                     # compile to dist/
```

## Key Conventions

- All functions are pure and synchronous — data in, data out
- Core layer (`dominion-protocol`) has zero Nostr knowledge
- Nostr layer (`dominion-protocol/nostr`) builds/parses event objects — no publishing
- `buildVaultConfigEvent` returns UNENCRYPTED content — caller handles NIP-44
- British English everywhere
- Commit messages: `type: description` format
- Do NOT include `Co-Authored-By` lines in commits

## Architecture

Two-layer exports:

- `dominion-protocol` — universal crypto primitives (HKDF, AES-GCM, Shamir, config)
- `dominion-protocol/nostr` — Nostr event builders/parsers for kinds 30480 and 30481

## Dependencies

- `@noble/hashes` — HKDF-SHA256, SHA-256, hex utilities
- `@noble/ciphers` — AES-256-GCM (synchronous, pure JS)

## Crypto Details

- **CK derivation:** `HKDF-SHA256(ikm=privkey, salt="vaulstr-ck-v1", info="epoch:{epochId}:tier:{tier}")`
- **Encryption:** AES-256-GCM, 12-byte random IV, output = base64(iv || ciphertext || tag)
- **Shamir:** GF(256) with irreducible polynomial 0x11b
- **Epoch format:** ISO 8601 weeks `YYYY-Www`
