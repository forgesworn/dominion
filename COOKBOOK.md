# Dominion Protocol — Cookbook

Practical recipes for common use cases. Each recipe is complete and runnable.

---

## Recipe 1: Creator Paywall

A Nostr creator encrypts weekly posts for paying subscribers. Non-payers are skipped at next epoch rotation.

```typescript
import {
  deriveContentKey,
  contentKeyToHex,
  getCurrentEpochId,
  encrypt,
  decrypt,
  defaultConfig,
  addToTier,
  revokePubkey,
} from 'dominion-protocol';
import {
  buildVaultShareEvent,
  buildVaultConfigEvent,
} from 'dominion-protocol/nostr';

// --- Setup ---
const creatorPrivkey = 'a1b2c3...'; // 64 hex chars — the creator's secp256k1 privkey
const creatorPubkey  = 'd4e5f6...'; // 64 hex chars — the creator's pubkey

// --- Epoch + Content Key ---
const epochId = getCurrentEpochId(); // e.g. "2026-W14"
const ck = deriveContentKey(creatorPrivkey, epochId, 'subscribers');

// --- Encrypt a post ---
const post = 'This week's paid update: ...';
const ciphertext = encrypt(post, ck);
// Publish `ciphertext` as the content of a Nostr event (kind of your choice).

// --- Distribute CK to each paying subscriber ---
const subscribers = ['pubkey1hex...', 'pubkey2hex...'];
for (const recipientPubkey of subscribers) {
  const shareEvent = buildVaultShareEvent(
    creatorPubkey,
    recipientPubkey,
    contentKeyToHex(ck),
    epochId,
    'subscribers',
  );
  // IMPORTANT: NIP-44 encrypt shareEvent.content, then NIP-59 gift-wrap before publishing.
  // Your Nostr client / signer handles the actual publish step.
}

// --- Subscriber decrypts ---
// After NIP-59 unwrap + NIP-44 decrypt, shareEvent.content contains the raw ck hex.
// const ck = hexToBytes(shareData.ckHex);  // from parseVaultShare()
const plaintext = decrypt(ciphertext, ck);
console.log(plaintext); // "This week's paid update: ..."

// --- Revoke a subscriber who cancelled ---
let config = defaultConfig();
config = addToTier(config, 'subscribers', 'pubkey1hex...');
config = revokePubkey(config, 'cancelledSubscriberPubkey...');
// On next epoch, skip revoked pubkeys when distributing CKs.
```

---

## Recipe 2: Family Photo Sharing with Tiered Access

Different tiers see different content. Family members see everything; connections see only milestones.

```typescript
import {
  deriveContentKey,
  getCurrentEpochId,
  encrypt,
  decrypt,
  defaultConfig,
  addToTier,
} from 'dominion-protocol';

const ownerPrivkey = 'a1b2c3...'; // 64 hex chars

// --- Build tier config ---
let config = defaultConfig();
// defaultConfig() starts with { family: [], connections: 'auto' }

config = addToTier(config, 'family', 'alicePubkey64hex...');
config = addToTier(config, 'family', 'bobPubkey64hex...');
config = addToTier(config, 'connections', 'carolPubkey64hex...');

// --- Derive per-tier content keys ---
const epochId = getCurrentEpochId();
const familyCk      = deriveContentKey(ownerPrivkey, epochId, 'family');
const connectionsCk = deriveContentKey(ownerPrivkey, epochId, 'connections');

// Family content — only family can decrypt
const familyCiphertext = encrypt('Kids' bath time photos!', familyCk);

// Connections content — connections + anyone with the connections CK
const milestoneCiphertext = encrypt('Jake took his first steps today.', connectionsCk);

// --- Distribute keys to tier members ---
// For each member in config.tiers['family'], buildVaultShareEvent(..., familyCkHex, ...)
// For each member in config.tiers['connections'], buildVaultShareEvent(..., connectionsCkHex, ...)

// --- Decrypt on the receiving side ---
const familyPost = decrypt(familyCiphertext, familyCk);
const milestone  = decrypt(milestoneCiphertext, connectionsCk);

console.log(familyPost); // "Kids' bath time photos!"
console.log(milestone);  // "Jake took his first steps today."
```

---

## Recipe 3: Shamir Key Recovery (Cross-Module Integration)

Split a Content Key across three custodians. Any two can reconstruct. Combines core + Shamir layers.

```typescript
import {
  deriveContentKey,
  contentKeyToHex,
  getCurrentEpochId,
  encrypt,
  decrypt,
  splitCK,
  reconstructCK,
  encodeCKShare,
  decodeCKShare,
} from 'dominion-protocol';

const ownerPrivkey = 'a1b2c3...'; // 64 hex chars

// --- Derive the content key ---
const epochId = getCurrentEpochId();
const ck = deriveContentKey(ownerPrivkey, epochId, 'vault');

// --- Encrypt some content ---
const secret = 'Sensitive institutional document';
const ciphertext = encrypt(secret, ck);

// --- Split CK into 3 shares (2-of-3 threshold) ---
const shares  = splitCK(ck, 2, 3);
const encoded = shares.map(encodeCKShare);
// encoded = ["1:ab12cd34...", "2:ef56gh78...", "3:ij90kl12..."]
// Distribute each encoded share to a different custodian / relay / device.

// --- Destroy the original CK at rest ---
// (shares[0].data.fill(0); etc. if needed)

// --- Later: reconstruct from any 2 shares ---
const twoShares  = encoded.slice(0, 2).map(decodeCKShare);
const recovered  = reconstructCK(twoShares);

// --- Decrypt ---
const plaintext = decrypt(ciphertext, recovered);
console.log(plaintext); // "Sensitive institutional document"

// Verify round-trip
console.assert(contentKeyToHex(ck) === contentKeyToHex(recovered), 'CK mismatch');
```

---

## Recipe 4: Epoch Rotation

Rotate the Content Key each week. Revoked members don't receive the new CK and can't decrypt future content.

```typescript
import {
  deriveContentKey,
  getEpochIdForDate,
  contentKeyToHex,
} from 'dominion-protocol';

const ownerPrivkey = 'a1b2c3...'; // 64 hex chars

// --- Derive keys for several epochs ---
const epochs = [
  getEpochIdForDate(new Date('2026-03-30')), // "2026-W14"
  getEpochIdForDate(new Date('2026-04-06')), // "2026-W15"
  getEpochIdForDate(new Date('2026-04-13')), // "2026-W16"
];

for (const epochId of epochs) {
  const ck = deriveContentKey(ownerPrivkey, epochId, 'subscribers');
  console.log(`${epochId}: ${contentKeyToHex(ck)}`);
  // Each epoch yields a completely different CK.
  // Content encrypted in 2026-W14 cannot be decrypted with the 2026-W15 CK.
}

// CKs are deterministic — no database required.
// Re-derive at any time from (privkey, epochId, tier).
```

---

## Recipe 5: Parse Incoming Vault Share Events

On the recipient side, unwrap a gift-wrapped vault share and recover the Content Key.

```typescript
import { parseVaultShare } from 'dominion-protocol/nostr';
import { decrypt } from 'dominion-protocol';

// After NIP-59 unwrap + NIP-44 decrypt, you have a plaintext event object:
const decryptedEvent = {
  kind: 30480,
  pubkey: 'authorPubkey...',
  created_at: 1712345678,
  tags: [
    ['d', '2026-W14:subscribers'],
    ['p', 'yourPubkey...'],
    ['tier', 'subscribers'],
    ['encrypted', 'nip44'],
    ['algo', 'secp256k1'],
    ['L', 'dominion'],
    ['l', 'share', 'dominion'],
  ],
  content: 'ab12cd34ef56...', // raw CK hex (post-NIP-44 decryption)
};

// Parse the vault share
const shareData = parseVaultShare(decryptedEvent);
// shareData = { fromPubkey, epochId: '2026-W14', ckHex: 'ab12...', tier: 'subscribers', algorithm: 'secp256k1' }

if (!shareData) {
  throw new Error('Invalid or unrecognised vault share event');
}

// Convert ck hex to bytes
const { hexToBytes } = await import('@noble/hashes/utils.js');
const ck = hexToBytes(shareData.ckHex);

// Decrypt content encrypted for this epoch
const encryptedContent = '...'; // fetched from relay
const plaintext = decrypt(encryptedContent, ck);
console.log(plaintext);
```

---

## Recipe 6: Vault Config Persistence

Store and restore tier memberships using a NIP-78 vault config event.

```typescript
import {
  defaultConfig,
  addToTier,
  addIndividualGrant,
} from 'dominion-protocol';
import {
  buildVaultConfigEvent,
  parseVaultConfig,
  buildVaultConfigFilter,
} from 'dominion-protocol/nostr';

const authorPubkey = 'yourPubkeyHex...';

// --- Build config ---
let config = defaultConfig();
config = addToTier(config, 'family', 'alicePubkey...');
config = addIndividualGrant(config, 'guestPubkey...', 'Beta tester — expires 2026-05-01');

// --- Serialise to event ---
const configEvent = buildVaultConfigEvent(authorPubkey, config);
// IMPORTANT: NIP-44 self-encrypt configEvent.content before publishing.
// configEvent.content is plaintext JSON — do NOT publish as-is.

// Filter to fetch your own config from relays:
const filter = buildVaultConfigFilter(authorPubkey);
// filter = { kinds: [30078], authors: [authorPubkey], '#d': ['dominion:vault-config'] }

// --- On load: after self-decrypting the fetched event content ---
const decryptedContent = '{"tiers":{...},...}'; // NIP-44 decrypted JSON
const restoredConfig = parseVaultConfig(decryptedContent);
// restoredConfig = DominionConfig | null (null = validation failed)

if (restoredConfig) {
  console.log('Tiers:', Object.keys(restoredConfig.tiers));
  console.log('Grants:', restoredConfig.individualGrants.length);
}
```
