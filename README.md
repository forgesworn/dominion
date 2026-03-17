# Dominion Protocol

Epoch-based encrypted access control for Nostr. Tiered audiences, key rotation, and revocable access — all on standard Nostr relays.

<p align="center">
  <a href="docs/dominion-explainer.svg">
    <img src="docs/dominion-explainer.svg" alt="Dominion — interactive explainer (click to open)" width="700" />
  </a>
  <br />
  <em>Interactive explainer — <a href="docs/dominion-explainer.svg">open in browser</a> and click to advance</em>
</p>

## Install

```bash
npm install dominion-protocol
```

## Usage

### Content Key Derivation

```typescript
import { deriveContentKey, contentKeyToHex, getCurrentEpochId } from 'dominion-protocol';

const epochId = getCurrentEpochId();  // e.g. "2026-W11"
const ck = deriveContentKey(privateKeyHex, epochId, 'family');
console.log(contentKeyToHex(ck));     // 64-char hex string
```

### Encrypt / Decrypt

```typescript
import { encrypt, decrypt } from 'dominion-protocol';

const ciphertext = encrypt('Hello vault!', ck);  // base64 string
const plaintext = decrypt(ciphertext, ck);        // "Hello vault!"
```

### Shamir Secret Sharing

```typescript
import { splitCK, reconstructCK, encodeCKShare, decodeCKShare } from 'dominion-protocol';

const shares = splitCK(ck, 2, 3);           // 2-of-3 threshold
const encoded = shares.map(encodeCKShare);   // ["1:ab12...", "2:cd34...", "3:ef56..."]

const decoded = encoded.slice(0, 2).map(decodeCKShare);
const recovered = reconstructCK(decoded);    // original CK
```

### Vault Config

```typescript
import { defaultConfig, addToTier, revokePubkey } from 'dominion-protocol';

let config = defaultConfig();
config = addToTier(config, 'family', recipientPubkey);
config = revokePubkey(config, formerFriendPubkey);
```

### Nostr Events

```typescript
import { buildVaultShareEvent } from 'dominion-protocol/nostr';

// Build a kind 30480 vault share (caller handles NIP-44 + NIP-59 wrapping)
const event = buildVaultShareEvent(authorPubkey, recipientPubkey, ckHex, epochId, 'family');
```

## Protocol Spec

See [spec/protocol.md](spec/protocol.md) for the full protocol specification.

## Licence

MIT
