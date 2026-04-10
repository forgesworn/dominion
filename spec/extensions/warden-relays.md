# Dominion Extension: Warden Relays

**Status:** Designed extension to Dominion v1.0 — no reference implementation yet
**Scope:** Optional infrastructure for users who need true instant revocation rather than the v1.0 forward-only default

---

## Overview

Dominion v1.0 ships with forward-only revocation: stop distributing CKs for new epochs, and the revoked recipient loses access within one epoch (24 hours to 30 days depending on epoch length). This is the same model as every E2E messaging system and is sufficient for the vast majority of use cases — creator paywalls, family memory vaults, peer support groups.

Some scenarios need more: custody disputes, institutional access with SLA, paid content with instant cancellation. For these, **warden relays** are an optional layer of infrastructure that provides true instant revocation by storing CK shares outside the recipient's reach.

This extension is **designed but not implemented in the reference library**. Implementing it is on the roadmap for a future release; the design is preserved here so an implementer can build it without redesigning from scratch.

---

## What Warden Relays Do

A warden relay is an AUTH-gated key-value store that:

1. Stores CK shares (optionally Shamir-split) keyed by recipient pubkey
2. Serves shares only to authenticated matching pubkeys (NIP-42)
3. Honours DELETE requests from the content author
4. Stores only encrypted key material — never content

## True Revocation Flow

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

## Shamir Secret Sharing (M-of-N)

For redundancy and privacy, CKs can be Shamir-split across multiple warden relays:

| Configuration | Meaning |
|--------------|---------|
| 1-of-1 | Single warden relay. Simple. |
| 2-of-3 | Any 2 of 3 relays can reconstruct CK. Tolerates 1 relay failure. |
| 3-of-5 | Any 3 of 5 relays. Tolerates 2 failures. Better privacy. |

The recipient authenticates to M relays, retrieves M shares, and reconstructs the CK locally.

## Content and Vault Separation

Content relays and warden relays are separate concerns:

| Relay type | Stores | Knows |
|-----------|--------|-------|
| Content relay | Encrypted content blobs | Author pubkey, ciphertext |
| Warden relay | Encrypted CK shares | Recipient pubkey, share requests |

No single relay sees both content and recipients. This is a strict metadata privacy improvement.

## Progressive Sovereignty

| Level | Key distribution | Revocation | Who controls |
|-------|-----------------|------------|-------------|
| **Managed** | Provider-hosted warden relay | True, instant | Provider |
| **Self-hosted** | User's own warden relay | True, instant | User |
| **Pure Nostr** | Gift-wrapped on standard relays | Forward-only (max 1 epoch) | User, fully sovereign |

Switchable in either direction, per-epoch. No lock-in.

## When to Use Warden Relays

| Scenario | Gift-wrap (default) | Warden relay |
|----------|-------------------|-------------|
| Creator paywall | Sufficient | Overkill |
| Private family sharing | Sufficient | Overkill |
| Custody dispute with hostile co-parent | Insufficient | Recommended |
| Institutional access with SLA | Insufficient | Recommended |
| Paid content with instant cancellation | Insufficient | Recommended |

## NIP Dependencies

Warden relays use existing Nostr primitives:

- **NIP-42** — recipient authentication to the warden relay
- **NIP-09** — author-issued deletion requests for stored CK shares
- **NIP-44** — encryption of CK shares stored on the warden relay

No new event kinds are required for the warden relay protocol itself; the share format is the same kind 30480 used by gift-wrapped distribution, just stored on a different relay class with AUTH gating.
