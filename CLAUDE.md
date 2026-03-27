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
npm run lint        # biome check src/ tests/
npm run lint:fix    # biome check --write src/ tests/
```

## Key Conventions

- All functions are pure and synchronous — data in, data out
- Core layer (`dominion-protocol`) has zero Nostr knowledge
- Nostr layer (`dominion-protocol/nostr`) builds/parses event objects — no publishing
- `buildVaultConfigEvent` returns UNENCRYPTED content — caller handles NIP-44
- `buildVaultShareEvent` also returns UNENCRYPTED content — caller handles NIP-44 + NIP-59 gift-wrap
- British English everywhere
- Commit messages: `type: description` format
- Do NOT include `Co-Authored-By` lines in commits

## Key Files

- `src/index.ts` — public API exports (core layer)
- `src/nostr/index.ts` — public API exports (Nostr layer)
- `src/types.ts` — all shared types (DominionConfig, CKShare, NostrEvent, VaultShareData)
- `src/constants.ts` — protocol constants (kinds, salt, version, epoch defaults)
- `src/config.ts` — config mutations (addToTier, removeFromTier, revokePubkey, etc.)
- `src/content-keys.ts` — HKDF content key derivation and epoch ID helpers
- `src/encrypt.ts` — AES-256-GCM encrypt/decrypt (text and blob variants)
- `src/shamir.ts` — GF(256) Shamir secret sharing
- `src/shamir-keys.ts` — CK splitting/reconstruction (wraps shamir.ts for content keys)
- `src/nostr/vault-config.ts` — kind 30078 Vault Config event builder/parser
- `src/nostr/vault-share.ts` — kind 30480 Vault Share event builder/parser
- `spec/protocol.md` — full protocol specification
- `nip-draft.md` — stripped NIP for nostr-protocol/nips submission
- `llms.txt` — AI-optimised API reference (shipped in npm package)
- `tests/fixtures.ts` — shared test data (keys, epochs, configs)

## Architecture

Two-layer exports:

- `dominion-protocol` — universal crypto primitives (HKDF, AES-GCM, Shamir, config)
- `dominion-protocol/nostr` — Nostr event builders/parsers for kind 30480 (Vault Share) and NIP-78 kind 30078 (Vault Config)

## Dependencies

- `@noble/hashes` — HKDF-SHA256, SHA-256, hex utilities
- `@noble/ciphers` — AES-256-GCM (synchronous, pure JS)

## Crypto Details

- **CK derivation:** `HKDF-SHA256(ikm=privkey, salt="dominion-ck-v1", info="epoch:{epochId}:tier:{tier}")`
- **Encryption:** AES-256-GCM, 12-byte random IV, output = base64(iv || ciphertext || tag)
- **Shamir:** GF(256) with irreducible polynomial 0x11b
- **Epoch format:** ISO 8601 weeks `YYYY-Www`

## Release

- semantic-release on push to main — do NOT manually bump version
- Commit messages drive versioning: `feat:` → minor, `fix:` → patch, `feat!:` → major
- CI runs lint, typecheck, build, test across Node 18/22/24
