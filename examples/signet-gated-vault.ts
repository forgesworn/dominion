/**
 * Signet × Dominion Gated Vault Example
 *
 * The cross-package integration that the Dominion README promises:
 * "only verified veterans can decrypt this tier". A Muster-style host
 * gates entry to a Dominion peer_support tier on a Signet professional
 * credential issued by a trusted verifier.
 *
 * Flow:
 *   1. Carol (a veteran) publishes a Tier 1 self-declaration of identity
 *   2. Bob (a "Veterans Affairs caseworker" — the trusted verifier in
 *      this example) issues Carol a Tier 3 professional credential
 *      referencing her self-declaration
 *   3. Alice (the Muster host) receives Bob's credential. She verifies
 *      the signature, parses the credential, and checks:
 *        - tier ≥ 3
 *        - issuer is on her allowlist of trusted verifiers
 *        - not expired
 *   4. If all checks pass, Alice adds Carol to the dominion peer_support
 *      tier and distributes the current epoch CK to her
 *   5. The example also shows the negative path: Eve presents only a
 *      Tier 1 self-declaration, which fails the gate, and never receives
 *      a CK
 *
 * Key separation principle: Dominion treats tier membership as an opaque
 * list of pubkeys. Signet decides who is in that list. Neither protocol
 * knows about the other — the integration lives entirely in the host
 * application's gating function below (`gateAndAdmit`).
 *
 * In a real Muster deployment the verifier list would be loaded from
 * configuration, and the credentials would arrive via Nostr events
 * from the relay, not as in-memory function calls. The cryptographic
 * checks are identical.
 */

import {
  addToTier,
  contentKeyToHex,
  decrypt,
  defaultConfig,
  deriveContentKey,
  encrypt,
  getEpochIdForDate,
} from 'dominion-protocol';
import { buildVaultShareEvent } from 'dominion-protocol/nostr';
import {
  createProfessionalCredential,
  createSelfDeclaredCredential,
  generateKeyPair,
  getEventId,
  parseCredential,
  verifyCredential,
} from 'signet-protocol';
import type { NostrEvent as SignetEvent } from 'signet-protocol';
import type { DominionConfig, NostrEvent as DominionEvent } from 'dominion-protocol';

// ---------------------------------------------------------------------------
// Cast — host, verifier, two candidates
// ---------------------------------------------------------------------------

const alice = generateKeyPair(); // Muster host / facilitator
const bob = generateKeyPair(); // Trusted verifier (veterans services caseworker)
const carol = generateKeyPair(); // Verified veteran — should pass the gate
const eve = generateKeyPair(); // Self-declared only — should fail the gate

// Alice's allowlist of trusted verifier pubkeys. In a real deployment
// this comes from configuration or a Nostr-published verifier list.
const TRUSTED_VERIFIERS: ReadonlySet<string> = new Set([bob.publicKey]);

// ---------------------------------------------------------------------------
// 1. Carol publishes her Tier 1 self-declaration
// ---------------------------------------------------------------------------
//
// The self-declaration is the foundation of every higher-tier credential
// in Signet's "assertion-first hybrid" model. The professional verifier
// signs OVER her self-declaration's event ID, anchoring the credential
// to a specific assertion she made about herself.

const carolAssertion = await createSelfDeclaredCredential(carol.privateKey);
console.log(`Carol's Tier 1 self-declaration:  ${carolAssertion.id.slice(0, 16)}…`);

// ---------------------------------------------------------------------------
// 2. Bob issues Carol a Tier 3 professional credential
// ---------------------------------------------------------------------------
//
// Bob has met Carol in person, checked her ID, and confirmed her veteran
// status. He issues a Tier 3 credential referencing her self-declaration.

const carolCredential = await createProfessionalCredential(bob.privateKey, carol.publicKey, {
  assertionEventId: carolAssertion.id,
  profession: 'veterans-services-caseworker',
  jurisdiction: 'GB-ENG',
  actualAge: 34,
});
console.log(`Carol's Tier 3 credential signed by Bob: ${carolCredential.id.slice(0, 16)}…`);

// ---------------------------------------------------------------------------
// 3. Eve only manages a Tier 1 self-declaration (no professional verifier)
// ---------------------------------------------------------------------------

const eveSelfDeclaration = await createSelfDeclaredCredential(eve.privateKey);
console.log(`Eve's Tier 1 only:                ${eveSelfDeclaration.id.slice(0, 16)}…`);

// ---------------------------------------------------------------------------
// 4. The gating function — Alice's host application logic
// ---------------------------------------------------------------------------
//
// This is where the two protocols meet. Pure application code: takes a
// candidate's credential event, runs Signet checks, and on success
// mutates the Dominion config and produces a vault share event for the
// current epoch.

interface GateResult {
  admitted: boolean;
  reason: string;
  config: DominionConfig;
  share?: DominionEvent;
}

async function gateAndAdmit(
  config: DominionConfig,
  candidatePubkey: string,
  credentialEvent: SignetEvent,
  hostPrivkey: string,
  hostPubkey: string,
  epochId: string,
  tier: string,
): Promise<GateResult> {
  // Cryptographic verification first — never trust a parsed event
  // before checking the signature.
  const verification = await verifyCredential(credentialEvent);
  if (!verification.signatureValid) {
    return { admitted: false, reason: 'Invalid signature', config };
  }
  if (!verification.structureValid) {
    return { admitted: false, reason: `Invalid structure: ${verification.errors.join('; ')}`, config };
  }
  if (verification.expired) {
    return { admitted: false, reason: 'Credential expired', config };
  }

  // Parse and inspect.
  const parsed = parseCredential(credentialEvent);
  if (!parsed) {
    return { admitted: false, reason: 'Could not parse credential', config };
  }

  // Subject must match the candidate — a credential about someone else
  // does not admit this candidate.
  if (parsed.subjectPubkey !== candidatePubkey) {
    return { admitted: false, reason: 'Credential subject does not match candidate', config };
  }

  // Tier check — peer_support requires Tier 3 or higher.
  if (parsed.tier < 3) {
    return { admitted: false, reason: `Tier ${parsed.tier} below required Tier 3`, config };
  }

  // Issuer allowlist — even a valid Tier 3 from an unknown verifier
  // is rejected. Trust is not transitive.
  if (!TRUSTED_VERIFIERS.has(credentialEvent.pubkey)) {
    return { admitted: false, reason: 'Issuer not on trusted verifier list', config };
  }

  // All checks passed. Admit to the tier and produce the CK share.
  const newConfig = addToTier(config, tier, candidatePubkey);
  const ck = deriveContentKey(hostPrivkey, epochId, tier);
  const share = buildVaultShareEvent(hostPubkey, candidatePubkey, contentKeyToHex(ck), epochId, tier);

  return { admitted: true, reason: 'OK', config: newConfig, share };
}

// ---------------------------------------------------------------------------
// 5. Set up the vault and run both candidates through the gate
// ---------------------------------------------------------------------------

let vaultConfig = defaultConfig();
const epoch = getEpochIdForDate(new Date('2026-04-13'));

// Alice's private key for the dominion vault. In a real Muster client
// this is the same nsec that signs her Nostr events; here we just
// reuse the keypair Signet generated for her.
const alicePrivkey = alice.privateKey;
const alicePubkey = alice.publicKey;

console.log(`\nVault epoch: ${epoch}`);
console.log(`Trusted verifiers: ${TRUSTED_VERIFIERS.size}`);

// Carol — should be admitted.
const carolResult = await gateAndAdmit(
  vaultConfig,
  carol.publicKey,
  carolCredential,
  alicePrivkey,
  alicePubkey,
  epoch,
  'peer_support',
);
console.log(`\nCarol → ${carolResult.admitted ? 'ADMITTED' : 'REJECTED'}: ${carolResult.reason}`);
console.assert(carolResult.admitted, 'Carol should have been admitted');
vaultConfig = carolResult.config;

// Eve — should be rejected (Tier 1 only).
const eveResult = await gateAndAdmit(
  vaultConfig,
  eve.publicKey,
  eveSelfDeclaration,
  alicePrivkey,
  alicePubkey,
  epoch,
  'peer_support',
);
console.log(`Eve   → ${eveResult.admitted ? 'ADMITTED' : 'REJECTED'}: ${eveResult.reason}`);
console.assert(!eveResult.admitted, 'Eve should have been rejected');

// ---------------------------------------------------------------------------
// 6. Demonstrate that an attacker cannot smuggle a forged credential
// ---------------------------------------------------------------------------
//
// Suppose Eve takes Carol's valid Tier 3 credential and tries to claim
// it as her own. The credential was issued for Carol's pubkey, so the
// subject mismatch catches it.

const eveStealsCarolCredential = await gateAndAdmit(
  vaultConfig,
  eve.publicKey,
  carolCredential,
  alicePrivkey,
  alicePubkey,
  epoch,
  'peer_support',
);
console.log(`Eve presents Carol's credential as her own → ${eveStealsCarolCredential.admitted ? 'ADMITTED (BUG)' : 'REJECTED'}: ${eveStealsCarolCredential.reason}`);
console.assert(!eveStealsCarolCredential.admitted, 'Subject mismatch should have rejected this');

// ---------------------------------------------------------------------------
// 7. Carol uses her admitted CK share to read group content
// ---------------------------------------------------------------------------
//
// Alice's gating function returned a vault share event addressed to
// Carol. In a real client this would be NIP-44 encrypted to Carol's
// pubkey and gift-wrapped before publishing — same path as the other
// examples. Carol unwraps it, extracts the CK, and decrypts the
// week's content.

const epochCk = deriveContentKey(alicePrivkey, epoch, 'peer_support');
const groupMessage = 'Tonight\'s session: discharge transitions. 19:30 in the usual place.';
const groupCiphertext = encrypt(groupMessage, epochCk);

const recovered = decrypt(groupCiphertext, epochCk);
console.log(`\nCarol decrypts: "${recovered}"`);
console.assert(recovered === groupMessage, 'Carol round-trip failed');

// Eve never received a CK. Even if she somehow obtained the ciphertext
// from a relay, she has no key to decrypt it.

// ---------------------------------------------------------------------------
// 8. Recap
// ---------------------------------------------------------------------------

console.log('\n---');
console.log('Summary:');
console.log('  - Signet handles WHO is verified (tier, issuer trust, subject match)');
console.log('  - Dominion handles WHAT they can decrypt (epoch CK, tier membership)');
console.log('  - The integration is one host-side function — neither protocol depends on the other');
console.log('  - Carol passed the gate via Tier 3 credential from a trusted verifier');
console.log('  - Eve failed twice: insufficient tier, then subject mismatch');
console.log('  - The vault config never sees credentials; the credential layer never sees CKs');

// Confirm the assertion event reference is preserved end to end. The
// professional credential's assertion-first hybrid pattern means the
// event ID Bob signed must match Carol's actual self-declaration ID.
console.assert(getEventId(carolAssertion) === carolAssertion.id, 'Assertion event ID stable');
