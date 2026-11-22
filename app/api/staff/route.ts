import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/src/db/index.ts';
import { brigades, buildings, users } from '@/src/db/schema.ts';
import { ensureSeedData } from '@/src/db/seed.ts';
import { hashPassword, requireAuth } from '@/lib/auth-server';

const createStaffOrBrigadeSchema = z.discriminatedUnion('entityType', [
  z.object({
    entityType: z.literal('brigade'),
    name: z.string().trim().min(3, 'Укажите название бригады'),
    specialization: z.enum(['plumbing', 'electricity', 'elevator', 'general', 'emergency']),
    leaderName: z.string().trim().min(3),
    phone: z.string().trim().min(5),
  }),
  z.object({
    entityType: z.literal('user'),
    fullName: z.string().trim().min(3),
    email: z.string().trim().email(),
    password: z.string().min(6),
    phone: z.string().optional(),
    role: z.enum(['admin', 'dispatcher', 'specialist', 'resident']),
    position: z.string().optional(),
    brigadeId: z.number().int().positive().nullable().optional(),
    buildingId: z.number().int().positive().nullable().optional(),
    apartmentNumber: z.string().optional(),
  }),
]);

const patchStaffSchema = z.object({
  entityType: z.enum(['user', 'brigade']),
  id: z.number().int().positive(),
  role: z.enum(['admin', 'dispatcher', 'specialist', 'resident']).optional(),
  position: z.string().optional(),
  brigadeId: z.number().int().positive().nullable().optional(),
  isActive: z.boolean().optional(),
  status: z.enum(['available', 'on_call', 'busy']).optional(),
});

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req);
  if ('response' in authResult) return authResult.response;

  try {
    await ensureSeedData();
    const { user } = authResult;

    const [allBrigades, allUsers, allBuildings] = await Promise.all([
      db.select().from(brigades).orderBy(asc(brigades.id)),
      db.select().from(users).orderBy(asc(users.id)),
      db.select().from(buildings),
    ]);

    const brigadeMap = new Map(allBrigades.map((b) => [b.id, b.name]));
    const buildingMap = new Map(allBuildings.map((b) => [b.id, b.address]));

    // Dispatchers/specialists need specialist directory for assignment; admins get full directory
    const filteredUsers =
      user.role === 'admin'
        ? allUsers
        : user.role === 'dispatcher' || user.role === 'specialist'
          ? allUsers.filter((u) => u.role !== 'resident')
          : [];

    return NextResponse.json({
      brigades: allBrigades.map((br) => ({
        ...br,
        membersCount: allUsers.filter((u) => u.brigadeId === br.id).length,
      })),
      users: filteredUsers.map((u) => ({
        id: u.id,
        email: u.email,
        fullName: u.fullName,
        phone: u.phone,
        role: u.role,
        position: u.position,
        brigadeId: u.brigadeId,
        brigadeName: u.brigadeId ? brigadeMap.get(u.brigadeId) ?? null : null,
        buildingId: u.buildingId,
        buildingAddress: u.buildingId ? buildingMap.get(u.buildingId) ?? null : null,
        apartmentNumber: u.apartmentNumber,
        isActive: u.isActive,
        createdAt: u.createdAt,
      })),
    });
  } catch (error) {
    console.error('Failed to load staff and brigades:', error);
    return NextResponse.json(
      { error: 'Не удалось загрузить справочник сотрудников и бригад' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req, 'manage_staff');
  if ('response' in authResult) return authResult.response;

  try {
    const body = await req.json();
    const parsed = createStaffOrBrigadeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Некорректные данные' },
        { status: 400 }
      );
    }

    if (parsed.data.entityType === 'brigade') {
      const created = await db
        .insert(brigades)
        .values({
          name: parsed.data.name,
          specialization: parsed.data.specialization,
          leaderName: parsed.data.leaderName,
          phone: parsed.data.phone,
          status: 'available',
        })
        .returning();
      return NextResponse.json({ brigade: created[0] }, { status: 201 });
    }

    const emailNormalized = parsed.data.email.toLowerCase();
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, emailNormalized))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'Пользователь с таким email уже существует' },
        { status: 409 }
      );
    }

    const createdUser = await db
      .insert(users)
      .values({
        uid: `local_${crypto.randomUUID()}`,
        email: emailNormalized,
        passwordHash: hashPassword(parsed.data.password),
        fullName: parsed.data.fullName,
        phone: parsed.data.phone || null,
        role: parsed.data.role,
        position: parsed.data.position || null,
        brigadeId: parsed.data.brigadeId ?? null,
        buildingId: parsed.data.buildingId ?? null,
        apartmentNumber: parsed.data.apartmentNumber || null,
        isActive: true,
      })
      .returning();

    return NextResponse.json({ user: createdUser[0] }, { status: 201 });
  } catch (error) {
    console.error('Failed to create staff/brigade:', error);
    return NextResponse.json(
      { error: 'Не удалось создать запись' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const authResult = await requireAuth(req, 'manage_staff');
  if ('response' in authResult) return authResult.response;

  try {
    const body = await req.json();
    const parsed = patchStaffSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Некорректные данные обновления' }, { status: 400 });
    }

    if (parsed.data.entityType === 'brigade') {
      const updated = await db
        .update(brigades)
        .set({
          ...(parsed.data.status ? { status: parsed.data.status } : {}),
        })
        .where(eq(brigades.id, parsed.data.id))
        .returning();
      return NextResponse.json({ brigade: updated[0] });
    }

    // Prevent admin from accidentally deactivating themselves
    if (
      parsed.data.id === authResult.user.id &&
      (parsed.data.isActive === false ||
        (parsed.data.role && parsed.data.role !== 'admin'))
    ) {
      return NextResponse.json(
        { error: 'Нельзя снять права администратора с собственной учётной записи' },
        { status: 400 }
      );
    }

    const updatedUser = await db
      .update(users)
      .set({
        ...(parsed.data.role ? { role: parsed.data.role } : {}),
        ...(parsed.data.position !== undefined ? { position: parsed.data.position } : {}),
        ...(parsed.data.brigadeId !== undefined ? { brigadeId: parsed.data.brigadeId } : {}),
        ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
      })
      .where(eq(users.id, parsed.data.id))
      .returning();

    return NextResponse.json({ user: updatedUser[0] });
  } catch (error) {
    console.error('Failed to update staff/brigade:', error);
    return NextResponse.json(
      { error: 'Не удалось обновить параметры сотрудника' },
      { status: 500 }
    );
  }
}
