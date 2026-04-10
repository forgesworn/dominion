# Dominion Extension: Quantum Vault

**Status:** Designed extension to Dominion v1.0 — no reference implementation yet
**Scope:** Optional decoupling of CK derivation from the Nostr private key, hedging against future quantum attacks on secp256k1

---

## Relationship to v1.0

Dominion v1.0's quantum stance is documented in the main spec under §15 Limitations → Quantum Readiness. The short version: the symmetric layer (AES-256-GCM, HKDF, Shamir) is quantum-resistant; the asymmetric layer (secp256k1 signing and ECDH) is not. Every event carries an `['algo', 'secp256k1']` tag so that future migration tooling can identify pre- and post-quantum events cleanly.

The v1.0 stance is sufficient for current deployments — cryptographically relevant quantum computers are not expected before the early 2030s, and the algo tag provides clean migration when post-quantum signing arrives in Nostr.

This extension goes further: it decouples CK derivation from the Nostr private key entirely, so even a complete quantum break of secp256k1 cannot retroactively decrypt vault content. Implementing it is a future hardening step; the design is preserved here so an implementer can build it without redesigning from scratch.

---

## The Problem

Dominion derives Content Keys deterministically: `CK = HKDF(nostr_private_key, epoch, tier)`. The symmetric layer (AES-256-GCM, HKDF, Shamir) is quantum-resistant, but the Nostr private key is secp256k1 — vulnerable to Shor's algorithm. A quantum attacker who cracks the private key can re-derive every CK ever produced, decrypting all vault content.

Migrating to a post-quantum Nostr identity in the future does not protect historical data — the old public key remains visible on relays.

## The Solution

A **Vault Master Key (VMK)** decouples CK derivation from the Nostr private key:

```
CK = HKDF(vmk, epoch, tier)   // VMK is random, not derived from secp256k1
```

The VMK is encrypted with ML-KEM-768 (NIST FIPS 203) and stored in the vault config. Even if a quantum attacker cracks the Nostr key and reads the NIP-44 self-encrypted config, the VMK inside is ML-KEM protected — unbreakable by quantum computers.

## Vault Config Extension

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

## How It Works

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

## Overhead

| Metric | Value |
|--------|-------|
| Storage in vault config | ~3.3 KB |
| ML-KEM keygen | ~50 μs |
| ML-KEM encapsulate/decapsulate | ~60–70 μs |
| CK derivation change | Zero — same HKDF function |
| Recipient-side change | Zero — CKs still distributed via gift-wrap |

## Backward Compatibility

- `quantumVault` is an optional field. Old configs work unchanged.
- `activatedEpoch` marks the boundary: pre-activation content uses privkey-derived CKs, post-activation uses VMK-derived CKs.
- Recipients are unaffected — they receive CKs via gift-wrap regardless of derivation method.
