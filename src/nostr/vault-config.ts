import { KIND_VAULT_CONFIG, PROTOCOL_LABEL } from '../constants.js';
import type { DominionConfig, NostrEvent } from '../types.js';

/**
 * Build a kind 30481 vault config event.
 *
 * IMPORTANT: Returns an UNENCRYPTED event with plaintext JSON in `content`.
 * The caller is responsible for NIP-44 self-encryption before publishing.
 */
export function buildVaultConfigEvent(authorPubkey: string, config: DominionConfig): NostrEvent {
  return {
    kind: KIND_VAULT_CONFIG,
    pubkey: authorPubkey,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['d', 'vault-config'],
      ['encrypted', 'nip44'],
      ['algo', 'secp256k1'],
      ['L', PROTOCOL_LABEL],
      ['l', 'config', PROTOCOL_LABEL],
    ],
    content: JSON.stringify(config),
  };
}

/**
 * Parse pre-decrypted JSON into a DominionConfig.
 * Returns null if the JSON is invalid or missing required fields.
 */
export function parseVaultConfig(contentJson: string): DominionConfig | null {
  try {
    const obj = JSON.parse(contentJson);
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
    if (!obj.tiers || typeof obj.tiers !== 'object' || Array.isArray(obj.tiers)) return null;
    if (!Array.isArray(obj.individualGrants)) return null;
    if (!Array.isArray(obj.revokedPubkeys)) return null;

    const DANGEROUS_KEYS = ['__proto__', 'constructor', 'prototype'];
    if (Object.keys(obj.tiers).some((k: string) => DANGEROUS_KEYS.includes(k))) return null;

    for (const [, v] of Object.entries(obj.tiers)) {
      if (v === 'auto') continue;
      if (!Array.isArray(v)) return null;
      if (!(v as unknown[]).every((e: unknown) => typeof e === 'string')) return null;
    }

    for (const g of obj.individualGrants) {
      if (!g || typeof g !== 'object') return null;
      if (typeof g.pubkey !== 'string' || typeof g.label !== 'string' || typeof g.grantedAt !== 'number') return null;
    }

    if (!obj.revokedPubkeys.every((p: unknown) => typeof p === 'string')) return null;

    return obj as DominionConfig;
  } catch {
    return null;
  }
}

/**
 * Build a Nostr filter for vault config events.
 */
export function buildVaultConfigFilter(authorPubkey: string): Record<string, unknown> {
  return {
    kinds: [KIND_VAULT_CONFIG],
    authors: [authorPubkey],
    '#d': ['vault-config'],
  };
}
