/**
 * Tiered Access Example
 *
 * Demonstrates tiered audience management using DominionConfig mutations.
 * Each tier receives its own content key derived from the same vault privkey,
 * so family members and connections can never decrypt each other's content.
 *
 * Config mutations are pure — every call returns a new DominionConfig object.
 */

import {
  addIndividualGrant,
  addToTier,
  contentKeyToHex,
  defaultConfig,
  deriveContentKey,
  getCurrentEpochId,
  removeFromTier,
  removeIndividualGrant,
  revokePubkey,
  unrevokePubkey,
} from 'dominion-protocol';

// ---------------------------------------------------------------------------
// Test pubkeys (hex-encoded 32-byte values, secp256k1 x-coordinates)
// ---------------------------------------------------------------------------

const ALICE = 'a'.repeat(64);
const BOB = 'b'.repeat(64);
const CAROL = 'c'.repeat(64);
const DAVE = 'd'.repeat(64);

// Vault owner's private key — never share this
const OWNER_PRIVKEY = 'e'.repeat(64);

// ---------------------------------------------------------------------------
// 1. Start with the default config
// ---------------------------------------------------------------------------

let config = defaultConfig();
// Default tiers: { family: [], connections: 'auto' }

console.log('Initial tiers:', config.tiers);

// ---------------------------------------------------------------------------
// 2. Add members to the family tier
// ---------------------------------------------------------------------------

config = addToTier(config, 'family', ALICE);
config = addToTier(config, 'family', BOB);

// Create a custom tier
config = addToTier(config, 'close_friends', CAROL);

console.log('\nAfter adding members:');
console.log('  family:        ', config.tiers['family']);
console.log('  close_friends: ', config.tiers['close_friends']);

// ---------------------------------------------------------------------------
// 3. Individual grant — one-off access independent of tier membership
// ---------------------------------------------------------------------------

config = addIndividualGrant(config, DAVE, 'Guest pass — expires at next epoch');

console.log('\nIndividual grants:', config.individualGrants.map((g) => g.label));

// ---------------------------------------------------------------------------
// 4. Derive a distinct content key per tier
// ---------------------------------------------------------------------------

const epochId = getCurrentEpochId();

const familyCk = deriveContentKey(OWNER_PRIVKEY, epochId, 'family');
const closeFriendsCk = deriveContentKey(OWNER_PRIVKEY, epochId, 'close_friends');

console.log('\nContent keys for epoch', epochId);
console.log('  family CK:        ', contentKeyToHex(familyCk));
console.log('  close_friends CK: ', contentKeyToHex(closeFriendsCk));
console.log('  Keys differ:      ', contentKeyToHex(familyCk) !== contentKeyToHex(closeFriendsCk));

// ---------------------------------------------------------------------------
// 5. Remove a member from a tier (access revocation for next epoch)
// ---------------------------------------------------------------------------

config = removeFromTier(config, 'family', BOB);

console.log('\nAfter removing Bob from family:', config.tiers['family']);

// ---------------------------------------------------------------------------
// 6. Revoke a pubkey entirely — removes from all tiers and individual grants
// ---------------------------------------------------------------------------

config = revokePubkey(config, CAROL);

console.log('\nAfter revoking Carol:');
console.log('  close_friends: ', config.tiers['close_friends']);
console.log('  revokedPubkeys:', config.revokedPubkeys);

// ---------------------------------------------------------------------------
// 7. Un-revoke a pubkey (removes from revoked list; re-add to tiers manually)
// ---------------------------------------------------------------------------

config = unrevokePubkey(config, CAROL);
config = addToTier(config, 'close_friends', CAROL);

console.log('\nAfter reinstating Carol:');
console.log('  close_friends: ', config.tiers['close_friends']);
console.log('  revokedPubkeys:', config.revokedPubkeys);

// ---------------------------------------------------------------------------
// 8. Remove an individual grant
// ---------------------------------------------------------------------------

config = removeIndividualGrant(config, DAVE);

console.log('\nAfter removing Dave individual grant:', config.individualGrants.length, 'grants remaining');

// ---------------------------------------------------------------------------
// 9. Inspect the final config
// ---------------------------------------------------------------------------

console.log('\nFinal config:', JSON.stringify(config, null, 2));
