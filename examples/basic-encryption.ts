/**
 * Basic Encryption Example
 *
 * Demonstrates epoch-based content key derivation and AES-256-GCM
 * encryption/decryption using dominion-protocol.
 *
 * In a real application the private key would come from a Nostr signer
 * (e.g. NIP-46 bunker or hardware device). Never hard-code key material.
 */

import {
  contentKeyToHex,
  decrypt,
  deriveContentKey,
  encrypt,
  getCurrentEpochId,
  getEpochIdForDate,
} from 'dominion-protocol';

// ---------------------------------------------------------------------------
// 1. Derive a content key for the current epoch and a named tier
// ---------------------------------------------------------------------------

// 64-char hex secp256k1 private key (owner of the vault)
const privkeyHex = 'a'.repeat(64); // replace with real key material

const epochId = getCurrentEpochId(); // e.g. "2026-W14"
const tier = 'family';

const ck = deriveContentKey(privkeyHex, epochId, tier);

console.log(`Epoch:       ${epochId}`);
console.log(`Tier:        ${tier}`);
console.log(`Content key: ${contentKeyToHex(ck)}`);

// ---------------------------------------------------------------------------
// 2. Encrypt a plaintext string
// ---------------------------------------------------------------------------

const plaintext = 'Hello, family tier!';
const ciphertext = encrypt(plaintext, ck);

console.log(`\nPlaintext:  ${plaintext}`);
console.log(`Ciphertext: ${ciphertext}`);

// ---------------------------------------------------------------------------
// 3. Decrypt back to plaintext
// ---------------------------------------------------------------------------

const recovered = decrypt(ciphertext, ck);
console.log(`Decrypted:  ${recovered}`);

console.assert(recovered === plaintext, 'Round-trip failed');

// ---------------------------------------------------------------------------
// 4. Derive a content key for a historical epoch
// ---------------------------------------------------------------------------

// Access control changes per epoch — old content keys cannot decrypt new content.
const lastWeek = getEpochIdForDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
const oldCk = deriveContentKey(privkeyHex, lastWeek, tier);

console.log(`\nLast week's epoch: ${lastWeek}`);
console.log(`Last week's CK:    ${contentKeyToHex(oldCk)}`);
console.log(`Keys differ:       ${contentKeyToHex(ck) !== contentKeyToHex(oldCk)}`);
