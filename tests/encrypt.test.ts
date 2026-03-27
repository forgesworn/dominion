import { describe, expect, it } from 'vitest';
import { deriveContentKey } from '../src/content-keys.js';
import { decrypt, decryptBlob, encrypt, encryptBlob } from '../src/encrypt.js';
import { TEST_EPOCH_ID, TEST_PRIVKEY_HEX, TEST_PRIVKEY_HEX_B, TEST_TIER } from './fixtures.js';

const ck = deriveContentKey(TEST_PRIVKEY_HEX, TEST_EPOCH_ID, TEST_TIER);
const wrongCK = deriveContentKey(TEST_PRIVKEY_HEX_B, TEST_EPOCH_ID, TEST_TIER);

describe('string encryption', () => {
  it('encrypts and decrypts a string round-trip', () => {
    const plaintext = 'Hello vault!';
    const ciphertext = encrypt(plaintext, ck);
    const decrypted = decrypt(ciphertext, ck);
    expect(decrypted).toBe(plaintext);
  });

  it('encrypted output is base64 and different from plaintext', () => {
    const ciphertext = encrypt('test', ck);
    expect(ciphertext).not.toBe('test');
    const binary = atob(ciphertext);
    expect(binary.length).toBeGreaterThanOrEqual(32);
  });

  it('fails to decrypt with wrong key', () => {
    const ciphertext = encrypt('secret', ck);
    expect(() => decrypt(ciphertext, wrongCK)).toThrow();
  });

  it('produces different ciphertext each time (random IV)', () => {
    const a = encrypt('same', ck);
    const b = encrypt('same', ck);
    expect(a).not.toBe(b);
  });

  it('handles empty string', () => {
    const ciphertext = encrypt('', ck);
    const decrypted = decrypt(ciphertext, ck);
    expect(decrypted).toBe('');
  });

  it('handles unicode', () => {
    const plaintext = 'Hello \u{1F30D} world \u{2764}';
    const ciphertext = encrypt(plaintext, ck);
    expect(decrypt(ciphertext, ck)).toBe(plaintext);
  });
});

describe('blob encryption', () => {
  it('encrypts and decrypts a blob round-trip', () => {
    const data = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const encrypted = encryptBlob(data, ck);
    const decrypted = decryptBlob(encrypted, ck);
    expect(Array.from(decrypted)).toEqual(Array.from(data));
  });

  it('encrypted blob is longer than input (IV + tag)', () => {
    const data = new Uint8Array(100);
    const encrypted = encryptBlob(data, ck);
    // 12 (IV) + 100 (ciphertext) + 16 (tag) = 128
    expect(encrypted.length).toBe(128);
  });

  it('fails to decrypt blob with wrong key', () => {
    const data = new Uint8Array([10, 20, 30]);
    const encrypted = encryptBlob(data, ck);
    expect(() => decryptBlob(encrypted, wrongCK)).toThrow();
  });

  it('handles empty blob', () => {
    const data = new Uint8Array(0);
    const encrypted = encryptBlob(data, ck);
    const decrypted = decryptBlob(encrypted, ck);
    expect(decrypted.length).toBe(0);
  });

  it('throws on truncated ciphertext', () => {
    const data = new Uint8Array([1, 2, 3, 4, 5]);
    const encrypted = encryptBlob(data, ck);
    const truncated = encrypted.slice(0, 10); // less than IV_LENGTH + tag
    expect(() => decryptBlob(truncated, ck)).toThrow();
  });

  it('throws on corrupted ciphertext (flipped bit)', () => {
    const data = new Uint8Array([1, 2, 3, 4, 5]);
    const encrypted = encryptBlob(data, ck);
    const corrupted = new Uint8Array(encrypted);
    corrupted[15] ^= 0xff; // flip a byte in the ciphertext region
    expect(() => decryptBlob(corrupted, ck)).toThrow();
  });

  it('throws on corrupted base64 string encryption', () => {
    const ciphertext = encrypt('hello', ck);
    // Corrupt a character in the middle
    const corrupted = `${ciphertext.slice(0, 10)}X${ciphertext.slice(11)}`;
    expect(() => decrypt(corrupted, ck)).toThrow();
  });

  it('rejects 16-byte key (prevents silent AES-128 downgrade)', () => {
    expect(() => encryptBlob(new Uint8Array([1, 2, 3]), new Uint8Array(16))).toThrow('Content key must be 32 bytes');
  });

  it('rejects 0-byte key', () => {
    expect(() => encryptBlob(new Uint8Array([1, 2, 3]), new Uint8Array(0))).toThrow('Content key must be 32 bytes');
  });

  it('rejects wrong-length key on decrypt', () => {
    expect(() => decryptBlob(new Uint8Array(30), new Uint8Array(16))).toThrow('Content key must be 32 bytes');
  });

  it('rejects ciphertext shorter than IV + tag minimum', () => {
    expect(() => decryptBlob(new Uint8Array(20), ck)).toThrow('Ciphertext too short');
  });
});
