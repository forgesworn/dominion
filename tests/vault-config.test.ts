import { describe, it, expect } from 'vitest';
import { buildVaultConfigEvent, parseVaultConfig, buildVaultConfigFilter } from '../src/nostr/vault-config.js';
import { defaultConfig, addToTier, addIndividualGrant } from '../src/config.js';

const AUTHOR = 'aa'.repeat(32);

describe('buildVaultConfigEvent', () => {
  it('creates a kind 30481 event with plaintext JSON content', () => {
    const config = defaultConfig();
    const event = buildVaultConfigEvent(AUTHOR, config);
    expect(event.kind).toBe(30481);
    expect(event.pubkey).toBe(AUTHOR);
    expect(event.tags).toContainEqual(['d', 'vault-config']);
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
      kinds: [30481],
      authors: [AUTHOR],
      '#d': ['vault-config'],
    });
  });
});
