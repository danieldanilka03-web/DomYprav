import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/src/db/index.ts';
import { buildings, meterReadings, users } from '@/src/db/schema.ts';
import { ensureSeedData } from '@/src/db/seed.ts';
import { requireAuth } from '@/lib/auth-server';
import { computeMeterConsumption } from '@/lib/operations-logic';

const submitMeterSchema = z.object({
  meterType: z.enum(['cold_water', 'hot_water', 'electricity']),
  value: z.number().min(0, 'Показание не может быть отрицательным'),
  period: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'Укажите период в формате ГГГГ-ММ')
    .optional(),
  buildingId: z.number().int().positive().optional(),
  apartmentNumber: z.string().trim().min(1).max(20).optional(),
});

async function ensureInitialMeters() {
  const existing = await db.select({ id: meterReadings.id }).from(meterReadings).limit(1);
  if (existing.length > 0) return;

  const residentRows = await db
    .select()
    .from(users)
    .where(eq(users.email, 'resident@domouprav.ru'))
    .limit(1);

  if (!residentRows.length || !residentRows[0].buildingId) return;
  const resident = residentRows[0];
  const bId = resident.buildingId!;
  const apt = resident.apartmentNumber || '42';

  await db.insert(meterReadings).values([
    // Cold water (3 months)
    {
      userId: resident.id,
      buildingId: bId,
      apartmentNumber: apt,
      meterType: 'cold_water',
      period: '2026-09',
      value: '132.40',
      previousValue: '127.80',
      consumption: '4.60',
    },
    {
      userId: resident.id,
      buildingId: bId,
      apartmentNumber: apt,
      meterType: 'cold_water',
      period: '2026-10',
      value: '137.20',
      previousValue: '132.40',
      consumption: '4.80',
    },
    // Hot water
    {
      userId: resident.id,
      buildingId: bId,
      apartmentNumber: apt,
      meterType: 'hot_water',
      period: '2026-09',
      value: '84.10',
      previousValue: '80.90',
      consumption: '3.20',
    },
    {
      userId: resident.id,
      buildingId: bId,
      apartmentNumber: apt,
      meterType: 'hot_water',
      period: '2026-10',
      value: '87.50',
      previousValue: '84.10',
      consumption: '3.40',
    },
    // Electricity
    {
      userId: resident.id,
      buildingId: bId,
      apartmentNumber: apt,
      meterType: 'electricity',
      period: '2026-09',
      value: '4120.00',
      previousValue: '3915.00',
      consumption: '205.00',
    },
    {
      userId: resident.id,
      buildingId: bId,
      apartmentNumber: apt,
      meterType: 'electricity',
      period: '2026-10',
      value: '4342.00',
      previousValue: '4120.00',
      consumption: '222.00',
    },
  ]);
}

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req);
  if ('response' in authResult) return authResult.response;

  try {
    await ensureSeedData();
    await ensureInitialMeters();

    const { user } = authResult;
    if (user.role === 'specialist') {
      return NextResponse.json(
        { error: 'Раздел показаний счётчиков недоступен для данной роли' },
        { status: 403 }
      );
    }

    const [allReadings, allBuildings, allUsers] = await Promise.all([
      user.role === 'resident' && user.buildingId && user.apartmentNumber
        ? db
            .select()
            .from(meterReadings)
            .where(
              and(
                eq(meterReadings.buildingId, user.buildingId),
                eq(meterReadings.apartmentNumber, user.apartmentNumber)
              )
            )
            .orderBy(desc(meterReadings.period), desc(meterReadings.submittedAt))
        : user.role === 'resident'
          ? db
              .select()
              .from(meterReadings)
              .where(eq(meterReadings.userId, user.id))
              .orderBy(desc(meterReadings.period), desc(meterReadings.submittedAt))
          : db
              .select()
              .from(meterReadings)
              .orderBy(desc(meterReadings.period), desc(meterReadings.submittedAt)),
      db.select().from(buildings),
      db.select().from(users),
    ]);

    const buildingMap = new Map(allBuildings.map((b) => [b.id, b.address]));
    const userMap = new Map(allUsers.map((u) => [u.id, u.fullName]));

    return NextResponse.json({
      readings: allReadings.map((r) => ({
        ...r,
        value: Number(r.value),
        previousValue: r.previousValue !== null ? Number(r.previousValue) : null,
        consumption: r.consumption !== null ? Number(r.consumption) : null,
        buildingAddress: buildingMap.get(r.buildingId) ?? 'Не указан',
        residentName: r.userId ? userMap.get(r.userId) ?? 'Житель' : 'Житель',
      })),
    });
  } catch (error) {
    console.error('Failed to load meter readings:', error);
    return NextResponse.json(
      { error: 'Не удалось загрузить показания счётчиков' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req);
  if ('response' in authResult) return authResult.response;

  const { user } = authResult;
  if (user.role === 'specialist') {
    return NextResponse.json(
      { error: 'Передача показаний недоступна для этой роли' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const parsed = submitMeterSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Некорректные показания счётчика' },
        { status: 400 }
      );
    }

    const buildingId =
      user.role === 'resident' ? user.buildingId : parsed.data.buildingId ?? user.buildingId;
    const apartmentNumber =
      user.role === 'resident'
        ? user.apartmentNumber
        : parsed.data.apartmentNumber ?? user.apartmentNumber;

    if (!buildingId || !apartmentNumber) {
      return NextResponse.json(
        { error: 'Не указаны дом и номер квартиры для передачи показаний' },
        { status: 400 }
      );
    }

    const period = parsed.data.period || new Date().toISOString().slice(0, 7);

    // Find latest previous reading for this apartment + meterType
    const prevRows = await db
      .select()
      .from(meterReadings)
      .where(
        and(
          eq(meterReadings.buildingId, buildingId),
          eq(meterReadings.apartmentNumber, apartmentNumber),
          eq(meterReadings.meterType, parsed.data.meterType)
        )
      )
      .orderBy(desc(meterReadings.period), desc(meterReadings.submittedAt))
      .limit(1);

    const prevValue = prevRows.length ? Number(prevRows[0].value) : null;
    const check = computeMeterConsumption(parsed.data.value, prevValue);
    if (!check.valid) {
      return NextResponse.json({ error: check.error }, { status: 400 });
    }

    const inserted = await db
      .insert(meterReadings)
      .values({
        userId: user.id,
        buildingId,
        apartmentNumber,
        meterType: parsed.data.meterType,
        period,
        value: parsed.data.value.toFixed(2),
        previousValue: prevValue !== null ? prevValue.toFixed(2) : null,
        consumption: check.consumption !== null ? check.consumption.toFixed(2) : null,
      })
      .returning();

    return NextResponse.json({ reading: inserted[0] }, { status: 201 });
  } catch (error) {
    console.error('Failed to submit meter reading:', error);
    return NextResponse.json(
      { error: 'Не удалось сохранить показания счётчика' },
      { status: 500 }
    );
  }
}
