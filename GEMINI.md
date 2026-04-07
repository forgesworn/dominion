# GEMINI.md -- dominion-protocol

Epoch-based encrypted access control protocol -- HKDF-derived content keys per epoch/tier, AES-256-GCM encryption, Shamir secret sharing, and tiered Nostr audiences.

## Commands

- `npm run build` -- compile TypeScript to dist/
- `npm test` -- run all tests (vitest)
- `npm run typecheck` -- type-check without emitting
- `npm run lint` -- biome check src/ tests/
- `npm run lint:fix` -- biome check --write src/ tests/
- `npm run test:watch` -- run tests in watch mode

## Dependencies

Runtime (2 packages):
- **`@noble/hashes`** -- HKDF-SHA256, SHA-256, hex utilities
- **`@noble/ciphers`** -- AES-256-GCM (synchronous, pure JS)

## Structure

```
src/
  index.ts          -- core layer public API (no Nostr knowledge)
  nostr/
    index.ts        -- Nostr layer public API
    vault-config.ts -- kind 30078 Vault Config event builder/parser
    vault-share.ts  -- kind 30480 Vault Share event builder/parser
  types.ts          -- DominionConfig, CKShare, VaultShareData, NostrEvent, etc.
  constants.ts      -- protocol constants (kinds, salt, version, epoch defaults)
  config.ts         -- config mutations (addToTier, removeFromTier, revokePubkey, etc.)
  content-keys.ts   -- HKDF content key derivation and epoch ID helpers
  encrypt.ts        -- AES-256-GCM encrypt/decrypt (text and blob variants)
  shamir.ts         -- GF(256) Shamir secret sharing primitives
  shamir-keys.ts    -- CK split/reconstruct (splitCK, reconstructCK, encodeCKShare, decodeCKShare)
spec/
  protocol.md       -- full protocol specification
tests/
  fixtures.ts       -- shared test data (keys, epochs, configs)
dist/               -- build output (generated)
```

Two subpath exports: `dominion-protocol` (core) and `dominion-protocol/nostr` (Nostr layer).

## Conventions

- **British English** -- colour, initialise, behaviour, licence
- **ESM-only** -- `"type": "module"` in package.json; imports use `.js` extensions
- **TDD** -- write a failing test first, then implement
- **Pure functions** -- all functions return new data; never mutate input objects
- **Two-layer discipline** -- core layer has zero Nostr knowledge; keep Nostr types in `src/nostr/`
- **Commit messages** -- `type: description` format (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`). No Co-Authored-By lines.

## Key Patterns

- CK derivation: `HKDF-SHA256(ikm=privkey, salt="dominion-ck-v1", info="epoch:{epochId}:tier:{tier}")`
- Encryption output: `base64(iv || ciphertext || tag)` with 12-byte random IV
- Shamir uses GF(256) with irreducible polynomial 0x11b
- Epoch IDs are ISO 8601 weeks: `YYYY-Www`
- `buildVaultConfigEvent` and `buildVaultShareEvent` return **unencrypted** content -- the caller applies NIP-44
- Config mutations (`addToTier`, `revokePubkey`, etc.) always return a new `DominionConfig` object

## Testing

Tests live in `tests/` as `*.test.ts` files. Shared fixtures in `tests/fixtures.ts`. Run `npm test` before committing. Run `npm run typecheck` to verify types separately.

## Release

Automated via semantic-release. `feat:` = minor, `fix:` = patch, `BREAKING CHANGE:` in commit body = major. Do NOT manually bump the version. GitHub Actions uses OIDC trusted publishing.
