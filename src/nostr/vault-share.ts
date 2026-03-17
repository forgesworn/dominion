import { KIND_VAULT_SHARE, PROTOCOL_LABEL } from '../constants.js';
import type { NostrEvent, VaultShareData, CryptoAlgorithm } from '../types.js';

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
  tier: string
): NostrEvent {
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
  if (!tags.every(t => Array.isArray(t))) return null;
  const safeTags = tags as string[][];

  const dTag = safeTags.find(t => t[0] === 'd');
  if (!dTag || !dTag[1]) return null;

  const tierTag = safeTags.find(t => t[0] === 'tier');
  const algoTag = safeTags.find(t => t[0] === 'algo');

  if (typeof event.pubkey !== 'string' || typeof event.content !== 'string') return null;

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
 */
export function buildVaultShareFilter(
  authorPubkey: string,
  epochId?: string
): Record<string, unknown> {
  const filter: Record<string, unknown> = {
    kinds: [KIND_VAULT_SHARE],
    authors: [authorPubkey],
  };
  if (epochId) {
    filter['#d'] = [epochId];
  }
  return filter;
}
