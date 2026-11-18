import crypto from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';
import type { CookieOptions, Response, Request } from 'express';

export const SESSION_COOKIE_NAME = 'ls11_session';

export async function hashPassword(plain: string): Promise<string> {
  // @node-rs/argon2 uses Argon2id ($argon2id$v=19$...) by default
  return hash(plain, {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}

export async function verifyPassword(passwordHash: string, plain: string): Promise<boolean> {
  try {
    return await verify(passwordHash, plain);
  } catch {
    return false;
  }
}

export function generateSessionToken(): { rawToken: string; tokenHash: string } {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashSessionToken(rawToken);
  return { rawToken, tokenHash };
}

export function hashSessionToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export function extractRequestSessionToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
    const bearer = authHeader.slice(7).trim();
    if (bearer) return bearer;
  }
  const headerToken = req.headers['x-session-token'];
  if (typeof headerToken === 'string' && headerToken.trim()) {
    return headerToken.trim();
  }
  const cookieToken = req.cookies?.[SESSION_COOKIE_NAME];
  if (typeof cookieToken === 'string' && cookieToken.trim()) {
    return cookieToken.trim();
  }
  return null;
}

function isHttpsOrCloudRun(req: Request): boolean {
  const fwdHost = String(req.headers['x-forwarded-host'] || '').toLowerCase();
  return (
    req.secure ||
    req.headers['x-forwarded-proto'] === 'https' ||
    fwdHost.endsWith('.run.app') ||
    fwdHost.endsWith('.google.com') ||
    process.env.NODE_ENV === 'production'
  );
}

export function setSessionCookie(req: Request, res: Response, rawToken: string, maxAgeDays = 7): void {
  const isSecure = isHttpsOrCloudRun(req);

  res.cookie(SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: isSecure,
    sameSite: isSecure ? 'none' : 'lax',
    partitioned: isSecure,
    path: '/',
    maxAge: maxAgeDays * 24 * 60 * 60 * 1000,
  } as CookieOptions);
}

export function clearSessionCookie(req: Request, res: Response): void {
  const isSecure = isHttpsOrCloudRun(req);

  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: isSecure,
    sameSite: isSecure ? 'none' : 'lax',
    partitioned: isSecure,
    path: '/',
  } as CookieOptions);
}

export interface StudentRegistrationInput {
  fullName: string;
  className: string;
  username: string;
  password: string;
  confirmPassword: string;
}

export function validateStudentRegistration(input: StudentRegistrationInput): {
  valid: boolean;
  error?: string;
  normalized?: { fullName: string; className: string; username: string };
} {
  const fullName = (input.fullName || '').trim().replace(/\s+/g, ' ');
  const className = (input.className || '').trim().toUpperCase();
  const username = (input.username || '').trim().toLowerCase();
  const password = input.password || '';
  const confirmPassword = input.confirmPassword || '';

  if (fullName.length < 3 || fullName.length > 80) {
    return { valid: false, error: 'Họ và tên học sinh phải từ 3 đến 80 ký tự.' };
  }

  if (!/^(10|11|12)[A-Z0-9]{1,6}$/.test(className)) {
    return { valid: false, error: 'Tên lớp không hợp lệ (ví dụ hợp lệ: 11A1, 11A2, 11C3).' };
  }

  if (!/^[a-z0-9_.-]{4,32}$/.test(username)) {
    return {
      valid: false,
      error: 'Tên đăng nhập phải từ 4–32 ký tự, chỉ gồm chữ thường không dấu, chữ số, dấu chấm, gạch ngang hoặc gạch dưới.',
    };
  }

  if (password.length < 6 || password.length > 72) {
    return { valid: false, error: 'Mật khẩu phải có độ dài từ 6 đến 72 ký tự.' };
  }

  if (password !== confirmPassword) {
    return { valid: false, error: 'Mật khẩu nhập lại không trùng khớp.' };
  }

  return {
    valid: true,
    normalized: { fullName, className, username },
  };
}

interface RateBucket {
  failures: number;
  lockedUntil: number;
}

const loginRateMap = new Map<string, RateBucket>();

export function checkLoginRateLimit(
  key: string,
  maxAttempts = 5,
  lockoutMs = 60_000,
  now = Date.now(),
): { allowed: boolean; retryAfterSeconds: number; remainingAttempts: number } {
  const bucket = loginRateMap.get(key);
  if (!bucket) {
    return { allowed: true, retryAfterSeconds: 0, remainingAttempts: maxAttempts };
  }
  if (bucket.lockedUntil > now) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((bucket.lockedUntil - now) / 1000),
      remainingAttempts: 0,
    };
  }
  if (bucket.lockedUntil !== 0 && bucket.lockedUntil <= now) {
    loginRateMap.delete(key);
    return { allowed: true, retryAfterSeconds: 0, remainingAttempts: maxAttempts };
  }
  return {
    allowed: true,
    retryAfterSeconds: 0,
    remainingAttempts: Math.max(0, maxAttempts - bucket.failures),
  };
}

export function recordLoginFailure(
  key: string,
  maxAttempts = 5,
  lockoutMs = 60_000,
  now = Date.now(),
): { locked: boolean; retryAfterSeconds: number; remainingAttempts: number } {
  const current = loginRateMap.get(key) || { failures: 0, lockedUntil: 0 };
  if (current.lockedUntil > now) {
    return {
      locked: true,
      retryAfterSeconds: Math.ceil((current.lockedUntil - now) / 1000),
      remainingAttempts: 0,
    };
  }
  const failures = current.failures + 1;
  if (failures >= maxAttempts) {
    const lockedUntil = now + lockoutMs;
    loginRateMap.set(key, { failures, lockedUntil });
    return {
      locked: true,
      retryAfterSeconds: Math.ceil(lockoutMs / 1000),
      remainingAttempts: 0,
    };
  }
  loginRateMap.set(key, { failures, lockedUntil: 0 });
  return {
    locked: false,
    retryAfterSeconds: 0,
    remainingAttempts: maxAttempts - failures,
  };
}

export function clearLoginFailures(key: string): void {
  loginRateMap.delete(key);
}
