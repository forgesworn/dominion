/** Vault configuration — stored as self-encrypted NIP-78 (kind 30078). */
export interface DominionConfig {
  tiers: {
    family: string[];
    connections: 'auto' | string[];
    close_friends?: string[];
    [tier: string]: string[] | 'auto' | undefined;
  };
  individualGrants: IndividualGrant[];
  revokedPubkeys: string[];
  epochConfig?: EpochConfig;
  blossomUrl?: string;
}

/** One-off access grant to a specific pubkey, independent of tiers. */
export interface IndividualGrant {
  pubkey: string;
  label: string;
  grantedAt: number;
}

/** A single Shamir share of a Content Key. */
export interface CKShare {
  index: number;
  data: Uint8Array;
}

export type TierName = 'family' | 'connections' | 'close_friends' | 'subscribers' | string;
export type EpochLength = 'daily' | 'weekly' | 'monthly';
export type EpochConfig = Record<string, EpochLength>;
export type CryptoAlgorithm = 'secp256k1';

/** Minimal Nostr event shape — no signing, no id. */
export interface NostrEvent {
  kind: number;
  pubkey: string;
  created_at: number;
  tags: string[][];
  content: string;
}

/** Parsed vault share data extracted from a kind 30480 event. */
export interface VaultShareData {
  fromPubkey: string;
  epochId: string;
  ckHex: string;
  tier: string;
  algorithm: CryptoAlgorithm;
}
