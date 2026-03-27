import type { EpochLength } from './types.js';

export const DOMINION_VERSION = '0.1.0';
export const CK_SALT = 'dominion-ck-v1';
export const KIND_VAULT_SHARE = 30480;
/** NIP-78 App-specific Data — vault config is self-encrypted app data, not a protocol-specific kind */
export const KIND_VAULT_CONFIG = 30078;
export const PROTOCOL_LABEL = 'dominion';
export const LEGACY_PROTOCOL_LABEL = 'vaulstr';
export const DEFAULT_EPOCH_LENGTH: EpochLength = 'weekly';
