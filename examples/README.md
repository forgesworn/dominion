# Dominion Examples

Worked walkthroughs of the protocol in real shapes. Each one is a standalone TypeScript file you can run end to end with a single command.

## Examples

| File | Shape | What it shows |
|------|-------|---------------|
| [`basic-encryption.ts`](basic-encryption.ts) | Minimal | Derive a Content Key, encrypt a string, decrypt it back, derive a key for last week's epoch |
| [`tiered-access.ts`](tiered-access.ts) | Mutations | All the `DominionConfig` mutation helpers — add to tier, individual grants, revoke, un-revoke, remove grant |
| [`memory-vault.ts`](memory-vault.ts) | Family memory journal | Family tier with weekly rotation, photos encrypted as binary blobs, grandparent revoked. Forward-only revocation honestly demonstrated. |
| [`peer-support.ts`](peer-support.ts) | Private peer-support group | Custom `peer_support` tier with daily epochs (24h exposure window), peer joining mid-week, peer leaving mid-week, grant scope verified by assertion |
| [`signet-gated-vault.ts`](signet-gated-vault.ts) | Cross-protocol | A Muster-style host gates entry to a Dominion tier on a Signet Tier 3 professional credential from a trusted verifier. Three rejection paths verified: insufficient tier, subject mismatch, untrusted issuer. |

## Running an example

```bash
npm install
npm run build         # see "The dist/ trap" below
npx tsx examples/memory-vault.ts
```

`tsx` is invoked on the fly and does not need to be installed separately.

## The dist/ trap

The examples import from `'dominion-protocol'` rather than relative paths into `src/`. Self-references resolve via the package's `exports` field in `package.json`, which points at compiled output in `dist/`. **If you've edited `src/`, you must `npm run build` before re-running an example or you'll be running stale compiled code.**

The same applies to `signet-gated-vault.ts`, which also imports from `'signet-protocol'` — that resolves to the version in `node_modules/signet-protocol`, installed as a devDependency. No build step needed for the Signet side.

## What "works end to end" means

Each example is **self-verifying**: it uses `console.assert` at the cryptographic checkpoints (round-trip decrypt, grant scope, forward-only revocation). If an assertion fails, the example prints `Assertion failed: ...` and exits non-zero — which is how I caught a date-arithmetic mistake in the first draft of `peer-support.ts`. Run them after any change to `src/content-keys.ts`, `src/encrypt.ts`, `src/config.ts`, or the Nostr layer to catch regressions the unit tests miss.

## Adding new examples

Convention:

- Header docblock describing the use case in two sentences
- Numbered sections with `// ---` separators between them
- Comments explain *why*, not *what*
- British English
- `console.assert` at every cryptographic claim
- Import from `'dominion-protocol'` (or `'dominion-protocol/nostr'`), never from `'../src/...'`
- Pure synchronous code where possible; top-level `await` is fine for cross-package examples that need it

The biome lint config in `biome.json:26` deliberately excludes `examples/` from linting, so example files have more freedom in formatting choices than `src/` does.
