# AGENTS.md — dominion-protocol

Instructions in this file apply to the entire repository.

## Project Summary

- Epoch-based encrypted access control protocol for Nostr.
- HKDF-SHA256 content key derivation per epoch and tier, AES-256-GCM encryption, GF(256) Shamir secret sharing.
- Two-layer architecture: core crypto primitives are Nostr-free; Nostr layer builds/parses kind 30078 and kind 30480 events.
- ESM-only package (`"type": "module"`).
- Requires Node.js 20+.

## Key Commands

- `npm run build` — compile TypeScript into `dist/`
- `npm test` — run the Vitest suite
- `npm run test:watch` — run tests in watch mode
- `npm run typecheck` — TypeScript type-check without emitting
- `npm run lint` — biome check src/ tests/
- `npm run lint:fix` — biome check --write src/ tests/

## Repository Structure

- `src/index.ts` — core layer public API exports
- `src/nostr/index.ts` — Nostr layer public API exports
- `src/types.ts` — all shared types (`DominionConfig`, `CKShare`, `VaultShareData`, `NostrEvent`, etc.)
- `src/constants.ts` — protocol constants (kinds, salt, version, epoch defaults)
- `src/config.ts` — config mutations (`addToTier`, `removeFromTier`, `revokePubkey`, `unrevokePubkey`, `addIndividualGrant`, `removeIndividualGrant`, `defaultConfig`)
- `src/content-keys.ts` — HKDF content key derivation and epoch ID helpers
- `src/encrypt.ts` — AES-256-GCM encrypt/decrypt (text and blob variants)
- `src/shamir.ts` — GF(256) Shamir secret sharing primitives
- `src/shamir-keys.ts` — CK splitting/reconstruction (`splitCK`, `reconstructCK`, `encodeCKShare`, `decodeCKShare`)
- `src/nostr/vault-config.ts` — kind 30078 Vault Config event builder/parser
- `src/nostr/vault-share.ts` — kind 30480 Vault Share event builder/parser
- `spec/protocol.md` — full protocol specification
- `tests/fixtures.ts` — shared test data (keys, epochs, configs)
- `dist/` — build output (generated, do not edit by hand)

## Coding Conventions

- **British English** — colour, initialise, behaviour, licence, organise.
- **Pure functions** — all functions take data in and return data out; no mutation of input objects.
- **ESM-only** — maintain ESM-compatible imports with `.js` extensions.
- **TDD** — add a failing test first, then implement.
- **Input validation** — all public APIs validate inputs and throw descriptive errors on invalid parameters.
- **Two-layer discipline** — never import Nostr types or event shapes into `src/` (core layer); keep them in `src/nostr/`.
- **Commit messages** — `type: description` format (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`). Do NOT include `Co-Authored-By` lines.

## Working Guidelines

- Do not edit generated output in `dist/` by hand.
- Run `npm run typecheck` and `npm test` before considering any change complete.
- When changing public API exports, update both `src/index.ts` and `src/nostr/index.ts` as appropriate.
- `buildVaultConfigEvent` and `buildVaultShareEvent` intentionally return unencrypted content — the caller handles NIP-44. Do not change this contract.
- Epoch IDs use ISO 8601 week format `YYYY-Www` — do not introduce other formats.
- Keep `spec/protocol.md` in sync when protocol behaviour changes.

## Release Notes

- Automated via semantic-release — do NOT manually bump the version.
- `fix:` = patch, `feat:` = minor, `BREAKING CHANGE:` in commit body = major.
- CI runs lint, typecheck, build, and test across Node 20/22/24.
- GitHub Actions uses OIDC trusted publishing.
