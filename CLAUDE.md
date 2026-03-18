# CLAUDE.md — Dominion Protocol

## What This Is

Dominion is an epoch-based encrypted access control protocol for Nostr. HKDF-derived content keys per epoch/tier, AES-256-GCM encryption, Shamir secret sharing, tiered audiences.

## Commands

```bash
npm test            # vitest run — all tests
npm run typecheck   # tsc --noEmit
npm run build       # tsc → dist/
npm run test:watch  # vitest watch mode
npm run clean       # rm -rf dist/
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
- `dominion-protocol/nostr` — Nostr event builders/parsers for kind 30480 (Vault Share) and NIP-78 kind 30078 (Vault Config)

## Dependencies

- `@noble/hashes` — HKDF-SHA256, SHA-256, hex utilities
- `@noble/ciphers` — AES-256-GCM (synchronous, pure JS)

## Crypto Details

- **CK derivation:** `HKDF-SHA256(ikm=privkey, salt="vaulstr-ck-v1", info="epoch:{epochId}:tier:{tier}")`
- **Encryption:** AES-256-GCM, 12-byte random IV, output = base64(iv || ciphertext || tag)
- **Shamir:** GF(256) with irreducible polynomial 0x11b
- **Epoch format:** ISO 8601 weeks `YYYY-Www`
