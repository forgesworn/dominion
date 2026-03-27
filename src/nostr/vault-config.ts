import { KIND_VAULT_CONFIG, PROTOCOL_LABEL } from '../constants.js';
import type { DominionConfig, NostrEvent } from '../types.js';

const HEX64_RE = /^[0-9a-f]{64}$/;

/**
 * Build a NIP-78 (kind 30078) vault config event.
 *
 * IMPORTANT: Returns an UNENCRYPTED event with plaintext JSON in `content`.
 * The caller is responsible for NIP-44 self-encryption before publishing.
 */
export function buildVaultConfigEvent(authorPubkey: string, config: DominionConfig): NostrEvent {
  if (!HEX64_RE.test(authorPubkey)) throw new Error('Invalid author pubkey');
  return {
    kind: KIND_VAULT_CONFIG,
    pubkey: authorPubkey,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['d', 'dominion:vault-config'],
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
      if (!(v as unknown[]).every((e: unknown) => typeof e === 'string' && HEX64_RE.test(e))) return null;
    }

    for (const g of obj.individualGrants) {
      if (!g || typeof g !== 'object') return null;
      if (typeof g.pubkey !== 'string' || typeof g.label !== 'string' || typeof g.grantedAt !== 'number') return null;
      if (!HEX64_RE.test(g.pubkey)) return null;
    }

    if (!obj.revokedPubkeys.every((p: unknown) => typeof p === 'string' && HEX64_RE.test(p))) return null;

    // Validate optional epochConfig values
    const VALID_EPOCH_LENGTHS = ['daily', 'weekly', 'monthly'];
    if (obj.epochConfig !== undefined) {
      if (!obj.epochConfig || typeof obj.epochConfig !== 'object' || Array.isArray(obj.epochConfig)) return null;
      if (Object.keys(obj.epochConfig).some((k: string) => DANGEROUS_KEYS.includes(k))) return null;
      for (const v of Object.values(obj.epochConfig)) {
        if (!VALID_EPOCH_LENGTHS.includes(v as string)) return null;
      }
    }

    // Validate optional blossomUrl
    if (obj.blossomUrl !== undefined) {
      if (typeof obj.blossomUrl !== 'string') return null;
      if (!/^https?:\/\//.test(obj.blossomUrl)) return null;
    }

    return obj as DominionConfig;
  } catch {
    return null;
  }
}

/**
 * Build a Nostr filter for vault config events.
 */
export function buildVaultConfigFilter(authorPubkey: string): Record<string, unknown> {
  if (!HEX64_RE.test(authorPubkey)) throw new Error('Invalid author pubkey');
  return {
    kinds: [KIND_VAULT_CONFIG],
    authors: [authorPubkey],
    '#d': ['dominion:vault-config'],
  };
}
