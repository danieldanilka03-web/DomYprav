import { NextRequest, NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/src/db/index.ts';
import { brigades, buildings, emergencies, notifications } from '@/src/db/schema.ts';
import { ensureSeedData } from '@/src/db/seed.ts';
import { requireAuth } from '@/lib/auth-server';

const createEmergencySchema = z.object({
  buildingId: z.number().int().positive(),
  systemType: z.enum([
    'heating',
    'water_supply',
    'electricity',
    'elevator',
    'ventilation',
    'roof_facade',
    'gas',
  ]),
  severity: z.enum(['high', 'critical']),
  title: z.string().trim().min(5, 'Укажите название аварийной ситуации'),
  description: z.string().trim().min(10, 'Опишите характер аварии'),
  affectedApartments: z.string().trim().min(2),
  brigadeId: z.number().int().positive().nullable().optional(),
  responseMinutes: z.number().int().min(1).nullable().optional(),
  damageCost: z.number().min(0).default(0),
});

const patchEmergencySchema = z.object({
  id: z.number().int().positive(),
  status: z.enum(['active', 'localized', 'resolved']),
  damageCost: z.number().min(0).optional(),
  responseMinutes: z.number().int().min(1).optional(),
  rootCause: z.string().trim().optional(),
});

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req, 'view_emergencies');
  if ('response' in authResult) return authResult.response;

  try {
    await ensureSeedData();
    const [allEmergencies, allBuildings, allBrigades] = await Promise.all([
      db.select().from(emergencies).orderBy(desc(emergencies.reportedAt)),
      db.select().from(buildings),
      db.select().from(brigades),
    ]);

    const buildingMap = new Map(allBuildings.map((b) => [b.id, b.address]));
    const brigadeMap = new Map(allBrigades.map((br) => [br.id, br.name]));

    return NextResponse.json({
      emergencies: allEmergencies.map((e) => ({
        ...e,
        damageCost: Number(e.damageCost),
        buildingAddress: buildingMap.get(e.buildingId) ?? 'Не указан',
        brigadeName: e.brigadeId ? brigadeMap.get(e.brigadeId) ?? null : null,
      })),
    });
  } catch (error) {
    console.error('Failed to load emergencies:', error);
    return NextResponse.json(
      { error: 'Не удалось загрузить журнал аварийных ситуаций' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req, 'manage_emergencies');
  if ('response' in authResult) return authResult.response;

  try {
    const body = await req.json();
    const parsed = createEmergencySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Некорректные данные аварии' },
        { status: 400 }
      );
    }

    const inserted = await db
      .insert(emergencies)
      .values({
        buildingId: parsed.data.buildingId,
        systemType: parsed.data.systemType,
        severity: parsed.data.severity,
        title: parsed.data.title,
        description: parsed.data.description,
        affectedApartments: parsed.data.affectedApartments,
        brigadeId: parsed.data.brigadeId ?? null,
        reportedById: authResult.user.id,
        responseMinutes: parsed.data.responseMinutes ?? 15,
        damageCost: parsed.data.damageCost.toFixed(2),
        status: 'active',
      })
      .returning();

    await db.insert(notifications).values({
      buildingId: parsed.data.buildingId,
      type: 'emergency',
      title: `Аварийная ситуация: ${parsed.data.title}`,
      message: `Зона отключения: ${parsed.data.affectedApartments}. Аварийная бригада направлена на устранение.`,
      isRead: false,
    });

    return NextResponse.json({ emergency: inserted[0] }, { status: 201 });
  } catch (error) {
    console.error('Failed to register emergency:', error);
    return NextResponse.json(
      { error: 'Не удалось зарегистрировать аварийную ситуацию' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const authResult = await requireAuth(req);
  if ('response' in authResult) return authResult.response;

  if (authResult.user.role === 'resident') {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = patchEmergencySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Некорректные параметры' }, { status: 400 });
    }

    const now = new Date();
    const updated = await db
      .update(emergencies)
      .set({
        status: parsed.data.status,
        ...(parsed.data.status === 'localized' ? { localizedAt: now } : {}),
        ...(parsed.data.status === 'resolved' ? { resolvedAt: now } : {}),
        ...(parsed.data.damageCost !== undefined
          ? { damageCost: parsed.data.damageCost.toFixed(2) }
          : {}),
        ...(parsed.data.responseMinutes !== undefined
          ? { responseMinutes: parsed.data.responseMinutes }
          : {}),
        ...(parsed.data.rootCause !== undefined
          ? { rootCause: parsed.data.rootCause }
          : {}),
      })
      .where(eq(emergencies.id, parsed.data.id))
      .returning();

    return NextResponse.json({ emergency: updated[0] });
  } catch (error) {
    console.error('Failed to update emergency:', error);
    return NextResponse.json(
      { error: 'Не удалось обновить статус аварии' },
      { status: 500 }
    );
  }
}
