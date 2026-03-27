import { KIND_VAULT_SHARE, PROTOCOL_LABEL } from '../constants.js';
import type { CryptoAlgorithm, NostrEvent, VaultShareData } from '../types.js';

const HEX64_RE = /^[0-9a-f]{64}$/;

/**
 * Build a kind 30480 vault share event (unsigned, unencrypted).
 *
 * @security The `content` field contains the RAW CONTENT KEY in hex.
 * This event MUST be NIP-44 encrypted and NIP-59 gift-wrapped before
 * publishing. Publishing without encryption leaks the content key.
 */
export function buildVaultShareEvent(
  authorPubkey: string,
  recipientPubkey: string,
  ckHex: string,
  epochId: string,
  tier: string,
): NostrEvent {
  if (!HEX64_RE.test(authorPubkey)) throw new Error('Invalid author pubkey');
  if (!HEX64_RE.test(recipientPubkey)) throw new Error('Invalid recipient pubkey');
  if (!HEX64_RE.test(ckHex)) throw new Error('Invalid content key hex');
  if (!epochId) throw new Error('Epoch ID must not be empty');
  if (!tier) throw new Error('Tier must not be empty');
  return {
    kind: KIND_VAULT_SHARE,
    pubkey: authorPubkey,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['d', `${epochId}:${tier}`],
      ['p', recipientPubkey],
      ['tier', tier],
      ['encrypted', 'nip44'],
      ['algo', 'secp256k1'],
      ['L', PROTOCOL_LABEL],
      ['l', 'share', PROTOCOL_LABEL],
    ],
    content: ckHex,
  };
}

/**
 * Parse a vault share event into structured data.
 * Returns null if the event is not a valid kind 30480.
 */
export function parseVaultShare(event: Record<string, unknown>): VaultShareData | null {
  if (event.kind !== KIND_VAULT_SHARE) return null;

  if (!Array.isArray(event.tags)) return null;
  const tags = event.tags as unknown[];
  if (!tags.every((t) => Array.isArray(t) && t.every((e) => typeof e === 'string'))) return null;
  const safeTags = tags as string[][];

  const dTag = safeTags.find((t) => t[0] === 'd');
  if (!dTag?.[1]) return null;

  const tierTag = safeTags.find((t) => t[0] === 'tier');
  const algoTag = safeTags.find((t) => t[0] === 'algo');

  if (typeof event.pubkey !== 'string' || typeof event.content !== 'string') return null;
  if (!HEX64_RE.test(event.content)) return null;

  const algo = algoTag?.[1] ?? 'secp256k1';
  if (algo !== 'secp256k1') return null;

  const colonIdx = dTag[1].indexOf(':');
  const epochId = colonIdx !== -1 ? dTag[1].slice(0, colonIdx) : dTag[1];
  const tier = tierTag?.[1] ?? (colonIdx !== -1 ? dTag[1].slice(colonIdx + 1) : 'unknown');

  return {
    fromPubkey: event.pubkey,
    epochId,
    ckHex: event.content,
    tier,
    algorithm: algo as CryptoAlgorithm,
  };
}

/**
 * Build a Nostr filter for vault share events.
 * When both epochId and tier are provided, filters by the exact d-tag value.
 * When only authorPubkey is provided, returns all shares from that author.
 */
export function buildVaultShareFilter(authorPubkey: string, epochId?: string, tier?: string): Record<string, unknown> {
  if (!HEX64_RE.test(authorPubkey)) throw new Error('Invalid author pubkey');
  const filter: Record<string, unknown> = {
    kinds: [KIND_VAULT_SHARE],
    authors: [authorPubkey],
  };
  if (epochId && tier) {
    filter['#d'] = [`${epochId}:${tier}`];
  }
  return filter;
}
