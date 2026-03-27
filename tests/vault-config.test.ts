import { describe, expect, it } from 'vitest';
import { addIndividualGrant, addToTier, defaultConfig } from '../src/config.js';
import { buildVaultConfigEvent, buildVaultConfigFilter, parseVaultConfig } from '../src/nostr/vault-config.js';

const AUTHOR = 'aa'.repeat(32);

describe('buildVaultConfigEvent', () => {
  it('creates a NIP-78 (kind 30078) event with plaintext JSON content', () => {
    const config = defaultConfig();
    const event = buildVaultConfigEvent(AUTHOR, config);
    expect(event.kind).toBe(30078);
    expect(event.pubkey).toBe(AUTHOR);
    expect(event.tags).toContainEqual(['d', 'dominion:vault-config']);
    expect(event.tags).toContainEqual(['encrypted', 'nip44']);
    expect(event.tags).toContainEqual(['algo', 'secp256k1']);
    expect(event.tags).toContainEqual(['L', 'dominion']);
    expect(event.tags).toContainEqual(['l', 'config', 'dominion']);

    // Content is plaintext JSON (caller encrypts)
    const parsed = JSON.parse(event.content);
    expect(parsed.tiers).toBeDefined();
    expect(parsed.individualGrants).toBeDefined();
    expect(parsed.revokedPubkeys).toBeDefined();
  });
});

describe('parseVaultConfig', () => {
  it('parses valid JSON into DominionConfig', () => {
    let config = defaultConfig();
    config = addToTier(config, 'family', 'pubkey1');
    config = addIndividualGrant(config, 'pubkey2', 'Tutor');

    const json = JSON.stringify(config);
    const parsed = parseVaultConfig(json);
    expect(parsed).not.toBeNull();
    expect(parsed!.tiers.family).toContain('pubkey1');
    expect(parsed!.individualGrants).toHaveLength(1);
    expect(parsed!.individualGrants[0].pubkey).toBe('pubkey2');
  });

  it('returns null for invalid JSON', () => {
    expect(parseVaultConfig('not json')).toBeNull();
  });

  it('returns null for JSON missing required fields', () => {
    expect(parseVaultConfig('{"foo": "bar"}')).toBeNull();
  });

  it('returns null for JSON with non-object tiers', () => {
    expect(parseVaultConfig('{"tiers": "string", "individualGrants": [], "revokedPubkeys": []}')).toBeNull();
  });

  it('returns null for JSON with non-array individualGrants', () => {
    expect(parseVaultConfig('{"tiers": {}, "individualGrants": "string", "revokedPubkeys": []}')).toBeNull();
  });

  it('returns null for JSON with non-array revokedPubkeys', () => {
    expect(parseVaultConfig('{"tiers": {}, "individualGrants": [], "revokedPubkeys": "string"}')).toBeNull();
  });

  it('returns null for null JSON value', () => {
    expect(parseVaultConfig('null')).toBeNull();
  });

  it('returns null for JSON array', () => {
    expect(parseVaultConfig('[]')).toBeNull();
  });

  it('returns null for __proto__ key in tiers (prototype pollution)', () => {
    expect(
      parseVaultConfig('{"tiers": {"__proto__": ["attacker"]}, "individualGrants": [], "revokedPubkeys": []}'),
    ).toBeNull();
  });

  it('returns null for constructor key in tiers', () => {
    expect(
      parseVaultConfig('{"tiers": {"constructor": ["attacker"]}, "individualGrants": [], "revokedPubkeys": []}'),
    ).toBeNull();
  });

  it('returns null for non-array, non-auto tier value', () => {
    expect(parseVaultConfig('{"tiers": {"family": 42}, "individualGrants": [], "revokedPubkeys": []}')).toBeNull();
  });

  it('returns null for non-string elements in tier array', () => {
    expect(
      parseVaultConfig('{"tiers": {"family": [42, null]}, "individualGrants": [], "revokedPubkeys": []}'),
    ).toBeNull();
  });

  it('returns null for malformed individualGrants entries', () => {
    expect(parseVaultConfig('{"tiers": {}, "individualGrants": [42], "revokedPubkeys": []}')).toBeNull();
    expect(
      parseVaultConfig(
        '{"tiers": {}, "individualGrants": [{"pubkey": 1, "label": "x", "grantedAt": 0}], "revokedPubkeys": []}',
      ),
    ).toBeNull();
    expect(
      parseVaultConfig(
        '{"tiers": {}, "individualGrants": [{"pubkey": "abc", "label": "x", "grantedAt": "not a number"}], "revokedPubkeys": []}',
      ),
    ).toBeNull();
  });

  it('returns null for non-string elements in revokedPubkeys', () => {
    expect(parseVaultConfig('{"tiers": {}, "individualGrants": [], "revokedPubkeys": [123, null]}')).toBeNull();
  });

  it('returns null for invalid epochConfig values', () => {
    expect(
      parseVaultConfig(
        '{"tiers": {}, "individualGrants": [], "revokedPubkeys": [], "epochConfig": {"family": "hourly"}}',
      ),
    ).toBeNull();
    expect(
      parseVaultConfig('{"tiers": {}, "individualGrants": [], "revokedPubkeys": [], "epochConfig": {"family": 42}}'),
    ).toBeNull();
  });

  it('accepts valid epochConfig values', () => {
    const parsed = parseVaultConfig(
      '{"tiers": {}, "individualGrants": [], "revokedPubkeys": [], "epochConfig": {"family": "monthly", "connections": "weekly"}}',
    );
    expect(parsed).not.toBeNull();
    expect(parsed!.epochConfig).toEqual({ family: 'monthly', connections: 'weekly' });
  });

  it('returns null for non-object epochConfig', () => {
    expect(
      parseVaultConfig('{"tiers": {}, "individualGrants": [], "revokedPubkeys": [], "epochConfig": "weekly"}'),
    ).toBeNull();
  });

  it('returns null for non-http blossomUrl', () => {
    expect(
      parseVaultConfig(
        '{"tiers": {}, "individualGrants": [], "revokedPubkeys": [], "blossomUrl": "javascript:alert(1)"}',
      ),
    ).toBeNull();
    expect(
      parseVaultConfig(
        '{"tiers": {}, "individualGrants": [], "revokedPubkeys": [], "blossomUrl": "ftp://example.com"}',
      ),
    ).toBeNull();
  });

  it('accepts valid https blossomUrl', () => {
    const parsed = parseVaultConfig(
      '{"tiers": {}, "individualGrants": [], "revokedPubkeys": [], "blossomUrl": "https://blossom.example.com"}',
    );
    expect(parsed).not.toBeNull();
    expect(parsed!.blossomUrl).toBe('https://blossom.example.com');
  });

  it('returns null for non-string blossomUrl', () => {
    expect(
      parseVaultConfig('{"tiers": {}, "individualGrants": [], "revokedPubkeys": [], "blossomUrl": 42}'),
    ).toBeNull();
  });

  it('accepts auto tier value', () => {
    const parsed = parseVaultConfig('{"tiers": {"connections": "auto"}, "individualGrants": [], "revokedPubkeys": []}');
    expect(parsed).not.toBeNull();
    expect(parsed!.tiers.connections).toBe('auto');
  });

  it('roundtrips through build and parse', () => {
    let config = defaultConfig();
    config = addToTier(config, 'family', 'pubkey1');
    const event = buildVaultConfigEvent(AUTHOR, config);
    const parsed = parseVaultConfig(event.content);
    expect(parsed!.tiers.family).toContain('pubkey1');
  });
});

describe('buildVaultConfigFilter', () => {
  it('creates a filter for vault config events', () => {
    const filter = buildVaultConfigFilter(AUTHOR);
    expect(filter).toEqual({
      kinds: [30078],
      authors: [AUTHOR],
      '#d': ['dominion:vault-config'],
    });
  });
});
