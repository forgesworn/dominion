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
 *   - Weekly epochs across three sessions
 *   - A peer joining the group mid-cycle
 *   - A peer leaving the group, with revocation as the routine path
 *   - How a Muster-style client would gate membership on a Signet
 *     credential check (sketched in comments — the actual cross-package
 *     integration lives in a separate example)
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
// Weekly epochs are the protocol's recommended default (spec §4) and
// what the `getEpochIdForDate` helper returns. The spec allows per-tier
// daily epochs for higher-churn membership; implementing daily IDs is
// a client-side extension at present.

let config = defaultConfig();
config = addToTier(config, 'peer_support', ALICE);
config = addToTier(config, 'peer_support', BEN);
config = addToTier(config, 'peer_support', CHRIS);
config = {
  ...config,
  epochConfig: { peer_support: 'weekly' },
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
// 3. Week 16 — first session
// ---------------------------------------------------------------------------

const week16 = getEpochIdForDate(new Date('2026-04-13'));
const week16Ck = deriveContentKey(HOST_PRIVKEY, week16, 'peer_support');

console.log(`\nWeek 16 epoch:  ${week16}`);
console.log(`Week 16 CK:     ${contentKeyToHex(week16Ck)}`);

const week16Message = 'Welcome everyone. Tonight we\'re going to talk about sleep.';
const week16Ciphertext = encrypt(week16Message, week16Ck);

const sharesWeek16 = (config.tiers['peer_support'] as string[]).map((peer) =>
  buildVaultShareEvent(HOST_PUBKEY, peer, contentKeyToHex(week16Ck), week16, 'peer_support'),
);

console.log(`Distributed ${sharesWeek16.length} shares for week 16`);

// Each peer unwraps their gift, decrypts the share, and reads the message.
console.assert(decrypt(week16Ciphertext, week16Ck) === week16Message, 'Week 16 round-trip failed');

// ---------------------------------------------------------------------------
// 4. Week 17 — Dani joins the group
// ---------------------------------------------------------------------------
//
// A new peer is added the following week. They are sent the CURRENT
// epoch CK only — the protocol's grant scope rule. Dani can read this
// week's session onwards but cannot retroactively decrypt week 16.

config = addToTier(config, 'peer_support', DANI);

const week17 = getEpochIdForDate(new Date('2026-04-20'));
const week17Ck = deriveContentKey(HOST_PRIVKEY, week17, 'peer_support');

console.log(`\nWeek 17 epoch:  ${week17}`);
console.log(`Members:        ${(config.tiers['peer_support'] as string[]).length}`);

const sharesWeek17 = (config.tiers['peer_support'] as string[]).map((peer) =>
  buildVaultShareEvent(HOST_PUBKEY, peer, contentKeyToHex(week17Ck), week17, 'peer_support'),
);

console.log(`Distributed ${sharesWeek17.length} shares for week 17 (Dani included)`);

// Dani only ever received the week 17 CK. Her cached key cannot decrypt week 16.
let daniCanReadWeek16 = true;
try {
  decrypt(week16Ciphertext, week17Ck);
} catch {
  daniCanReadWeek16 = false;
}
console.log(`Dani tries to decrypt week 16 with her week 17 key: ${daniCanReadWeek16 ? 'succeeded (BUG)' : 'failed (correct)'}`);
console.assert(!daniCanReadWeek16, 'Grant scope violated — new joiner saw historical content');

// ---------------------------------------------------------------------------
// 5. Week 18 — Ben steps away
// ---------------------------------------------------------------------------
//
// Ben quietly leaves the group. This is the routine path: no
// confrontation, no incident, just a config change. Removing him from
// the tier means the next epoch rotation skips him.

config = removeFromTier(config, 'peer_support', BEN);

const week18 = getEpochIdForDate(new Date('2026-04-27'));
const week18Ck = deriveContentKey(HOST_PRIVKEY, week18, 'peer_support');

console.log(`\nWeek 18 epoch:  ${week18}`);
console.log(`Members:        ${(config.tiers['peer_support'] as string[]).length}`);

const sharesWeek18 = (config.tiers['peer_support'] as string[]).map((peer) =>
  buildVaultShareEvent(HOST_PUBKEY, peer, contentKeyToHex(week18Ck), week18, 'peer_support'),
);

console.log(`Distributed ${sharesWeek18.length} shares for week 18 (Ben excluded)`);

console.assert(
  !sharesWeek18.some((s) => s.tags.find((t) => t[0] === 'p')?.[1] === BEN),
  'Ben should not appear in week 18 distribution',
);

// Ben can still read weeks 16 and 17 from his cached CKs. He cannot
// read week 18 — the new CK was never sent to him. The exposure
// window after removal is bounded by the remaining time in the
// current epoch (worst case: 7 days).

const week18Message = 'Quiet check-in tonight. Take what you need from the group.';
const week18Ciphertext = encrypt(week18Message, week18Ck);

let benCanReadWeek18 = true;
try {
  decrypt(week18Ciphertext, week16Ck);
} catch {
  benCanReadWeek18 = false;
}
console.log(`Ben tries week 16 key on week 18 message: ${benCanReadWeek18 ? 'succeeded (BUG)' : 'failed (correct)'}`);
console.assert(!benCanReadWeek18, 'Forward-only revocation breach');

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
console.log('  - Custom peer_support tier with weekly epochs');
console.log('  - Dani joined in week 17: gets week 17 onwards, cannot read week 16');
console.log('  - Ben left in week 18: keeps weeks 16 + 17, cannot read week 18');
console.log('  - All membership changes are routine config mutations');
console.log('  - Signet credential gating is a Muster client concern, not a protocol concern');
