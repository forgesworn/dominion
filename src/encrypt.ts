import { gcm } from '@noble/ciphers/aes.js';
import { utf8ToBytes, bytesToUtf8, randomBytes } from '@noble/ciphers/utils.js';

const IV_LENGTH = 12;

/**
 * Encrypt a plaintext string with a 32-byte Content Key.
 * Returns base64(iv || ciphertext || tag).
 */
export function encrypt(plaintext: string, ck: Uint8Array): string {
  const raw = encryptBlob(utf8ToBytes(plaintext), ck);
  return Buffer.from(raw).toString('base64');
}

/**
 * Decrypt a base64(iv || ciphertext || tag) string with a 32-byte Content Key.
 */
export function decrypt(ciphertext: string, ck: Uint8Array): string {
  const raw = Buffer.from(ciphertext, 'base64');
  const decrypted = decryptBlob(new Uint8Array(raw), ck);
  return bytesToUtf8(decrypted);
}

/**
 * Encrypt a Uint8Array with a 32-byte Content Key.
 * Returns Uint8Array(iv || ciphertext || tag).
 */
export function encryptBlob(data: Uint8Array, ck: Uint8Array): Uint8Array {
  const iv = randomBytes(IV_LENGTH);
  const aes = gcm(ck, iv);
  const encrypted = aes.encrypt(data);
  const result = new Uint8Array(IV_LENGTH + encrypted.length);
  result.set(iv, 0);
  result.set(encrypted, IV_LENGTH);
  return result;
}

/**
 * Decrypt a Uint8Array(iv || ciphertext || tag) with a 32-byte Content Key.
 */
export function decryptBlob(encrypted: Uint8Array, ck: Uint8Array): Uint8Array {
  const iv = encrypted.slice(0, IV_LENGTH);
  const ciphertext = encrypted.slice(IV_LENGTH);
  const aes = gcm(ck, iv);
  return aes.decrypt(ciphertext);
}
