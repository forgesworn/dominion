import { KIND_VAULT_SHARE, PROTOCOL_LABEL } from '../constants.js';
import type { NostrEvent, VaultShareData, CryptoAlgorithm } from '../types.js';

/**
 * Build a kind 30480 vault share event (unsigned, unencrypted).
 * Caller is responsible for NIP-44 encryption + NIP-59 gift-wrapping.
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

  const tags = event.tags as string[][] | undefined;
  if (!tags) return null;

  const dTag = tags.find(t => t[0] === 'd');
  if (!dTag || !dTag[1]) return null;

  const tierTag = tags.find(t => t[0] === 'tier');
  const algoTag = tags.find(t => t[0] === 'algo');

  if (typeof event.pubkey !== 'string' || typeof event.content !== 'string') return null;

  const colonIdx = dTag[1].indexOf(':');
  const epochId = colonIdx !== -1 ? dTag[1].slice(0, colonIdx) : dTag[1];
  const tier = tierTag?.[1] ?? (colonIdx !== -1 ? dTag[1].slice(colonIdx + 1) : 'unknown');

  return {
    fromPubkey: event.pubkey,
    epochId,
    ckHex: event.content,
    tier,
    algorithm: (algoTag?.[1] ?? 'secp256k1') as CryptoAlgorithm,
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
