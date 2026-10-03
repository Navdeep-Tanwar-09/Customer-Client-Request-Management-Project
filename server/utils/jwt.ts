import { createHmac, timingSafeEqual } from 'node:crypto';

const TOKEN_LIFETIME_SECONDS = 7 * 24 * 60 * 60;
const JWT_ISSUER = 'client-request-desk';

function getSigningSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length >= 32) return secret;

  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be configured with at least 32 characters in production.');
  }

  return 'client-request-desk-development-secret-change-before-production';
}

export function assertJwtConfiguration(): void {
  getSigningSecret();
}

function sign(input: string): Buffer {
  return createHmac('sha256', getSigningSecret()).update(input).digest();
}

function encode(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

export function createAccessToken(userId: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = encode({ alg: 'HS256', typ: 'JWT' });
  const payload = encode({
    sub: userId,
    iss: JWT_ISSUER,
    iat: now,
    exp: now + TOKEN_LIFETIME_SECONDS
  });
  const unsignedToken = `${header}.${payload}`;
  const signature = sign(unsignedToken).toString('base64url');
  return `${unsignedToken}.${signature}`;
}

export function verifyAccessToken(token: string): { userId: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8'));
    if (header.alg !== 'HS256' || header.typ !== 'JWT') return null;

    const expectedSignature = sign(`${encodedHeader}.${encodedPayload}`);
    const actualSignature = Buffer.from(encodedSignature, 'base64url');
    if (actualSignature.length !== expectedSignature.length || !timingSafeEqual(actualSignature, expectedSignature)) return null;

    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    const now = Math.floor(Date.now() / 1000);
    if (payload.iss !== JWT_ISSUER || typeof payload.sub !== 'string' || !payload.sub) return null;
    if (!Number.isInteger(payload.exp) || payload.exp <= now) return null;
    if (!Number.isInteger(payload.iat) || payload.iat > now) return null;

    return { userId: payload.sub };
  } catch {
    return null;
  }
}
