import crypto from 'node:crypto';

const KEY_LENGTH = 64;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1 };

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const digest = crypto.scryptSync(password, salt, KEY_LENGTH, SCRYPT_OPTIONS).toString('hex');
  return `scrypt$${salt}$${digest}`;
}

export function isPasswordHash(value: string): boolean {
  return /^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/i.test(value);
}

export function verifyPassword(password: string, storedValue: string): boolean {
  if (!isPasswordHash(storedValue)) return false;
  const [, salt, expectedDigest] = storedValue.split('$');
  const actualDigest = crypto.scryptSync(password, salt, KEY_LENGTH, SCRYPT_OPTIONS).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(expectedDigest, 'hex'), Buffer.from(actualDigest, 'hex'));
}
