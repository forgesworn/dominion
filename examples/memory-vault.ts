/**
 * Memory Vault Example
 *
 * A worked walkthrough of the family memory vault pattern: two parents
 * keeping a private journal of photos and notes for a child, with a
 * grandparent added on weekly-rotating access.
 *
 * Demonstrates:
 *   - Setting up a family tier with explicit members
 *   - Encrypting text and binary content (photos) once per epoch
 *   - Building unsigned, unencrypted vault config and vault share events
 *     (callers handle NIP-44 self-encryption and NIP-59 gift-wrapping)
 *   - Weekly epoch rotation
 *   - Forward-only revocation when family circumstances change
 *
 * In a real Fledge-style application the private key would come from a
 * Nostr signer (NIP-46 bunker, hardware device, mobile signer). Photos
 * would be encrypted client-side, uploaded to Blossom, and the hash
 * embedded in the Nostr event. This example keeps everything in-memory
 * so the cryptographic flow is visible end to end.
 */

import {
  addToTier,
  contentKeyToHex,
  decrypt,
  decryptBlob,
  defaultConfig,
  deriveContentKey,
  encrypt,
  encryptBlob,
  getEpochIdForDate,
  revokePubkey,
} from 'dominion-protocol';
import { buildVaultConfigEvent, buildVaultShareEvent } from 'dominion-protocol/nostr';

// ---------------------------------------------------------------------------
// Cast — pubkeys are hex-encoded 32-byte values (secp256k1 x-coordinates)
// ---------------------------------------------------------------------------

// Vault owner — Alice (parent)
const ALICE_PRIVKEY = 'a'.repeat(64);
const ALICE_PUBKEY = '11'.repeat(32);

// Co-parent
const BOB_PUBKEY = '22'.repeat(32);

// Grandparent
const CAROL_PUBKEY = '33'.repeat(32);

// ---------------------------------------------------------------------------
// 1. Set up the family vault config
// ---------------------------------------------------------------------------
//
// The family tier is explicitly managed (not "auto") because vault
// membership for a child's memory journal needs to be deliberate.
// Weekly rotation caps the exposure window of any revocation at 7 days.

let config = defaultConfig();
config = addToTier(config, 'family', BOB_PUBKEY);
config = addToTier(config, 'family', CAROL_PUBKEY);
config = {
  ...config,
  epochConfig: { family: 'weekly' },
};

console.log('Initial family tier:', config.tiers['family']);
console.log('Epoch length:       ', config.epochConfig?.family);

// The vault config is published as a NIP-78 (kind 30078) event,
// self-encrypted to Alice's own pubkey. Only Alice can read her own
// tier memberships. Callers MUST NIP-44 self-encrypt the `content`
// before publishing.

const vaultConfigEvent = buildVaultConfigEvent(ALICE_PUBKEY, config);
console.log('\nVault config event kind:', vaultConfigEvent.kind);
console.log('Vault config d-tag:     ', vaultConfigEvent.tags.find((t) => t[0] === 'd')?.[1]);
console.log('(content above is plaintext JSON — caller MUST NIP-44 self-encrypt)');

// ---------------------------------------------------------------------------
// 2. Encrypt week 14 content for the family tier
// ---------------------------------------------------------------------------
//
// Two pieces of content this week: a journal note and a photo.
// Both are encrypted with the SAME content key — the whole epoch
// shares one CK. Fifty entries this week would still use one CK,
// which is what makes the system scale.

const week14 = getEpochIdForDate(new Date('2026-03-30'));
const week14Ck = deriveContentKey(ALICE_PRIVKEY, week14, 'family');

console.log(`\nEpoch:           ${week14}`);
console.log(`Family CK:       ${contentKeyToHex(week14Ck)}`);

const journalNote = 'First steps in the garden today. Carol came round for tea.';
const journalCiphertext = encrypt(journalNote, week14Ck);

// "Photo" — in a real app this is JPEG/HEIC bytes from the camera roll,
// compressed before encryption (server-side transcoding cannot operate
// on ciphertext, so compression must happen client-side first).
const photoBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, /* ...JPEG header... */ 0x00, 0x10]);
const photoCiphertext = encryptBlob(photoBytes, week14Ck);

console.log(`\nJournal ciphertext:    ${journalCiphertext.slice(0, 48)}...`);
console.log(`Photo ciphertext bytes: ${photoCiphertext.length} (iv || ciphertext || tag)`);

// ---------------------------------------------------------------------------
// 3. Distribute the week 14 CK to family members
// ---------------------------------------------------------------------------
//
// Each family member needs their own gift-wrapped vault share event.
// The share carries the raw CK in the content field — so callers MUST
// NIP-44 encrypt to the recipient's pubkey, seal in kind 13, and
// gift-wrap in kind 1059 (NIP-59) before publishing. Publishing these
// events as-is would leak the content key.

const week14CkHex = contentKeyToHex(week14Ck);

const sharesWeek14 = (config.tiers['family'] as string[]).map((recipient) =>
  buildVaultShareEvent(ALICE_PUBKEY, recipient, week14CkHex, week14, 'family'),
);

console.log(`\nBuilt ${sharesWeek14.length} vault share events for week 14`);
for (const share of sharesWeek14) {
  const recipientTag = share.tags.find((t) => t[0] === 'p')?.[1];
  console.log(`  → recipient ${recipientTag?.slice(0, 12)}…  d-tag=${share.tags.find((t) => t[0] === 'd')?.[1]}`);
}

// Bob and Carol each unwrap their gift, decrypt the share, extract the
// CK, and can now read everything Alice publishes for the family tier
// in week 14.

const bobDecryptedNote = decrypt(journalCiphertext, week14Ck);
const carolDecryptedPhoto = decryptBlob(photoCiphertext, week14Ck);

console.log(`\nBob reads journal:   "${bobDecryptedNote}"`);
console.log(`Carol gets photo:    ${carolDecryptedPhoto.length} bytes recovered`);

console.assert(bobDecryptedNote === journalNote, 'Journal round-trip failed');
console.assert(
  carolDecryptedPhoto.length === photoBytes.length && carolDecryptedPhoto.every((b, i) => b === photoBytes[i]),
  'Photo round-trip failed',
);

// ---------------------------------------------------------------------------
// 4. Week 15 — automatic epoch rotation
// ---------------------------------------------------------------------------
//
// A new epoch begins. Alice's client derives a new CK and re-distributes
// to all current family members. No state migration, no key database —
// the new CK is deterministically derived from the same private key.

const week15 = getEpochIdForDate(new Date('2026-04-06'));
const week15Ck = deriveContentKey(ALICE_PRIVKEY, week15, 'family');

console.log(`\nNew epoch:       ${week15}`);
console.log(`Week 15 CK:      ${contentKeyToHex(week15Ck)}`);
console.log(`Differs from W14: ${contentKeyToHex(week15Ck) !== contentKeyToHex(week14Ck)}`);

const sharesWeek15 = (config.tiers['family'] as string[]).map((recipient) =>
  buildVaultShareEvent(ALICE_PUBKEY, recipient, contentKeyToHex(week15Ck), week15, 'family'),
);

console.log(`Distributed ${sharesWeek15.length} new shares for week 15`);

// ---------------------------------------------------------------------------
// 5. Revocation — circumstances change
// ---------------------------------------------------------------------------
//
// Suppose a custody concern means Carol should no longer have access to
// new content. Revocation removes Carol from all tiers and adds her
// pubkey to the revoked list. Future epoch rotations skip her.
//
// Forward-only revocation is honest about its limits: Carol still has
// her cached week 14 and week 15 CKs. Anything she's already decrypted
// stays decrypted. This matches Signal, WhatsApp, every E2E system.
// What stops at revocation is FUTURE access.

config = revokePubkey(config, CAROL_PUBKEY);

console.log('\nAfter revoking Carol:');
console.log('  family:        ', config.tiers['family']);
console.log('  revokedPubkeys:', config.revokedPubkeys.map((p) => `${p.slice(0, 12)}…`));

// ---------------------------------------------------------------------------
// 6. Week 16 — Carol is excluded from the new distribution
// ---------------------------------------------------------------------------

const week16 = getEpochIdForDate(new Date('2026-04-13'));
const week16Ck = deriveContentKey(ALICE_PRIVKEY, week16, 'family');

const sharesWeek16 = (config.tiers['family'] as string[]).map((recipient) =>
  buildVaultShareEvent(ALICE_PUBKEY, recipient, contentKeyToHex(week16Ck), week16, 'family'),
);

console.log(`\nWeek 16 shares: ${sharesWeek16.length}`);
for (const share of sharesWeek16) {
  console.log(`  → ${share.tags.find((t) => t[0] === 'p')?.[1].slice(0, 12)}…`);
}

console.assert(
  !sharesWeek16.some((s) => s.tags.find((t) => t[0] === 'p')?.[1] === CAROL_PUBKEY),
  'Carol should not appear in week 16 distribution',
);

// New content this week is encrypted with week16Ck, which Carol never
// receives. Her cached week 14 and week 15 keys cannot decrypt it,
// because the CK is derived per-epoch.

const week16Note = 'Picnic in the park. New nursery starts on Monday.';
const week16Ciphertext = encrypt(week16Note, week16Ck);

let carolCanDecrypt = true;
try {
  decrypt(week16Ciphertext, week14Ck);
} catch {
  carolCanDecrypt = false;
}

console.log(`\nCarol attempts to decrypt week 16 with her week 14 key: ${carolCanDecrypt ? 'succeeded (BUG)' : 'failed (correct)'}`);
console.assert(!carolCanDecrypt, 'Forward-only revocation breach');

// ---------------------------------------------------------------------------
// 7. Recap
// ---------------------------------------------------------------------------

console.log('\n---');
console.log('Summary:');
console.log('  - One family CK per epoch, deterministically derived from Alice\'s key');
console.log('  - Photos encrypted once per epoch — scales to any tier size');
console.log('  - Carol added in week 14, removed in week 16');
console.log('  - Carol retains historical content (forward-only model)');
console.log('  - No central server, no custom relay, no platform');
