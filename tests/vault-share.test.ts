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
    expect(event.tags).toContainEqual(['encrypted', 'nip44']);
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

  it('rejects invalid author pubkey', () => {
    expect(() => buildVaultShareEvent('bad', RECIPIENT, CK_HEX, '2026-W09', 'family'))
      .toThrow('Invalid author pubkey');
  });

  it('rejects invalid recipient pubkey', () => {
    expect(() => buildVaultShareEvent(AUTHOR, 'bad', CK_HEX, '2026-W09', 'family'))
      .toThrow('Invalid recipient pubkey');
  });

  it('rejects invalid content key hex', () => {
    expect(() => buildVaultShareEvent(AUTHOR, RECIPIENT, 'bad', '2026-W09', 'family'))
      .toThrow('Invalid content key hex');
  });

  it('rejects empty epochId', () => {
    expect(() => buildVaultShareEvent(AUTHOR, RECIPIENT, CK_HEX, '', 'family'))
      .toThrow('Epoch ID must not be empty');
  });

  it('rejects empty tier', () => {
    expect(() => buildVaultShareEvent(AUTHOR, RECIPIENT, CK_HEX, '2026-W09', ''))
      .toThrow('Tier must not be empty');
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

  it('returns null for missing pubkey', () => {
    const event = buildVaultShareEvent(AUTHOR, RECIPIENT, CK_HEX, '2026-W09', 'family');
    const malformed = { ...event, pubkey: undefined };
    expect(parseVaultShare(malformed)).toBeNull();
  });

  it('returns null for missing content', () => {
    const event = buildVaultShareEvent(AUTHOR, RECIPIENT, CK_HEX, '2026-W09', 'family');
    const malformed = { ...event, content: undefined };
    expect(parseVaultShare(malformed)).toBeNull();
  });

  it('returns null for missing tags', () => {
    const malformed = { kind: 30480, pubkey: AUTHOR, content: CK_HEX, created_at: 0 };
    expect(parseVaultShare(malformed)).toBeNull();
  });

  it('falls back to secp256k1 when algo tag is absent', () => {
    const event = buildVaultShareEvent(AUTHOR, RECIPIENT, CK_HEX, '2026-W09', 'family');
    event.tags = event.tags.filter(t => t[0] !== 'algo');
    const parsed = parseVaultShare(event);
    expect(parsed!.algorithm).toBe('secp256k1');
  });

  it('falls back to d-tag suffix when tier tag is absent', () => {
    const event = buildVaultShareEvent(AUTHOR, RECIPIENT, CK_HEX, '2026-W09', 'family');
    event.tags = event.tags.filter(t => t[0] !== 'tier');
    const parsed = parseVaultShare(event);
    expect(parsed!.tier).toBe('family');
  });

  it('returns null for unknown algorithm', () => {
    const event = buildVaultShareEvent(AUTHOR, RECIPIENT, CK_HEX, '2026-W09', 'family');
    const algoIdx = event.tags.findIndex(t => t[0] === 'algo');
    event.tags[algoIdx] = ['algo', 'rsa-2048'];
    expect(parseVaultShare(event)).toBeNull();
  });

  it('returns null for non-array tag elements', () => {
    const malformed = {
      kind: 30480, pubkey: AUTHOR, content: CK_HEX, created_at: 0,
      tags: [123, null, ['d', '2026-W09:family']],
    };
    expect(parseVaultShare(malformed)).toBeNull();
  });

  it('returns null for non-string inner tag elements', () => {
    const malformed = {
      kind: 30480, pubkey: AUTHOR, content: CK_HEX, created_at: 0,
      tags: [['d', 12345]],
    };
    expect(parseVaultShare(malformed)).toBeNull();
  });

  it('handles d-tag without colon — returns tier unknown', () => {
    const malformed = {
      kind: 30480, pubkey: AUTHOR, content: CK_HEX, created_at: 0,
      tags: [['d', '2026-W09'], ['L', 'dominion']],
    };
    const parsed = parseVaultShare(malformed);
    expect(parsed).not.toBeNull();
    expect(parsed!.epochId).toBe('2026-W09');
    expect(parsed!.tier).toBe('unknown');
  });

  it('returns null for non-hex content (ckHex validation)', () => {
    const malformed = {
      kind: 30480, pubkey: AUTHOR, content: 'not-valid-hex', created_at: 0,
      tags: [['d', '2026-W09:family']],
    };
    expect(parseVaultShare(malformed)).toBeNull();
  });

  it('returns null for wrong-length hex content', () => {
    const malformed = {
      kind: 30480, pubkey: AUTHOR, content: 'aabb', created_at: 0,
      tags: [['d', '2026-W09:family']],
    };
    expect(parseVaultShare(malformed)).toBeNull();
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

  it('creates a filter with no #d when only epochId provided (no tier)', () => {
    const filter = buildVaultShareFilter(AUTHOR, '2026-W09');
    expect(filter).not.toHaveProperty('#d');
  });

  it('creates a filter matching the d-tag when epochId and tier provided', () => {
    const filter = buildVaultShareFilter(AUTHOR, '2026-W09', 'family');
    expect(filter).toEqual({
      kinds: [30480],
      authors: [AUTHOR],
      '#d': ['2026-W09:family'],
    });
    // Verify filter d-tag matches what the builder produces
    const event = buildVaultShareEvent(AUTHOR, RECIPIENT, CK_HEX, '2026-W09', 'family');
    const dTag = event.tags.find(t => t[0] === 'd');
    expect((filter['#d'] as string[])[0]).toBe(dTag![1]);
  });

  it('rejects invalid author pubkey', () => {
    expect(() => buildVaultShareFilter('bad')).toThrow('Invalid author pubkey');
  });
});
