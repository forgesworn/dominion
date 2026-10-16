# Dominion Protocol

**Nostr:** [`npub1mgvlrnf5hm9yf0n5mf9nqmvarhvxkc6remu5ec3vf8r0txqkuk7su0e7q2`](https://njump.me/npub1mgvlrnf5hm9yf0n5mf9nqmvarhvxkc6remu5ec3vf8r0txqkuk7su0e7q2)

> Your content. Your keys. Your rules. No platform required.

[![npm](https://img.shields.io/npm/v/dominion-protocol)](https://www.npmjs.com/package/dominion-protocol)
[![CI](https://github.com/forgesworn/dominion/actions/workflows/ci.yml/badge.svg)](https://github.com/forgesworn/dominion/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-native-blue)](https://www.typescriptlang.org/)
[![GitHub Sponsors](https://img.shields.io/github/sponsors/TheCryptoDonkey?logo=githubsponsors&color=ea4aaa&label=Sponsor)](https://github.com/sponsors/TheCryptoDonkey)

[Protocol Spec](spec/protocol.md) · [NIP Draft](nip-draft.md) · [LLM Reference](llms.txt) · [Contributing](CONTRIBUTING.md)

<p align="center">
  <a href="docs/dominion-explainer.svg">
    <img src="docs/dominion-explainer.svg" alt="Dominion — interactive explainer (click to open)" width="700" />
  </a>
  <br />
  <em>Interactive explainer — <a href="docs/dominion-explainer.svg">open in browser</a> and click to advance</em>
</p>

## The Problem

Nostr content is either public or NIP-44 encrypted to specific recipients. There is no native mechanism for:

- **Audience tiers** — different groups seeing different content (family, close friends, subscribers)
- **Revocable access** — removing a recipient's ability to decrypt future content
- **Scalable encryption** — encrypting to hundreds of recipients without per-recipient encryption operations

Per-recipient NIP-44 encryption works for DMs but doesn't scale:

| Recipients | NIP-44 approach | Dominion |
|-----------|----------------|----------|
| 1 | 1 encryption | 1 encryption + 1 key share |
| 10 | 10 encryptions | 1 encryption + 10 key shares |
| 100 | 100 encryptions | 1 encryption + 100 key shares |
| 1,000 | 1,000 encryptions | 1 encryption + 1,000 key shares |

Content is encrypted once with an epoch-based Content Key. Only the lightweight key distribution scales with audience size.

## How It Works

Dominion introduces **vaults** — encrypted content containers on standard Nostr relays:

1. **Derive** a Content Key (CK) from your private key, the current epoch, and the tier
2. **Encrypt** your content with the CK (AES-256-GCM) and publish to any relay
3. **Distribute** the CK to each tier member via NIP-44 encrypted, NIP-59 gift-wrapped events
4. **Rotate** — new epoch, new CK. Revoked members don't get the new key

No custom relay software. No middleware. No platform. Just standard Nostr events and proven cryptography.

Combine with [nostr-attestations](https://github.com/forgesworn/nostr-attestations) to gate vault access on verified credentials (e.g. only verified professionals can decrypt tier-2 content).

## Use Cases

| Use case | How Dominion helps |
|----------|-------------------|
| Creator paywall | Encrypt to paying subscribers; revoke on cancellation |
| Family sharing | Private family tier; rotate keys weekly |
| Close friends | Share selectively without making content public |
| Institutional access | Tiered access with epoch-based key rotation (weekly by default) |
| Paid newsletters | One encryption operation, unlimited subscribers |

For scenarios requiring instant revocation (custody disputes, institutional SLA), the designed [warden relays extension](spec/extensions/warden-relays.md) provides true revocation using NIP-42 AUTH. The extension is on the post-v1.0 roadmap; v1.0 ships with forward-only revocation only.

## Install

```bash
npm install dominion-protocol
```

ESM-only. Requires Node.js 20.19+.

## Quick Start

The library expects every key as a 64-character lowercase hex string, for private keys and pubkeys alike. Content key derivation, the event builders and the parsers reject anything else, including `nsec` and `npub` values, so decode them first. The config helpers (`addToTier`, `revokePubkey` and the rest) do not validate pubkeys, so a malformed one is only caught later, when `parseVaultConfig` returns null. The examples use [nostr-tools](https://github.com/nbd-wtf/nostr-tools) for that and for the NIP-59 step. It is illustrative, not a dependency of this package.

### Set Up Keys

```typescript
import { nip19, getPublicKey } from 'nostr-tools';
import { bytesToHex } from 'nostr-tools/utils';

// Author: decode your nsec (or start from generateSecretKey() for a fresh key)
const decoded = nip19.decode(nsec);
if (decoded.type !== 'nsec') throw new Error('Expected an nsec');
const secretKey = decoded.data;                // Uint8Array
const privateKeyHex = bytesToHex(secretKey);   // 64-char hex: the input to deriveContentKey
const authorPubkey = getPublicKey(secretKey);  // 64-char hex

// Recipients (alicePubkey, bobPubkey, recipientPubkey, ...) are hex pubkeys too.
// For an npub, nip19.decode(npub).data is the hex key.
```

### Encrypt Content for a Tier

```typescript
import { deriveContentKey, getCurrentEpochId, encrypt, decrypt } from 'dominion-protocol';

// Derive this week's Content Key for the "family" tier
const epochId = getCurrentEpochId();  // e.g. "2026-W11"
const ck = deriveContentKey(privateKeyHex, epochId, 'family');

// Encrypt content — one operation regardless of audience size
const ciphertext = encrypt('Hello family!', ck);  // base64 string
const plaintext = decrypt(ciphertext, ck);         // "Hello family!"
```

### Manage Your Vault

```typescript
import { defaultConfig, addToTier, removeFromTier, revokePubkey } from 'dominion-protocol';

let config = defaultConfig();
config = addToTier(config, 'family', alicePubkey);
config = addToTier(config, 'close_friends', bobPubkey);  // creates the tier if it does not exist
config = revokePubkey(config, formerFriendPubkey);       // excluded from next rotation
```

### Distribute Keys via Nostr

```typescript
import { contentKeyToHex } from 'dominion-protocol';
import { buildVaultShareEvent } from 'dominion-protocol/nostr';
import { nip59 } from 'nostr-tools';

const ckHex = contentKeyToHex(ck);

// Build a kind 30480 vault share. Its content is the raw Content Key,
// so never publish it as it stands.
const share = buildVaultShareEvent(authorPubkey, recipientPubkey, ckHex, epochId, 'family');

// Seal (NIP-44) and gift-wrap (NIP-59), then publish `wrap` to the recipient's relays
const wrap = nip59.wrapEvent(share, secretKey, recipientPubkey);
```

### Receive a Share

```typescript
import { nip59 } from 'nostr-tools';
import { hexToBytes } from 'nostr-tools/utils';
import { decrypt } from 'dominion-protocol';
import { parseVaultShare } from 'dominion-protocol/nostr';

// `wrap` is the kind 1059 gift wrap addressed to you, `recipientSecretKey` your own secret key (Uint8Array)
const rumor = nip59.unwrapEvent(wrap, recipientSecretKey);  // the plain kind 30480 event
const shareData = parseVaultShare(rumor);                   // null if it is not a valid vault share
if (!shareData) throw new Error('Not a vault share');

const ck = hexToBytes(shareData.ckHex);
const plaintext = decrypt(ciphertext, ck);                  // ciphertext: encrypted content fetched from a relay; throws if the key is wrong
```

`parseVaultShare` expects the unwrapped event, not the gift wrap, and performs no signature or sender check. Confirm who sent the share before you trust `fromPubkey`.

### Rotate After a Revocation

```typescript
import { deriveContentKey, contentKeyToHex, getCurrentEpochId, revokePubkey } from 'dominion-protocol';
import { buildVaultShareEvent } from 'dominion-protocol/nostr';
import { nip59 } from 'nostr-tools';

// The epoch you last distributed keys for, from your own records (here, the epochId
// used above). The revoked member holds the keys for that epoch and every earlier one.
const lastDistributedEpochId = epochId;

config = revokePubkey(config, formerFriendPubkey);

// Revocation is forward-only: the revoked member keeps the keys they already hold.
// A key depends only on your private key, the epoch ID and the tier, so deriving one for
// the current epoch gives back the key the revoked member already holds.
// Rotate only once the current epoch differs from the last one you distributed.
const nextEpochId = getCurrentEpochId();
if (nextEpochId === lastDistributedEpochId) {
  console.log(`Still in ${nextEpochId}: run this again once the next epoch begins`);
} else {
  // e.g. "2026-W12": derive a fresh key per tier and send it only to the members who remain
  for (const [tier, members] of Object.entries(config.tiers)) {
    if (!Array.isArray(members)) continue;  // 'auto' tiers hold no list; resolve them in your app
    const nextCkHex = contentKeyToHex(deriveContentKey(privateKeyHex, nextEpochId, tier));
    for (const memberPubkey of members) {
      const share = buildVaultShareEvent(authorPubkey, memberPubkey, nextCkHex, nextEpochId, tier);
      const wrap = nip59.wrapEvent(share, secretKey, memberPubkey);
      // publish `wrap` to the member's relays
    }
  }
  // then record nextEpochId as your last distributed epoch
}
```

Run in the same epoch as the revocation, this sends nothing, which is correct: the revoked member keeps access until the epoch rolls over. Check on app load, as [spec/protocol.md](spec/protocol.md) recommends, or on a schedule. The snippet uses the weekly default; if you give tiers other lengths through `epochConfig`, pass each tier's length to `getCurrentEpochId` and compare per tier, because the library never reads `epochConfig` itself.

Individual grantees (`config.individualGrants`) sit outside the tier lists, so send them their shares separately. Persist the updated config with `buildVaultConfigEvent`, NIP-44 self-encrypted by you.

### Shamir Secret Sharing

Split Content Keys across multiple parties or relays for redundancy:

```typescript
import { splitCK, reconstructCK, encodeCKShare, decodeCKShare } from 'dominion-protocol';

const shares = splitCK(ck, 2, 3);           // 2-of-3 threshold
const encoded = shares.map(encodeCKShare);   // ["1:ab12...", "2:cd34...", "3:ef56..."]

const decoded = encoded.slice(0, 2).map(decodeCKShare);
const recovered = reconstructCK(decoded);    // original CK
```

## Architecture

Two-layer exports — use what you need:

- **`dominion-protocol`** — universal crypto primitives. Pure functions, zero Nostr knowledge. Works anywhere.
- **`dominion-protocol/nostr`** — Nostr event builders and parsers. Returns unsigned, unencrypted events. The caller handles NIP-44 encryption and NIP-59 gift wrapping.

### Cryptography

| Primitive | Implementation |
|-----------|---------------|
| Key derivation | HKDF-SHA256 (`@noble/hashes`) |
| Content encryption | AES-256-GCM, 12-byte random IV (`@noble/ciphers`) |
| Secret sharing | Shamir over GF(256), irreducible polynomial 0x11b (`@forgesworn/shamir-core`) |
| Epoch format | ISO 8601 weeks (`YYYY-Www`) by default; daily (`YYYY-MM-DD`) and monthly (`YYYY-MM`) via a `length` argument |

### Nostr Integration

| Kind | Type | Purpose |
|------|------|---------|
| 30480 | Parameterised replaceable | Vault share — epoch CK for a specific recipient |
| 30078 | NIP-78 app-specific data | Vault config — self-encrypted tier memberships |

Built on NIP-01, NIP-09, NIP-44, NIP-59, and NIP-78. No new cryptographic primitives. The library does not set NIP-40 `expiration` tags, so keys do not expire on their own; access ends when you stop distributing keys for new epochs.

## Protocol Spec

See [spec/protocol.md](spec/protocol.md) for the full v1.0 protocol specification: epoch rotation, tier management, individual grants, revocation, and Lightning-gated access (a spec-only flow: the library has no Lightning API, and your application confirms payment before distributing a key). Designed extensions live in [spec/extensions/](spec/extensions/), currently warden relays (instant revocation) and quantum vault (post-quantum CK derivation).

## Part of the ForgeSworn Toolkit

[ForgeSworn](https://forgesworn.dev) builds open-source cryptographic identity, payments, and coordination tools for Nostr.

| Library | What it does |
|---------|-------------|
| [nsec-tree](https://github.com/forgesworn/nsec-tree) | Deterministic sub-identity derivation |
| [ring-sig](https://github.com/forgesworn/ring-sig) | SAG/LSAG ring signatures on secp256k1 |
| [range-proof](https://github.com/forgesworn/range-proof) | Pedersen commitment range proofs |
| [canary-kit](https://github.com/forgesworn/canary-kit) | Coercion-resistant spoken verification |
| [spoken-token](https://github.com/forgesworn/spoken-token) | Human-speakable verification tokens |
| [toll-booth](https://github.com/forgesworn/toll-booth) | L402 payment middleware |
| [geohash-kit](https://github.com/forgesworn/geohash-kit) | Geohash toolkit with polygon coverage |
| [nostr-attestations](https://github.com/forgesworn/nostr-attestations) | NIP-VA verifiable attestations |
| [dominion](https://github.com/forgesworn/dominion) | Epoch-based encrypted access control |
| [nostr-veil](https://github.com/forgesworn/nostr-veil) | Privacy-preserving Web of Trust |

## Licence

[MIT](LICENSE)

## Support

For issues and feature requests, see [GitHub Issues](https://github.com/forgesworn/dominion/issues).

If you find Dominion useful, consider sending a tip:

- **Lightning:** `thedonkey@strike.me`
- **Nostr zaps:** `npub1mgvlrnf5hm9yf0n5mf9nqmvarhvxkc6remu5ec3vf8r0txqkuk7su0e7q2`
