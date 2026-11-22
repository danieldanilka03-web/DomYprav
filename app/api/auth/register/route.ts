import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/src/db/index.ts';
import { notifications, users } from '@/src/db/schema.ts';
import { ensureSeedData } from '@/src/db/seed.ts';
import { attachSessionCookie, hashPassword } from '@/lib/auth-server';

const registerSchema = z.object({
  fullName: z.string().trim().min(3, 'Укажите ФИО (минимум 3 символа)'),
  email: z.string().trim().email('Введите корректный email'),
  password: z.string().min(6, 'Пароль должен содержать минимум 6 символов'),
  phone: z.string().trim().optional(),
  buildingId: z.number().int().positive().nullable().optional(),
  apartmentNumber: z.string().trim().max(20).optional(),
});

export async function POST(req: NextRequest) {
  try {
    await ensureSeedData();
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Проверьте заполнение полей' },
        { status: 400 }
      );
    }

    const emailNormalized = parsed.data.email.toLowerCase();
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, emailNormalized))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'Пользователь с таким email уже зарегистрирован' },
        { status: 409 }
      );
    }

    const uid = `local_${crypto.randomUUID()}`;
    const inserted = await db
      .insert(users)
      .values({
        uid,
        email: emailNormalized,
        passwordHash: hashPassword(parsed.data.password),
        fullName: parsed.data.fullName,
        phone: parsed.data.phone || null,
        role: 'resident',
        position: 'Собственник / Житель',
        buildingId: parsed.data.buildingId ?? null,
        apartmentNumber: parsed.data.apartmentNumber || null,
        isActive: true,
      })
      .returning();

    const created = inserted[0];
    await db.insert(notifications).values({
      userId: created.id,
      buildingId: created.buildingId,
      type: 'system',
      title: 'Добро пожаловать в личный кабинет «ДомоУправ»',
      message:
        'Вы можете подавать заявки на обслуживание, прикладывать фото неисправностей и отслеживать ход работ.',
      isRead: false,
    });

    const sessionUser = {
      id: created.id,
      uid: created.uid,
      email: created.email,
      fullName: created.fullName,
      phone: created.phone,
      role: 'resident' as const,
      position: created.position,
      brigadeId: created.brigadeId,
      buildingId: created.buildingId,
      apartmentNumber: created.apartmentNumber,
      isActive: created.isActive,
    };

    const tempRes = NextResponse.json({ user: sessionUser }, { status: 201 });
    const token = attachSessionCookie(tempRes, sessionUser, req);
    return NextResponse.json(
      { user: sessionUser, token },
      { status: 201, headers: tempRes.headers }
    );
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Ошибка регистрации. Попробуйте снова.' },
      { status: 500 }
    );
  }
}
