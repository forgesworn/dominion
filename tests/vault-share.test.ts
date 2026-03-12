import { describe, it, expect } from 'vitest';
import { buildVaultShareEvent, parseVaultShare, buildVaultShareFilter } from '../src/nostr/vault-share.js';

const AUTHOR = 'aa'.repeat(32);
const RECIPIENT = 'bb'.repeat(32);
const CK_HEX = 'cc'.repeat(32);

describe('buildVaultShareEvent', () => {
  it('creates a kind 30480 event with correct structure', () => {
    const event = buildVaultShareEvent(AUTHOR, RECIPIENT, CK_HEX, '2026-W09', 'family');
    expect(event.kind).toBe(30480);
    expect(event.pubkey).toBe(AUTHOR);
    expect(event.content).toBe(CK_HEX);
    expect(event.tags).toContainEqual(['d', '2026-W09:family']);
    expect(event.tags).toContainEqual(['p', RECIPIENT]);
    expect(event.tags).toContainEqual(['tier', 'family']);
    expect(event.tags).toContainEqual(['algo', 'secp256k1']);
    expect(event.tags).toContainEqual(['L', 'dominion']);
    expect(event.tags).toContainEqual(['l', 'share', 'dominion']);
  });

  it('sets created_at to a recent timestamp', () => {
    const event = buildVaultShareEvent(AUTHOR, RECIPIENT, CK_HEX, '2026-W09', 'family');
    const now = Math.floor(Date.now() / 1000);
    expect(event.created_at).toBeGreaterThan(now - 10);
    expect(event.created_at).toBeLessThanOrEqual(now);
  });
});

describe('parseVaultShare', () => {
  it('parses a valid vault share event', () => {
    const event = buildVaultShareEvent(AUTHOR, RECIPIENT, CK_HEX, '2026-W09', 'family');
    const parsed = parseVaultShare(event);
    expect(parsed).not.toBeNull();
    expect(parsed!.fromPubkey).toBe(AUTHOR);
    expect(parsed!.epochId).toBe('2026-W09');
    expect(parsed!.ckHex).toBe(CK_HEX);
    expect(parsed!.tier).toBe('family');
    expect(parsed!.algorithm).toBe('secp256k1');
  });

  it('returns null for wrong kind', () => {
    const event = buildVaultShareEvent(AUTHOR, RECIPIENT, CK_HEX, '2026-W09', 'family');
    (event as Record<string, unknown>).kind = 1;
    expect(parseVaultShare(event)).toBeNull();
  });

  it('returns null for missing d tag', () => {
    const event = buildVaultShareEvent(AUTHOR, RECIPIENT, CK_HEX, '2026-W09', 'family');
    event.tags = event.tags.filter(t => t[0] !== 'd');
    expect(parseVaultShare(event)).toBeNull();
  });
});

describe('buildVaultShareFilter', () => {
  it('creates a filter for all shares from an author', () => {
    const filter = buildVaultShareFilter(AUTHOR);
    expect(filter).toEqual({
      kinds: [30480],
      authors: [AUTHOR],
    });
  });

  it('creates a filter for a specific epoch', () => {
    const filter = buildVaultShareFilter(AUTHOR, '2026-W09');
    expect(filter).toHaveProperty('#d');
  });
});
