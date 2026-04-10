/**
 * Peer Support Tier Example
 *
 * A worked walkthrough of a small private peer-support group: a host
 * (typically a trained facilitator) and a handful of peers who share
 * messages within a closed circle. Membership churn is the routine
 * case here, not the exception — peers come and go as their needs
 * change, and revocation must be cheap, ordinary, and undramatic.
 *
 * Demonstrates:
 *   - A custom tier name (`peer_support`) outside the default tier set
 *   - Daily epochs — 24-hour exposure window suited to higher-churn
 *     membership in a sensitive group
 *   - A peer joining the group mid-week
 *   - A peer leaving the group, with revocation as the routine path
 *   - How a Muster-style client would gate membership on a Signet
 *     credential check (sketched in comments — the actual cross-package
 *     integration lives in `signet-gated-vault.ts`)
 *
 * In a Muster deployment the host's private key would come from a
 * Nostr signer. The group would publish messages as standard Nostr
 * events tagged with `["vault", "<epoch>", "peer_support"]`, encrypted
 * once per epoch with the tier CK.
 */

import {
  addToTier,
  contentKeyToHex,
  decrypt,
  defaultConfig,
  deriveContentKey,
  encrypt,
  getEpochIdForDate,
  removeFromTier,
} from 'dominion-protocol';
import { buildVaultConfigEvent, buildVaultShareEvent } from 'dominion-protocol/nostr';

// ---------------------------------------------------------------------------
// Cast — host plus four peers (one joins later, one leaves)
// ---------------------------------------------------------------------------

const HOST_PRIVKEY = 'a'.repeat(64);
const HOST_PUBKEY = '11'.repeat(32);

const ALICE = '22'.repeat(32);
const BEN = '33'.repeat(32);
const CHRIS = '44'.repeat(32);
const DANI = '55'.repeat(32);

// ---------------------------------------------------------------------------
// 1. Set up the peer support tier
// ---------------------------------------------------------------------------
//
// Note the custom tier name. Dominion tier names are opaque strings —
// any UTF-8 string is a valid tier as long as it doesn't contain a
// colon (the protocol uses `:` as the epoch/tier delimiter in the
// HKDF info string and the d-tag).
//
// Daily epochs cap the worst-case exposure window at 24 hours. For a
// peer support group where someone might quietly step away after a
// difficult session, that's a sensible default. The reference
// implementation ships daily, weekly, and monthly helpers via
// `getEpochIdForDate(date, length)`.

let config = defaultConfig();
config = addToTier(config, 'peer_support', ALICE);
config = addToTier(config, 'peer_support', BEN);
config = addToTier(config, 'peer_support', CHRIS);
config = {
  ...config,
  epochConfig: { peer_support: 'daily' },
};

console.log('Initial peer_support tier:', (config.tiers['peer_support'] as string[]).map((p) => `${p.slice(0, 8)}…`));
console.log('Epoch length:             ', config.epochConfig?.peer_support);

// ---------------------------------------------------------------------------
// 2. Membership gating in a Muster client (sketch only)
// ---------------------------------------------------------------------------
//
// Before a Muster client adds a pubkey to the peer_support tier, it
// would check the candidate's Signet credentials. Something like:
//
//     const credentials = await fetchSignetCredentials(candidate);
//     const verified = credentials.find(
//       (c) => c.tier >= 3 && c.scope === 'veteran-status',
//     );
//     if (!verified) throw new Error('Candidate not verified');
//     config = addToTier(config, 'peer_support', candidate);
//
// The Signet check happens in application code, not in the protocol.
// Dominion treats tier membership as a list of pubkeys; how the host
// decides who goes in that list is up to the implementing client.
// The companion `signet-gated-vault.ts` example demonstrates the
// actual integration end to end.

// ---------------------------------------------------------------------------
// 3. Day 1 — first session
// ---------------------------------------------------------------------------

const day1 = getEpochIdForDate(new Date('2026-04-13'), 'daily');
const day1Ck = deriveContentKey(HOST_PRIVKEY, day1, 'peer_support');

console.log(`\nDay 1 epoch:    ${day1}`);
console.log(`Day 1 CK:       ${contentKeyToHex(day1Ck)}`);

const day1Message = 'Welcome everyone. Tonight we\'re going to talk about sleep.';
const day1Ciphertext = encrypt(day1Message, day1Ck);

const sharesDay1 = (config.tiers['peer_support'] as string[]).map((peer) =>
  buildVaultShareEvent(HOST_PUBKEY, peer, contentKeyToHex(day1Ck), day1, 'peer_support'),
);

console.log(`Distributed ${sharesDay1.length} shares for day 1`);

// Each peer unwraps their gift, decrypts the share, and reads the message.
console.assert(decrypt(day1Ciphertext, day1Ck) === day1Message, 'Day 1 round-trip failed');

// ---------------------------------------------------------------------------
// 4. Day 2 — Dani joins the group
// ---------------------------------------------------------------------------
//
// A new peer is added the next day. They are sent the CURRENT epoch CK
// only — the protocol's grant scope rule. Dani can read this session
// onwards but cannot retroactively decrypt yesterday.

config = addToTier(config, 'peer_support', DANI);

const day2 = getEpochIdForDate(new Date('2026-04-14'), 'daily');
const day2Ck = deriveContentKey(HOST_PRIVKEY, day2, 'peer_support');

console.log(`\nDay 2 epoch:    ${day2}`);
console.log(`Members:        ${(config.tiers['peer_support'] as string[]).length}`);

const sharesDay2 = (config.tiers['peer_support'] as string[]).map((peer) =>
  buildVaultShareEvent(HOST_PUBKEY, peer, contentKeyToHex(day2Ck), day2, 'peer_support'),
);

console.log(`Distributed ${sharesDay2.length} shares for day 2 (Dani included)`);

// Dani only ever received the day 2 CK. Her cached key cannot decrypt day 1.
let daniCanReadDay1 = true;
try {
  decrypt(day1Ciphertext, day2Ck);
} catch {
  daniCanReadDay1 = false;
}
console.log(`Dani tries to decrypt day 1 with her day 2 key: ${daniCanReadDay1 ? 'succeeded (BUG)' : 'failed (correct)'}`);
console.assert(!daniCanReadDay1, 'Grant scope violated — new joiner saw historical content');

// ---------------------------------------------------------------------------
// 5. Day 3 — Ben steps away
// ---------------------------------------------------------------------------
//
// Ben quietly leaves the group. This is the routine path: no
// confrontation, no incident, just a config change. Removing him from
// the tier means the next epoch rotation skips him. With daily epochs
// his exposure to future content ends within 24 hours.

config = removeFromTier(config, 'peer_support', BEN);

const day3 = getEpochIdForDate(new Date('2026-04-15'), 'daily');
const day3Ck = deriveContentKey(HOST_PRIVKEY, day3, 'peer_support');

console.log(`\nDay 3 epoch:    ${day3}`);
console.log(`Members:        ${(config.tiers['peer_support'] as string[]).length}`);

const sharesDay3 = (config.tiers['peer_support'] as string[]).map((peer) =>
  buildVaultShareEvent(HOST_PUBKEY, peer, contentKeyToHex(day3Ck), day3, 'peer_support'),
);

console.log(`Distributed ${sharesDay3.length} shares for day 3 (Ben excluded)`);

console.assert(
  !sharesDay3.some((s) => s.tags.find((t) => t[0] === 'p')?.[1] === BEN),
  'Ben should not appear in day 3 distribution',
);

// Ben can still read days 1 and 2 from his cached CKs. He cannot read
// day 3 — the new CK was never sent to him. Forward-only revocation
// is honest about its limits: anything Ben already decrypted remains
// decrypted, but the next 24 hours of content is inaccessible.

const day3Message = 'Quiet check-in tonight. Take what you need from the group.';
const day3Ciphertext = encrypt(day3Message, day3Ck);

let benCanReadDay3 = true;
try {
  decrypt(day3Ciphertext, day1Ck);
} catch {
  benCanReadDay3 = false;
}
console.log(`Ben tries day 1 key on day 3 message: ${benCanReadDay3 ? 'succeeded (BUG)' : 'failed (correct)'}`);
console.assert(!benCanReadDay3, 'Forward-only revocation breach');

// ---------------------------------------------------------------------------
// 6. Build the vault config event
// ---------------------------------------------------------------------------
//
// The host publishes a NIP-78 (kind 30078) vault config event so that
// other devices owned by the same host can sync the membership list.
// The content is plaintext JSON until the caller NIP-44 self-encrypts
// it. Other peers cannot read this — it's encrypted to the host's own
// pubkey, not the group's.

const vaultConfigEvent = buildVaultConfigEvent(HOST_PUBKEY, config);
console.log(`\nVault config kind: ${vaultConfigEvent.kind}`);
console.log(`Vault config d-tag: ${vaultConfigEvent.tags.find((t) => t[0] === 'd')?.[1]}`);
console.log('(content is plaintext JSON — caller MUST NIP-44 self-encrypt before publishing)');

// ---------------------------------------------------------------------------
// 7. Recap
// ---------------------------------------------------------------------------

console.log('\n---');
console.log('Summary:');
console.log('  - Custom peer_support tier with daily epochs (24h exposure window)');
console.log('  - Dani joined on day 2: gets day 2 onwards, cannot read day 1');
console.log('  - Ben left on day 3: keeps days 1 + 2, cannot read day 3');
console.log('  - All membership changes are routine config mutations');
console.log('  - Signet credential gating is a Muster client concern, not a protocol concern');
