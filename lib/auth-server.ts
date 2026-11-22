import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/src/db/index.ts';
import { users } from '@/src/db/schema.ts';
import { adminAuth } from '@/lib/firebase-admin';
import {
  canPerformAction,
  isValidRole,
  type Permission,
  type UserRole,
} from '@/lib/operations-logic';

export const SESSION_COOKIE_NAME = 'domouprav_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function getSessionSecret(): string {
  return (
    process.env.AUTH_SESSION_SECRET ||
    'domouprav-dev-session-secret-change-in-production-2026'
  );
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string | null): boolean {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, keyHex] = storedHash.split(':');
  if (!salt || !keyHex) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(keyHex, 'hex');
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

interface SessionPayload {
  userId: number;
  uid: string;
  role: UserRole;
  exp: number;
}

export function signSessionToken(payload: Omit<SessionPayload, 'exp'>): string {
  const fullPayload: SessionPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const encoded = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${signature}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const [encoded, signature] = token.split('.');
    if (!encoded || !signature) return null;
    const expectedSig = crypto
      .createHmac('sha256', getSessionSecret())
      .update(encoded)
      .digest('base64url');
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }
    const decoded = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8')
    ) as SessionPayload;
    if (!decoded.exp || decoded.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

export interface SessionUser {
  id: number;
  uid: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: UserRole;
  position: string | null;
  brigadeId: number | null;
  buildingId: number | null;
  apartmentNumber: string | null;
  isActive: boolean;
}

function toSessionUser(row: typeof users.$inferSelect): SessionUser {
  const role: UserRole = isValidRole(row.role) ? row.role : 'resident';
  return {
    id: row.id,
    uid: row.uid,
    email: row.email,
    fullName: row.fullName,
    phone: row.phone,
    role,
    position: row.position,
    brigadeId: row.brigadeId,
    buildingId: row.buildingId,
    apartmentNumber: row.apartmentNumber,
    isActive: row.isActive,
  };
}

export async function getOrCreateFirebaseUser(
  uid: string,
  email: string,
  displayName?: string
): Promise<SessionUser> {
  try {
    const existingByEmail = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (existingByEmail.length > 0) {
      const updated = await db
        .update(users)
        .set({
          uid,
          fullName: existingByEmail[0].fullName || displayName || email.split('@')[0],
        })
        .where(eq(users.id, existingByEmail[0].id))
        .returning();
      return toSessionUser(updated[0]);
    }

    const inserted = await db
      .insert(users)
      .values({
        uid,
        email: email.toLowerCase(),
        fullName: displayName || email.split('@')[0],
        role: 'resident',
        isActive: true,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email: email.toLowerCase(),
        },
      })
      .returning();

    return toSessionUser(inserted[0]);
  } catch (error) {
    console.error('Database query failed in getOrCreateFirebaseUser:', error);
    throw new Error('Ошибка синхронизации профиля пользователя.', { cause: error });
  }
}

async function loadActiveUserById(userId: number): Promise<SessionUser | null> {
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!rows.length || !rows[0].isActive) return null;
  return toSessionUser(rows[0]);
}

function isSecureRequest(req?: NextRequest): boolean {
  if (process.env.NODE_ENV === 'production') return true;
  if (!req) return false;
  const proto = req.headers.get('x-forwarded-proto');
  if (proto) return proto.split(',')[0].trim() === 'https';
  return req.nextUrl.protocol === 'https:';
}

export async function getAuthenticatedUser(
  req?: NextRequest
): Promise<SessionUser | null> {
  try {
    // 1. Check Authorization Bearer token (signed session token first, then Firebase ID token fallback)
    const authHeader = req?.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const bearerToken = authHeader.slice(7).trim();
      if (bearerToken) {
        const sessionPayload = verifySessionToken(bearerToken);
        if (sessionPayload) {
          return loadActiveUserById(sessionPayload.userId);
        }

        try {
          const decoded = await adminAuth.verifyIdToken(bearerToken);
          const email = decoded.email || `${decoded.uid}@users.local`;
          const user = await getOrCreateFirebaseUser(
            decoded.uid,
            email,
            decoded.name
          );
          if (!user.isActive) return null;
          return user;
        } catch {
          // Fall through to cookie check
        }
      }
    }

    // 2. Check signed HTTP-only session cookie
    let cookieVal: string | undefined;
    if (req) {
      cookieVal = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    } else {
      const cookieStore = await cookies();
      cookieVal = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    }

    if (!cookieVal) return null;
    const payload = verifySessionToken(cookieVal);
    if (!payload) return null;

    return loadActiveUserById(payload.userId);
  } catch (error) {
    console.error('Authentication check error:', error);
    return null;
  }
}

export function attachSessionCookie(
  res: NextResponse,
  user: SessionUser,
  req?: NextRequest
): string {
  const token = signSessionToken({
    userId: user.id,
    uid: user.uid,
    role: user.role,
  });

  const secure = isSecureRequest(req);
  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: secure ? 'none' : 'lax',
    secure,
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });

  return token;
}

export function clearSessionCookie(res: NextResponse, req?: NextRequest): void {
  const secure = isSecureRequest(req);
  res.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: secure ? 'none' : 'lax',
    secure,
    path: '/',
    maxAge: 0,
  });
}

export async function requireAuth(
  req: NextRequest,
  permission?: Permission
): Promise<{ user: SessionUser } | { response: NextResponse }> {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return {
      response: NextResponse.json(
        { error: 'Требуется авторизация' },
        { status: 401 }
      ),
    };
  }
  if (permission && !canPerformAction(user.role, permission)) {
    return {
      response: NextResponse.json(
        { error: 'Недостаточно прав для выполнения данного действия' },
        { status: 403 }
      ),
    };
  }
  return { user };
}
