# Contributing to Dominion Protocol

Thank you for your interest in contributing to Dominion. This document covers how to set up, develop, test, and submit changes.

## Getting Started

```bash
git clone https://github.com/forgesworn/dominion.git
cd dominion
npm install
npm test
```

## Development Commands

```bash
npm test            # Run all tests (vitest)
npm run test:watch  # Watch mode
npm run typecheck   # TypeScript type checking (tsc --noEmit)
npm run build       # Compile to dist/ (tsc)
npm run lint        # Biome linter check
npm run lint:fix    # Biome auto-fix
npm run clean       # Remove dist/
```

## Architecture

Dominion has a two-layer export design:

- **`dominion-protocol`** (main) -- Universal crypto primitives. No Nostr knowledge. Pure functions: data in, data out.
- **`dominion-protocol/nostr`** -- Nostr event builders and parsers. Returns unsigned, unencrypted events. The caller handles NIP-44 encryption and NIP-59 gift wrapping.

Source layout:

```
src/
  index.ts           -- Main entry (re-exports)
  content-keys.ts    -- HKDF-SHA256 content key derivation
  encrypt.ts         -- AES-256-GCM encrypt/decrypt
  shamir.ts          -- GF(256) Shamir secret sharing
  shamir-keys.ts     -- CK-specific split/reconstruct helpers
  config.ts          -- Immutable vault config mutations
  constants.ts       -- Protocol constants
  types.ts           -- TypeScript interfaces
  nostr/
    index.ts         -- Nostr layer entry (re-exports)
    vault-share.ts   -- Kind 30480 vault share builder/parser
    vault-config.ts  -- Kind 30078 vault config builder/parser
```

## Key Conventions

- All functions are **pure and synchronous**. No side effects, no async.
- `buildVaultShareEvent` and `buildVaultConfigEvent` return **unencrypted** content. The caller handles NIP-44 encryption.
- **British English** everywhere (colour, initialise, behaviour, licence, organise).
- Commit messages use `type: description` format (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`).
- Do NOT include `Co-Authored-By` lines in commits.

## Testing

Tests live in `tests/` and use Vitest. Each source module has a corresponding test file.

```bash
npm test                        # Run all tests
npx vitest run tests/encrypt    # Run a specific test file
```

## Submitting Changes

1. Fork the repository and create a feature branch from `main`.
2. Make your changes. Ensure `npm run lint`, `npm run typecheck`, and `npm test` all pass.
3. Write clear commit messages following the `type: description` convention.
4. Open a pull request against `main`.

## Versioning

This project uses [semantic-release](https://github.com/semantic-release/semantic-release). Version bumps are automated from commit messages:

- `feat:` -- minor version bump
- `fix:` -- patch version bump
- `feat!:` or `BREAKING CHANGE:` -- major version bump

Do NOT manually bump the version in `package.json`.

## Security

If you discover a security vulnerability, please report it privately rather than opening a public issue. Contact the maintainers via the repository's security advisories.

## Licence

By contributing, you agree that your contributions will be licenced under the MIT Licence.
