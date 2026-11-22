import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/src/db/index.ts';
import { users } from '@/src/db/schema.ts';
import { ensureSeedData } from '@/src/db/seed.ts';
import { attachSessionCookie, verifyPassword } from '@/lib/auth-server';
import { isValidRole } from '@/lib/operations-logic';

const loginSchema = z.object({
  email: z.string().email('Введите корректный адрес электронной почты'),
  password: z.string().min(1, 'Введите пароль'),
});

export async function POST(req: NextRequest) {
  try {
    await ensureSeedData();
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Некорректные данные входа' },
        { status: 400 }
      );
    }

    const emailNormalized = parsed.data.email.trim().toLowerCase();
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.email, emailNormalized))
      .limit(1);

    const userRow = rows[0];
    if (!userRow || !verifyPassword(parsed.data.password, userRow.passwordHash)) {
      return NextResponse.json(
        { error: 'Неверный email или пароль' },
        { status: 401 }
      );
    }

    if (!userRow.isActive) {
      return NextResponse.json(
        { error: 'Учётная запись деактивирована администратором' },
        { status: 403 }
      );
    }

    const sessionUser = {
      id: userRow.id,
      uid: userRow.uid,
      email: userRow.email,
      fullName: userRow.fullName,
      phone: userRow.phone,
      role: isValidRole(userRow.role) ? userRow.role : ('resident' as const),
      position: userRow.position,
      brigadeId: userRow.brigadeId,
      buildingId: userRow.buildingId,
      apartmentNumber: userRow.apartmentNumber,
      isActive: userRow.isActive,
    };

    const res = NextResponse.json({ user: sessionUser });
    const token = attachSessionCookie(res, sessionUser, req);
    return NextResponse.json(
      { user: sessionUser, token },
      { headers: res.headers }
    );
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Ошибка авторизации. Попробуйте позже.' },
      { status: 500 }
    );
  }
}
