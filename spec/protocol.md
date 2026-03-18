# The Dominion Protocol

**Epoch-Based Encrypted Content Access for Nostr**

**Version:** 0.1.0 (Draft)
**Date:** 2026-03-04
**Status:** Draft specification — seeking community feedback
**Licence:** MIT

---

## Abstract

Dominion is an open protocol for decentralised, tiered, revocable content access on Nostr. It enables content authors to encrypt data with epoch-based Content Keys (CKs) and distribute those keys to defined audiences via gift-wrapped Nostr events — without requiring any central authority, custom relay software, or new cryptographic primitives.

The protocol defines epoch-based key derivation, AES-GCM content encryption, gift-wrapped key distribution, audience tiers, and two Nostr event kinds. Any Nostr client can implement Dominion. Any content type can be vault-encrypted.

**Tiered encrypted content for the open social web. Paywalls, private groups, and revocable access — all on standard Nostr relays.**

---

## Table of Contents

1. [Motivation](#1-motivation)
2. [Design Principles](#2-design-principles)
3. [Core Concepts](#3-core-concepts)
4. [Epoch Content Keys](#4-epoch-content-keys)
5. [Content Encryption](#5-content-encryption)
6. [Key Distribution](#6-key-distribution)
7. [Audience Tiers](#7-audience-tiers)
8. [Revocation](#8-revocation)
9. [Event Kinds](#9-event-kinds)
10. [Metadata Privacy](#10-metadata-privacy)
11. [Performance](#11-performance)
12. [Lightning-Gated Access](#12-lightning-gated-access)
13. [Warden Relays — Optional Upgrade](#13-warden-relays--optional-upgrade)
14. [Alignment with Existing NIPs](#14-alignment-with-existing-nips)
15. [Quantum Vault](#15-quantum-vault)
16. [Use Cases](#16-use-cases)
17. [Limitations](#17-limitations)
18. [Reference Implementation](#18-reference-implementation)

---

## 1. Motivation

### The Access Control Gap on Nostr

Nostr content is either public or NIP-44 encrypted to specific recipients. There is no middle ground. Once a recipient has a decryption key, access cannot be revoked — the best you can do is stop issuing new keys. There is no mechanism for:

- **Audience-level access tiers** — "friends", "close friends", "family", each seeing different content
- **Revocable access** — remove someone's ability to decrypt future content
- **Paid content** — subscription-based access with revocation on non-payment
- **Scalable encryption** — encrypting to 500 followers without 500 separate NIP-44 operations

### For Creators

Every creator on Nostr who wants to gate content today has no native primitive. Zaps are tips, not access control. There's no Patreon-equivalent that works without a platform taking a cut.

### For Communities

Encrypted group communication on Nostr is unsolved at scale. Existing approaches (NIP-44 to each member) don't support tiers, revocation, or group membership changes without re-encrypting everything.

### For Families

Parents sharing children's learning journals, photos, or milestones need granular control: full access for co-parents, limited access for grandparents, time-bounded access for teachers, and the ability to revoke any of these.

### The Scalability Problem

Per-recipient encryption (NIP-44 to each person) works for DMs but doesn't scale:

| Recipients | NIP-44 approach | Dominion approach |
|-----------|----------------|-----------------|
| 1 | 1 encryption | 1 encryption + 1 key share |
| 10 | 10 encryptions | 1 encryption + 10 key shares |
| 100 | 100 encryptions | 1 encryption + 100 key shares |
| 1,000 | 1,000 encryptions | 1 encryption + 1,000 key shares |

Content is encrypted once. Only the lightweight key distribution scales with audience size.

---

## 2. Design Principles

1. **One key per epoch, not per item.** A Content Key covers a time period (e.g. one week). Fifty posts in a week all use the same CK. This is what makes the system scale.

2. **Deterministically derived.** CKs are derived from the author's private key material using HKDF. The author can always re-derive any CK — no key database to lose.

3. **Standard relays only (by default).** The default path uses only standard Nostr relays and existing NIPs (NIP-44, NIP-59). No custom relay software required.

4. **Separation of content and access.** Encrypted content propagates freely on any relay. Key distribution is a separate concern. Change who can decrypt without touching the content.

5. **Forward-only revocation is good enough.** Stop distributing keys for new epochs. With weekly rotation, a revoked recipient loses access within 7 days. This matches how every E2E encrypted system works.

6. **Progressive sovereignty.** Users start with managed infrastructure and can graduate to self-hosted or pure Nostr distribution. No lock-in at any level.

7. **Nostr-native.** Built on secp256k1. Uses existing Nostr event infrastructure. Encrypted events are standard Nostr events — any relay stores them, any client can learn to decrypt them.

8. **Algorithm agility.** Events are tagged with the asymmetric algorithm used for signing and key agreement (`['algo', 'secp256k1']`). When post-quantum algorithms become available, implementations can produce and consume events with different algorithm tags without breaking backward compatibility.

---

## 3. Core Concepts

### How It Works

```
Author                                    Recipient
  │                                          │
  ├─ Derive epoch CK from private key        │
  ├─ Encrypt content with CK (AES-GCM)       │
  ├─ Publish encrypted event to relay         │
  ├─ Gift-wrap CK to each recipient ─────────┤
  │                                          ├─ Unwrap gift → get CK
  │                                          ├─ Fetch encrypted event
  │                                          └─ Decrypt with CK
  │
  ├─ Next epoch: derive new CK
  ├─ Distribute to current recipients
  └─ Skip revoked recipients ─── revoked user can't decrypt new content
```

### Key Insight

Content is encrypted **once** with an epoch-based Content Key. The CK is then distributed to recipients via gift-wrapped events. This separates the encryption operation (one-time) from the access control operation (per-recipient).

### Terminology

| Term | Definition |
|------|-----------|
| **Content Key (CK)** | A 256-bit AES key used to encrypt content for a specific epoch |
| **Epoch** | A time period (default: one ISO week) during which a single CK is used |
| **Epoch ID** | An identifier for the epoch, format: `YYYY-Www` (e.g. `2026-W09`) |
| **Vault share** | A gift-wrapped event containing a CK, sent to a specific recipient |
| **Tier** | An audience level (e.g. family, connections, public) that determines CK distribution |
| **Vault config** | A self-encrypted event storing the author's tier memberships and settings |

---

## 4. Epoch Content Keys

### Derivation

CKs are derived deterministically using HKDF-SHA256:

```
CK = HKDF-SHA256(
    ikm  = author's 32-byte private key (or key derived from mnemonic),
    salt = "vaulstr-ck-v1",
    info = "epoch:{epoch_id}:tier:{tier_name}",
    len  = 32
)
```

### Epoch ID Format

Epochs use ISO 8601 week format: `YYYY-Www`

| Example | Meaning |
|---------|---------|
| `2026-W09` | Week 9 of 2026 (24 Feb – 2 Mar) |
| `2026-W10` | Week 10 of 2026 (3 Mar – 9 Mar) |

### Why Deterministic?

- **No key database.** The author's private key material is the only backup needed. Lose your device? Re-derive all CKs from your key.
- **Re-provisioning is cheap.** If vault infrastructure changes, re-derive CKs and re-distribute. No migration of key material.
- **Offline derivation.** CKs can be derived without network access. An offline author can encrypt content and distribute keys later.

### Epoch Length

Epoch length is configurable per tier:

| Tier | Suggested epoch | Exposure window | Rationale |
|------|----------------|-----------------|-----------|
| High trust (family) | Monthly | 30 days | Low churn, high trust |
| Moderate trust (connections) | Weekly | 7 days | Balanced |
| Low trust (individual grants) | Daily | 24 hours | Tight exposure window |

Implementations SHOULD default to weekly epochs. Implementations MAY support per-tier epoch configuration.

---

## 5. Content Encryption

### Algorithm

All content is encrypted with AES-256-GCM using the epoch CK.

### Ciphertext Format

```
content = base64(iv || ciphertext || tag)
```

| Component | Size | Notes |
|-----------|------|-------|
| IV | 12 bytes | Random, unique per encryption |
| Ciphertext | Variable | AES-GCM encrypted content |
| Tag | 16 bytes | Authentication tag (appended by AES-GCM) |

### Event Tagging

Encrypted events MUST include a `vault` tag identifying the epoch:

```json
["vault", "<epoch_id>"]
```

This tells recipients which CK to use for decryption. Events without a `vault` tag are either plaintext or use other encryption schemes (e.g. NIP-44).

Example encrypted event:

```jsonc
{
  "kind": 30078,
  "pubkey": "<author_pubkey>",
  "tags": [
    ["d", "journal-entry-2026-03-04"],
    ["vault", "2026-W10"],
    // ... other tags
  ],
  "content": "dGhpcyBpcyBiYXNlNjQgZW5jb2RlZCBjaXBoZXJ0ZXh0..."  // base64(iv || ciphertext || tag)
}
```

### Media Encryption

Binary content (images, video, documents) follows the same pattern:

1. Compress media client-side (before encryption — server-side transcoding can't work on ciphertext)
2. Encrypt with epoch CK (AES-256-GCM)
3. Upload encrypted blob to a content-addressed server (e.g. Blossom)
4. Embed the hash in the Nostr event

The content-addressed server stores only opaque ciphertext. It never sees plaintext.

### Migration

Events encrypted with Dominion coexist with plaintext and NIP-44 encrypted events on the same relays. No batch migration is needed — new content uses Dominion, old content remains readable via its original method.

---

## 6. Key Distribution

### Gift-Wrapped CK Shares (Default)

CKs are distributed to recipients using NIP-59 gift-wrapping:

```
Distribution Flow:

  Author                          Recipient
    │                                │
    ├─ Derive CK for epoch           │
    │                                │
    ├─ For each recipient:           │
    │   ├─ Create kind 30480 event   │
    │   │   (contains hex CK)        │
    │   ├─ NIP-44 encrypt to         │
    │   │   recipient's pubkey       │
    │   ├─ Seal in kind 13           │
    │   └─ Gift-wrap in kind 1059 ───┤
    │                                ├─ Unwrap kind 1059
    │                                ├─ Decrypt kind 13
    │                                ├─ Read kind 30480
    │                                └─ Extract CK
    │
    ├─ Publish to standard relays
    └─ Done
```

### Grant Scope

**A grant distributes the current epoch's CK only.** When granting access to a new recipient:

- Only the current epoch CK is sent — never historical keys
- An accidental grant exposes at most one epoch of content
- Granting historical access is a separate, explicit action (send specific past epoch CKs)
- New recipients see content from the grant date forward, not the entire history

### Epoch Rotation

When a new epoch begins:

1. Derive the new epoch CK
2. Auto-distribute to all current tier members and individual grantees
3. Skip revoked pubkeys
4. Update local state to track the last distributed epoch

Implementations SHOULD trigger rotation on app load when the current epoch differs from the last distributed epoch.

---

## 7. Audience Tiers

Dominion supports Facebook-style audience tiers on a decentralised platform:

| Tier | Who receives CK | Distribution |
|------|-----------------|-------------|
| **Public** | Everyone | No encryption needed — standard plaintext event |
| **Connections** | Mutual follows or curated list | Auto-distribute on epoch rotation |
| **Close friends** | Curated list | Auto-distribute on epoch rotation |
| **Family** | Explicitly managed list | Auto-distribute on epoch rotation |
| **Private** | Self only | No distribution — author-only journaling |

### Individual Grants

Independent of tiers. An author can grant CK access to any specific pubkey:

- Stored as individual entries in vault config
- Same gift-wrap distribution mechanism
- Useful for: sharing with a specific person not in any tier, time-bounded access for a professional

### Tier Membership

Tier memberships are stored in the author's vault configuration event (NIP-78, kind 30078), self-encrypted. Tier changes take effect at the next epoch rotation:

- **Add member:** distribute current epoch CK immediately + include in future rotations
- **Remove member:** stop distributing at next epoch rotation (forward-only revocation)

### Per-Tier Epochs

Different tiers can use different epoch lengths. The CK derivation includes the tier:

```
CK = HKDF-SHA256(
    ikm  = author's private key,
    salt = "vaulstr-ck-v1",
    info = "epoch:{epoch_id}:tier:{tier_name}",
    len  = 32
)
```

This means the family tier CK and the connections tier CK are different keys, even for the same epoch. Content encrypted for the family tier cannot be decrypted by someone who only has the connections tier CK.

---

## 8. Revocation

### Forward-Only (Default)

Revocation is forward-only: stop distributing CKs for new epochs to the revoked recipient.

| Epoch length | Max exposure after revocation |
|-------------|-------------------------------|
| Daily | 24 hours |
| Weekly | 7 days |
| Monthly | 30 days |

The revoked recipient retains any epoch CKs they already received. Content from those epochs remains accessible if they cached the key. This is the same model as every E2E encrypted system (Signal, WhatsApp, Matrix).

### Revocation List

Revoked pubkeys are tracked in the vault configuration event (NIP-78, kind 30078). During epoch rotation, the distribution loop skips any pubkey in the revocation list.

### True Revocation (Optional — Warden Relays)

For users who need instant revocation (custody disputes, institutional access, paid content with immediate cancellation), optional warden relay infrastructure provides true revocation. See [Section 13](#13-warden-relays--optional-upgrade).

### Why Forward-Only Is Good Enough

1. **Weekly epochs cap exposure at 7 days.** Most real-world scenarios don't need instant revocation.
2. **Grant = current epoch only.** An accidental grant exposes at most one epoch.
3. **Daily epochs available.** For low-trust individual grants, daily rotation gives a 24-hour window.
4. **No special infrastructure.** Forward-only revocation works on standard Nostr relays with no custom software.

---

## 9. Event Kinds

**Note:** Kind numbers are proposals pending NIP allocation.

### Kind 30480 — Vault Share

A parameterised replaceable event containing an epoch CK for a specific recipient. Distributed via NIP-59 gift-wrapping for metadata privacy.

```jsonc
{
  "kind": 30480,
  "pubkey": "<author_pubkey>",
  "created_at": 1709000000,
  "tags": [
    ["d", "2026-W10:family"],              // epoch ID + tier
    ["p", "<recipient_pubkey>"],          // who this share is for
    ["tier", "family"],                   // which audience tier (optional)
    ["algo", "secp256k1"],               // asymmetric algorithm (for future quantum migration)
    ["L", "dominion"],                     // protocol namespace label
    ["l", "share", "dominion"]             // protocol label
  ],
  "content": "<hex-encoded epoch CK>"     // 32 bytes = 64 hex chars
}
```

**Distribution:** This event is NIP-44 encrypted to the recipient's pubkey, sealed in a kind 13 event, and gift-wrapped in a kind 1059 event (NIP-59). The recipient unwraps the gift to extract the CK.

**Client behaviour:**

- On receiving a kind 30480 (via gift-wrap unwrapping), extract the CK and cache it locally
- Use the `d` tag (epoch ID) to match against `vault` tags on encrypted events
- A newer event for the same `d` tag replaces the previous one (parameterised replaceable)

### NIP-78 (Kind 30078) — Vault Configuration

A NIP-78 app-specific data event storing the author's vault settings. Self-encrypted (NIP-44 to own pubkey) — only the author can read it. Uses NIP-78 (kind 30078) with a namespaced `d` tag instead of a custom kind.

```jsonc
{
  "kind": 30078,
  "pubkey": "<author_pubkey>",
  "tags": [
    ["d", "dominion:vault-config"],
    ["encrypted", "nip44"],
    ["algo", "secp256k1"],
    ["L", "dominion"],
    ["l", "config", "dominion"]
  ],
  "content": "<NIP-44 self-encrypted JSON>"
}
```

**Decrypted payload:**

```jsonc
{
  "tiers": {
    "family": ["<pubkey1>", "<pubkey2>"],
    "connections": "auto",                    // auto = mutual follows
    "close_friends": ["<pubkey3>", "<pubkey4>"]
  },
  "individualGrants": [
    {
      "pubkey": "<pubkey5>",
      "label": "Maths tutor",                // human-readable label
      "grantedAt": 1709000000                 // unix timestamp
    }
  ],
  "revokedPubkeys": ["<pubkey6>"],
  "epochConfig": {
    "family": "monthly",
    "connections": "weekly",
    "close_friends": "weekly",
    "individual": "daily"
  },
  "blossomUrl": "https://blossom.example.com"  // optional media server
}
```

**Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `tiers` | Object | Maps tier names to member lists. `"auto"` means derive from mutual follows. Note: programmatically adding a pubkey to an `"auto"` tier converts it to an explicit list, permanently replacing the auto-derivation behaviour. Implementing applications should guard against unintentional conversion. |
| `individualGrants` | Array | One-off grants to specific pubkeys, independent of tiers. |
| `revokedPubkeys` | Array | Pubkeys to skip during CK distribution. |
| `epochConfig` | Object | Per-tier epoch length. Values: `"daily"`, `"weekly"`, `"monthly"`. |
| `blossomUrl` | String | Optional content-addressed media server URL. |

### Tags on Encrypted Content Events

Any Nostr event encrypted with Dominion includes:

```json
["vault", "<epoch_id>"]
```

Clients use this tag to determine which CK is needed. If the client has the CK (received via kind 30480), it decrypts. If not, the content is inaccessible.

---

## 10. Metadata Privacy

### The Problem with NIP-44

With standard NIP-44 encrypted events, the content relay sees:

- Author pubkey
- Recipient pubkey (in `p` tags or gift-wrap)
- Timing of publication
- Size and frequency patterns

A single relay has the full social graph of who communicates with whom.

### How Dominion Improves This

Dominion splits knowledge across different entities:

| Entity | Sees | Does NOT see |
|--------|------|-------------|
| Content relay | Author pubkey, ciphertext, timing | Recipients (no `p` tags on content) |
| Gift-wrap relay | Outer gift-wrap metadata | Inner content, CK, tier info |
| Recipient | CK, decrypted content | Other recipients' CKs |

No single relay sees the full picture. The content relay doesn't know who can decrypt. The relay carrying gift-wrapped shares doesn't know what content they unlock.

### Content Events Are Clean

Vault-encrypted events contain no recipient information:

```jsonc
{
  "kind": 30078,
  "pubkey": "<author>",
  "tags": [
    ["d", "some-identifier"],
    ["vault", "2026-W10"]       // only epoch ID, no recipients
  ],
  "content": "<base64 ciphertext>"
}
```

Recipients are managed entirely through the separate gift-wrap channel. Adding or removing recipients doesn't touch the content event.

---

## 11. Performance

### Overhead

| Operation | Without Dominion | With Dominion | Delta |
|-----------|----------------|-------------|-------|
| Publish | Encrypt + POST | Encrypt + POST + distribute CK shares | +10–20ms per recipient |
| Read (first in session) | Fetch + decrypt | Fetch + unwrap gift + decrypt | +20–50ms (one-time) |
| Read (cached) | Fetch + decrypt | Fetch + decrypt (CK cached) | ~0ms |
| Revoke | N/A | Update vault config | <10ms |

### Optimisations

- **Session CK cache.** Once a CK is unwrapped, cache it locally. All subsequent reads in the same epoch are instant.
- **High cache hit rate.** One CK per epoch means a user reading 50 posts from the same week unwraps 1 gift, not 50.
- **Background prefetch.** When loading a feed, prefetch CKs for visible epochs in the background. By the time the user scrolls, CKs are cached.
- **Batch distribution.** When granting a new recipient, batch all epoch shares into a single session.

### Realistic User Experience

First load of a vault-encrypted feed: ~50ms overhead (one-time CK unwrap). Every subsequent load in the same session: indistinguishable from unencrypted content. Most users will never notice the encryption layer exists.

---

## 12. Lightning-Gated Access

The epoch-based architecture maps naturally to paid content:

### Subscription Model

```
Buyer pays Lightning invoice
         │
         ▼
Author's service confirms payment
         │
         ▼
Distribute current epoch CK to buyer (gift-wrapped)
         │
         ▼
Buyer decrypts vault-encrypted content
         │
         ▼
Next epoch: payment due again
  ├─ Paid → distribute new CK
  └─ Not paid → skip distribution → access stops
```

### What This Enables

| Use case | How it works |
|----------|-------------|
| **Decentralised Patreon** | Creator tiers → vault tiers. Subscribers get CKs. No platform cut. |
| **Paid newsletters** | Vault-encrypted articles on Nostr relays. Subscribe = get epoch keys. |
| **Course access** | Educator encrypts curriculum. Students pay per term (per epoch). |
| **Pay-per-article** | Single-epoch grant on payment. One Lightning payment → one CK. |
| **Supporter content** | "Supporters" tier. Lightning payment → tier membership → CK distribution. |

### Why This Is Better Than Zaps

Zaps are tips after the fact. Vault gating is access control before the fact. The content is genuinely encrypted — there's no "view source" workaround.

### Regulatory Note

Dominion is a key distribution protocol, not a payment processor. It must never custody, route, or intermediate funds. In a Lightning-gated access flow, payment occurs directly between the subscriber and the content creator's Lightning node. Dominion's only role is distributing the content key after the implementing application confirms payment externally. Any regulatory obligations arising from content monetisation (consumer rights, digital content directives, VAT on digital services) are the responsibility of the implementing application, not the Dominion protocol.

---

## 13. Warden Relays — Optional Upgrade

For users who need **true instant revocation** (not forward-only), optional warden relay infrastructure provides it.

### What Warden Relays Do

A warden relay is an AUTH-gated key-value store that:

1. Stores CK shares (optionally Shamir-split) keyed by recipient pubkey
2. Serves shares only to authenticated matching pubkeys (NIP-42)
3. Honours DELETE requests from the content author
4. Stores only encrypted key material — never content

### True Revocation Flow

```
Author sends DELETE to warden relays
         │
         ▼
Warden relays remove recipient's shares
         │
         ▼
Recipient can no longer retrieve CK
         │
         ▼
Content on content relays is unaffected (still encrypted)
```

### Shamir Secret Sharing (M-of-N)

For redundancy and privacy, CKs can be Shamir-split across multiple warden relays:

| Configuration | Meaning |
|--------------|---------|
| 1-of-1 | Single warden relay. Simple. |
| 2-of-3 | Any 2 of 3 relays can reconstruct CK. Tolerates 1 relay failure. |
| 3-of-5 | Any 3 of 5 relays. Tolerates 2 failures. Better privacy. |

The recipient authenticates to M relays, retrieves M shares, and reconstructs the CK locally.

### Content and Vault Separation

Content relays and warden relays are separate concerns:

| Relay type | Stores | Knows |
|-----------|--------|-------|
| Content relay | Encrypted content blobs | Author pubkey, ciphertext |
| Warden relay | Encrypted CK shares | Recipient pubkey, share requests |

No single relay sees both content and recipients. This is a strict metadata privacy improvement.

### Progressive Sovereignty

| Level | Key distribution | Revocation | Who controls |
|-------|-----------------|------------|-------------|
| **Managed** | Provider-hosted warden relay | True, instant | Provider |
| **Self-hosted** | User's own warden relay | True, instant | User |
| **Pure Nostr** | Gift-wrapped on standard relays | Forward-only (max 1 epoch) | User, fully sovereign |

Switchable in either direction, per-epoch. No lock-in.

### When to Use Warden Relays

| Scenario | Gift-wrap (default) | Warden relay |
|----------|-------------------|-------------|
| Creator paywall | Sufficient | Overkill |
| Private family sharing | Sufficient | Overkill |
| Custody dispute with hostile co-parent | Insufficient | Recommended |
| Institutional access with SLA | Insufficient | Recommended |
| Paid content with instant cancellation | Insufficient | Recommended |

---

## 14. Alignment with Existing NIPs

Dominion builds on existing Nostr primitives and introduces minimal new surface area.

| NIP | Relevance | How Dominion Uses It |
|-----|-----------|-------------------|
| **NIP-01** | Basic protocol | Vault-encrypted events are standard Nostr events stored on any NIP-01 relay |
| **NIP-44** | Versioned encryption | CK shares are NIP-44 encrypted to recipients; vault config is NIP-44 self-encrypted |
| **NIP-59** | Gift wrapping | CK distribution uses NIP-59 gift-wrapped events for metadata privacy |
| **NIP-42** | Authentication | Warden relays (optional) use NIP-42 AUTH to verify recipient identity |
| **NIP-09** | Event deletion | Warden relays honour deletion requests to support true revocation |

### New Surface Area

| New element | Type | Purpose |
|-------------|------|---------|
| Kind 30480 | Parameterised replaceable event | CK share distribution |
| Kind 30078 (NIP-78) | App-specific data | Vault configuration (self-encrypted, `d: dominion:vault-config`) |
| `["vault", "<epoch_id>", "<tier>"]` tag | Content event tag | Signals Dominion encryption, epoch, and tier for CK lookup |
| `["algo", "<algorithm>"]` tag | Protocol event tag | Identifies asymmetric algorithm (default: `secp256k1`). Enables post-quantum migration. |
| `["L", "dominion"]` / `["l", "...", "dominion"]` | Label tags | Protocol namespace |

### Interoperability

Any Nostr client can add Dominion decryption support with:

1. Gift-wrap unwrapping (NIP-59) — ~50 lines
2. AES-256-GCM decryption (WebCrypto) — ~30 lines
3. Epoch CK caching — ~20 lines

Total: approximately 100 lines of code to read vault-encrypted content. The hard part (key derivation, distribution, tier management) is handled by the publishing client.

---

## 15. Quantum Vault

### The Problem

Dominion derives Content Keys deterministically: `CK = HKDF(nostr_private_key, epoch, tier)`. The symmetric layer (AES-256-GCM, HKDF, Shamir) is quantum-resistant, but the Nostr private key is secp256k1 — vulnerable to Shor's algorithm. A quantum attacker who cracks the private key can re-derive every CK ever produced, decrypting all vault content.

Migrating to a post-quantum Nostr identity in the future does not protect historical data — the old public key remains visible on relays.

### The Solution

A **Vault Master Key (VMK)** decouples CK derivation from the Nostr private key:

```
CK = HKDF(vmk, epoch, tier)   // VMK is random, not derived from secp256k1
```

The VMK is encrypted with ML-KEM-768 (NIST FIPS 203) and stored in the vault config. Even if a quantum attacker cracks the Nostr key and reads the NIP-44 self-encrypted config, the VMK inside is ML-KEM protected — unbreakable by quantum computers.

### Vault Config Extension

```jsonc
{
  "tiers": { ... },
  "quantumVault": {
    "version": 1,
    "algorithm": "ml-kem-768",
    "publicKey": "<base64, 1184 bytes>",
    "encapsulation": "<base64, 1088 bytes>",
    "encryptedVmk": "<base64, AES-256-GCM encrypted VMK>",
    "activatedAt": 1709000000,
    "activatedEpoch": "2026-W10"
  }
}
```

### How It Works

**Setup (once):**

1. Generate random 32-byte VMK
2. Generate ML-KEM-768 keypair
3. Encapsulate against public key → shared secret
4. AES-256-GCM encrypt VMK with shared secret
5. Store `QuantumVault` in vault config; store VMK and ML-KEM secret key locally

**CK derivation (every epoch):**

```
deriveContentKey(vmkHex, epochId, tier)   // same function, VMK instead of privkey
```

**Recovery (new device):**

1. Decrypt vault config (NIP-44)
2. Decapsulate ML-KEM ciphertext with secret key → shared secret
3. Decrypt VMK with shared secret
4. Resume CK derivation

### Overhead

| Metric | Value |
|--------|-------|
| Storage in vault config | ~3.3 KB |
| ML-KEM keygen | ~50 μs |
| ML-KEM encapsulate/decapsulate | ~60–70 μs |
| CK derivation change | Zero — same HKDF function |
| Recipient-side change | Zero — CKs still distributed via gift-wrap |

### Backward Compatibility

- `quantumVault` is an optional field. Old configs work unchanged.
- `activatedEpoch` marks the boundary: pre-activation content uses privkey-derived CKs, post-activation uses VMK-derived CKs.
- Recipients are unaffected — they receive CKs via gift-wrap regardless of derivation method.

---

## 16. Use Cases

### Creator Economy

| Platform disrupted | What Dominion replaces | Why it's better |
|-------------------|----------------------|----------------|
| **Patreon** | Subscription tiers | Creator holds keys, not platform. No 5–12% cut. No deplatforming. |
| **Substack** | Paid newsletter access | Vault-encrypted posts on Nostr relays. Cancel = stop distributing CKs. |
| **Gumroad** | Digital product delivery | One-time epoch CK grant = purchase receipt. Content on Blossom. |
| **Ko-fi** | Supporter-only content | "Supporters" vault tier. Lightning triggers CK distribution. |

### Communication

| Platform disrupted | What Dominion replaces | Why it's better |
|-------------------|----------------------|----------------|
| **Discord** | Role-based channel access | Vault tiers = roles. No central server. Revoke = stop epoch keys. |
| **Telegram groups** | Admin-managed groups | Vault tiers replace admin kicks. Cryptographic, not policy-based. |
| **Signal groups** | Encrypted group messaging | Vault adds tiered access and revocation. Signal has neither. |

### Collaboration

| Platform disrupted | What Dominion replaces | Why it's better |
|-------------------|----------------------|----------------|
| **Google Workspace** | Shared docs with access control | Vault-encrypted files. No provider reading your data. |
| **Notion** | Workspace sharing | Vault-encrypted knowledge base. Tiers = team/org/public. |

### Existing Nostr Apps (Immediate Adopters)

| App | Current limitation | Dominion solution |
|-----|-------------------|-----------------|
| **Habla / Yakihonne** | No native paywall | Vault-gated articles. Tier = paid subscribers. |
| **0xChat** | Manual group admin | Vault tiers replace admin-managed groups. |
| **Zap.stream** | Streams are all-or-nothing | Epoch keys gate stream decryption per subscriber level. |
| **Coracle / Snort** | All content public or DM | "Connections" tier = content visible only to mutual follows. |

### Industry Applications

| Industry | Use case | How Dominion helps |
|----------|----------|------------------|
| **Healthcare** | Patient records shared with providers | Epoch rotation = automatic access expiry for consultants |
| **Legal** | Client-privileged documents | M-of-N warden relays for law firm dissolution |
| **Journalism** | Source protection, embargo management | Dead man's switch, time-locked epoch key release |
| **Academic** | Peer review, research collaboration | Vault-encrypted datasets, revocable on departure |
| **HR** | Employee records, offboarding | Stop distributing epoch keys = clean access removal |

### Novel Primitives

| Primitive | Description |
|-----------|-------------|
| **Dead man's switch** | Auto-publish epoch keys if author fails to rotate on schedule |
| **Time-locked content** | Distribute CKs on a predetermined future schedule |
| **Progressive disclosure** | Unlock content as users meet criteria (payment, reputation, completion) |
| **DAO governance** | Proposals visible only to token holders; votes encrypted until tally |
| **Escrow-based access** | CK released on Lightning payment confirmation — no trusted intermediary |
| **Reputation-gated access** | Tier membership based on web-of-trust score or proof-of-work |

### Bitcoin & Lightning Native

| Use case | How Dominion helps |
|----------|------------------|
| **OTC trading desks** | Vault-encrypted order books. Tier = verification level. |
| **Mining pool coordination** | Operational data shared with members, revocable on exit. |
| **Lightning channel backups** | Encrypted on Blossom, vault-shared with backup contacts. |
| **Collaborative custody** | M-of-N vault shares map to multisig-style patterns. |

---

## 17. Limitations

| Limitation | Why it's acceptable |
|-----------|-------------------|
| **Forward-only revocation by default** | Weekly epochs cap exposure at 7 days. True revocation available via warden relays for users who need it. Same model as Signal/WhatsApp. |
| **CK cached by recipient** | A recipient who caches a CK retains access to that epoch's content forever. This is inherent to all E2E systems — you can't un-show someone a message. |
| **Epoch granularity** | Access is per-epoch, not per-event. All content in an epoch shares one CK. For per-event access control, use NIP-44 directly. |
| **Author must be online to distribute** | CKs are distributed by the author's client. If the author is offline for an entire epoch, new recipients won't get keys until the author comes online. |
| **Key derivation requires private key** | CKs are derived from the author's private key material. Implementations using NIP-46 (remote signing) must handle CK derivation at the signer, not the client. |
| **No retroactive revocation** | Revoking a recipient doesn't un-encrypt content they've already decrypted. To truly revoke past access: re-encrypt with new CK, re-distribute, publish replacement events. Expensive but possible. |

### Quantum Readiness

Dominion's security posture against quantum computing is split across two layers:

| Layer | Algorithm | Quantum status | Notes |
|-------|-----------|---------------|-------|
| Content encryption | AES-256-GCM | **Resistant** | Grover's algorithm reduces effective strength to AES-128 — still computationally infeasible |
| Key derivation | HKDF-SHA-256 | **Resistant** | Hash-based; no known quantum speedup beyond Grover's quadratic |
| Shamir secret sharing | Finite field arithmetic | **Resistant** | Information-theoretic security, not dependent on computational hardness |
| Event signing | secp256k1 (Schnorr/ECDSA) | **Vulnerable** | Shor's algorithm breaks elliptic curve discrete log in polynomial time |
| Key agreement (NIP-44) | secp256k1 ECDH | **Vulnerable** | Same vulnerability — shared secret derivation relies on ECDLP hardness |

**The symmetric layer is safe.** Vault-encrypted content (AES-256-GCM) and deterministic key derivation (HKDF) are quantum-resistant. A quantum attacker cannot decrypt vault content from ciphertext alone.

**The asymmetric layer is not.** Event signing and NIP-44 key agreement both depend on secp256k1, which is vulnerable to Shor's algorithm on a sufficiently powerful quantum computer. This means:

1. A quantum attacker could derive a Nostr private key from a public key
2. With the private key, they could re-derive all epoch CKs (since derivation is deterministic from the private key)
3. They could also forge new events — publishing fake vault shares or configurations

**Mitigation: algorithm tagging.** All Dominion events include an `['algo', 'secp256k1']` tag identifying the asymmetric algorithm used for signing and key agreement. This enables:

- **Parsers** to distinguish pre- and post-quantum events
- **Migration tooling** to identify events that need re-signing when post-quantum algorithms are adopted
- **Consumers** to enforce minimum algorithm requirements (e.g. "only accept events signed with ML-DSA-65 or later")

When the Nostr ecosystem adopts post-quantum signing (likely tracking Bitcoin's eventual upgrade), Dominion implementations update the `algo` tag value. Events without an `algo` tag SHOULD be treated as `secp256k1` for backward compatibility.

**Timeline.** The best current expert guidance places ECC-breaking quantum computers in the range of **2031–2045**, with **2035** as the key planning date. The UK NCSC says organisations should complete migration to post-quantum cryptography by 2035; NIST has quantum-vulnerable public-key algorithms on a path to deprecation by the same date. The 2025 Global Risk Institute survey rates a cryptographically relevant quantum computer as "quite possible" within 10 years and likely within 15. More conservative estimates (e.g. MITRE, January 2025) push toward the 2050s, but the planning consensus centres on 2035. Note: this would not be a brute-force attack — Shor's algorithm solves the elliptic-curve discrete logarithm problem directly, which is qualitatively different from key-space exhaustion.

The `algo` tag is a zero-cost hedge: it adds one tag per event today and unlocks clean migration paths when the time comes.

---

## 18. Reference Implementation

The standalone npm package `dominion-protocol` provides the core cryptography (HKDF, AES-GCM, Shamir) and Nostr event layer as a two-layer library. The first reference implementation is built within [Fathom](https://github.com/nickhealthy-fathom/fathom), a sovereign personal data layer built on Nostr. Fathom's implementation integrates Dominion with:

- Parent-controlled access tiers for children's data
- Encrypted learning journals and family calendars
- Blossom media integration (encrypted photo/video uploads)
- Co-parent access management with revocation

Dominion is designed as a standalone NIP. Any Nostr client can implement it independently. The protocol does not depend on Fathom or any specific client.

### Adoption Strategy

1. Ship working implementation in reference client
2. Propose NIP as "Epoch-Based Encrypted Content Access"
3. Pitch to Habla, 0xChat, Zap.stream as immediate adopters
4. Let creator economy and enterprise use cases emerge organically
5. The NIP succeeds if 2–3 other clients implement vault decryption

### Contributing

Dominion is open source. Contributions, feedback, and NIP discussion are welcome.

- Protocol specification: this document
- Reference implementation: [Fathom](https://github.com/nickhealthy-fathom/fathom)
- NIP proposal: pending (kind numbers are proposals)

---

*This specification is a living document. It will evolve through community feedback and implementation experience.*
