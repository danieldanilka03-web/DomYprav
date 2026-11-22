import { NextRequest, NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/src/db/index.ts';
import {
  apartments,
  brigades,
  buildings,
  emergencies,
  engineeringSystems,
  maintenancePlans,
  tickets,
} from '@/src/db/schema.ts';
import { requireAuth } from '@/lib/auth-server';

const addSubEntitySchema = z.discriminatedUnion('entityType', [
  z.object({
    entityType: z.literal('apartment'),
    number: z.string().trim().min(1),
    entrance: z.number().int().min(1),
    floor: z.number().int().min(0),
    areaSqm: z.number().positive(),
    unitType: z.enum(['residential', 'commercial', 'technical']),
    ownerName: z.string().trim().min(2),
    ownerPhone: z.string().optional(),
    residentsCount: z.number().int().min(0).default(1),
  }),
  z.object({
    entityType: z.literal('system'),
    systemType: z.enum([
      'heating',
      'water_supply',
      'electricity',
      'elevator',
      'ventilation',
      'roof_facade',
      'gas',
    ]),
    name: z.string().trim().min(3),
    condition: z.enum(['normal', 'wear', 'critical']),
    wearPercent: z.number().int().min(0).max(100),
    lastInspectionDate: z.string().min(4),
    nextInspectionDate: z.string().min(4),
    notes: z.string().optional(),
  }),
]);

const patchBuildingSchema = z.object({
  conditionScore: z.number().int().min(0).max(100).optional(),
  conditionStatus: z.enum(['excellent', 'good', 'satisfactory', 'needs_repair']).optional(),
  notes: z.string().optional(),
  systemUpdate: z
    .object({
      id: z.number().int().positive(),
      condition: z.enum(['normal', 'wear', 'critical']),
      wearPercent: z.number().int().min(0).max(100),
      lastInspectionDate: z.string().optional(),
      nextInspectionDate: z.string().optional(),
      notes: z.string().optional(),
    })
    .optional(),
});

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(req, 'view_buildings');
  if ('response' in authResult) return authResult.response;

  const { id } = await context.params;
  const buildingId = Number(id);
  if (!Number.isInteger(buildingId) || buildingId <= 0) {
    return NextResponse.json({ error: 'Некорректный идентификатор дома' }, { status: 400 });
  }

  try {
    const bRows = await db
      .select()
      .from(buildings)
      .where(eq(buildings.id, buildingId))
      .limit(1);

    if (!bRows.length) {
      return NextResponse.json({ error: 'Дом не найден' }, { status: 404 });
    }

    const [unitsList, systemsList, ticketsList, maintList, emergList, brigadesList] =
      await Promise.all([
        db.select().from(apartments).where(eq(apartments.buildingId, buildingId)),
        db.select().from(engineeringSystems).where(eq(engineeringSystems.buildingId, buildingId)),
        db
          .select()
          .from(tickets)
          .where(eq(tickets.buildingId, buildingId))
          .orderBy(desc(tickets.createdAt)),
        db
          .select()
          .from(maintenancePlans)
          .where(eq(maintenancePlans.buildingId, buildingId))
          .orderBy(desc(maintenancePlans.scheduledDate)),
        db
          .select()
          .from(emergencies)
          .where(eq(emergencies.buildingId, buildingId))
          .orderBy(desc(emergencies.reportedAt)),
        db.select().from(brigades),
      ]);

    const brigadeMap = new Map(brigadesList.map((br) => [br.id, br.name]));

    // Residents do not see private phone numbers of other owners
    const isResident = authResult.user.role === 'resident';
    const safeApartments = unitsList.map((u) => ({
      ...u,
      areaSqm: Number(u.areaSqm),
      ownerName: isResident && u.number !== authResult.user.apartmentNumber ? 'Скрыто (персональные данные)' : u.ownerName,
      ownerPhone: isResident && u.number !== authResult.user.apartmentNumber ? null : u.ownerPhone,
    }));

    return NextResponse.json({
      building: {
        ...bRows[0],
        totalAreaSqm: Number(bRows[0].totalAreaSqm),
      },
      apartments: safeApartments,
      engineeringSystems: systemsList,
      tickets: isResident
        ? ticketsList.filter((t) => t.authorId === authResult.user.id)
        : ticketsList,
      maintenancePlans: maintList.map((m) => ({
        ...m,
        estimatedCost: Number(m.estimatedCost),
        brigadeName: m.brigadeId ? brigadeMap.get(m.brigadeId) ?? null : null,
      })),
      emergencies: emergList.map((e) => ({
        ...e,
        damageCost: Number(e.damageCost),
        brigadeName: e.brigadeId ? brigadeMap.get(e.brigadeId) ?? null : null,
      })),
    });
  } catch (error) {
    console.error('Failed to fetch building card:', error);
    return NextResponse.json(
      { error: 'Не удалось загрузить электронную карточку дома' },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(req, 'manage_buildings');
  if ('response' in authResult) return authResult.response;

  const { id } = await context.params;
  const buildingId = Number(id);
  if (!Number.isInteger(buildingId) || buildingId <= 0) {
    return NextResponse.json({ error: 'Некорректный ID дома' }, { status: 400 });
  }

  try {
    const body = await req.json();
    const parsed = addSubEntitySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Некорректные данные' },
        { status: 400 }
      );
    }

    if (parsed.data.entityType === 'apartment') {
      const created = await db
        .insert(apartments)
        .values({
          buildingId,
          number: parsed.data.number,
          entrance: parsed.data.entrance,
          floor: parsed.data.floor,
          areaSqm: parsed.data.areaSqm.toFixed(2),
          unitType: parsed.data.unitType,
          ownerName: parsed.data.ownerName,
          ownerPhone: parsed.data.ownerPhone || null,
          residentsCount: parsed.data.residentsCount,
        })
        .returning();
      return NextResponse.json({ apartment: created[0] }, { status: 201 });
    }

    const createdSys = await db
      .insert(engineeringSystems)
      .values({
        buildingId,
        systemType: parsed.data.systemType,
        name: parsed.data.name,
        condition: parsed.data.condition,
        wearPercent: parsed.data.wearPercent,
        lastInspectionDate: parsed.data.lastInspectionDate,
        nextInspectionDate: parsed.data.nextInspectionDate,
        notes: parsed.data.notes || null,
      })
      .returning();

    return NextResponse.json({ system: createdSys[0] }, { status: 201 });
  } catch (error) {
    console.error('Failed to add sub-entity to building:', error);
    return NextResponse.json(
      { error: 'Не удалось сохранить данные в карточку дома' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(req);
  if ('response' in authResult) return authResult.response;

  const { user } = authResult;
  const { id } = await context.params;
  const buildingId = Number(id);
  if (!Number.isInteger(buildingId) || buildingId <= 0) {
    return NextResponse.json({ error: 'Некорректный ID дома' }, { status: 400 });
  }

  try {
    const body = await req.json();
    const parsed = patchBuildingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Некорректные параметры обновления' }, { status: 400 });
    }

    if (parsed.data.systemUpdate) {
      if (user.role !== 'admin' && user.role !== 'specialist') {
        return NextResponse.json(
          { error: 'Проводить осмотр инженерных систем может специалист или администратор' },
          { status: 403 }
        );
      }

      const su = parsed.data.systemUpdate;
      const updatedSys = await db
        .update(engineeringSystems)
        .set({
          condition: su.condition,
          wearPercent: su.wearPercent,
          ...(su.lastInspectionDate ? { lastInspectionDate: su.lastInspectionDate } : {}),
          ...(su.nextInspectionDate ? { nextInspectionDate: su.nextInspectionDate } : {}),
          ...(su.notes !== undefined ? { notes: su.notes } : {}),
        })
        .where(eq(engineeringSystems.id, su.id))
        .returning();

      // Recalculate parent building condition score & status from all systems
      const allSystems = await db
        .select()
        .from(engineeringSystems)
        .where(eq(engineeringSystems.buildingId, buildingId));

      const { computeBuildingConditionFromSystems } = await import('@/lib/operations-logic');
      const recomputed = computeBuildingConditionFromSystems(allSystems);

      await db
        .update(buildings)
        .set({
          conditionScore: recomputed.conditionScore,
          conditionStatus: recomputed.conditionStatus,
        })
        .where(eq(buildings.id, buildingId));

      return NextResponse.json({
        system: updatedSys[0],
        buildingCondition: recomputed,
      });
    }

    if (user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Изменение параметров паспорта дома доступно только администратору' },
        { status: 403 }
      );
    }

    const updatedBuilding = await db
      .update(buildings)
      .set({
        ...(parsed.data.conditionScore !== undefined
          ? { conditionScore: parsed.data.conditionScore }
          : {}),
        ...(parsed.data.conditionStatus
          ? { conditionStatus: parsed.data.conditionStatus }
          : {}),
        ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
      })
      .where(eq(buildings.id, buildingId))
      .returning();

    return NextResponse.json({ building: updatedBuilding[0] });
  } catch (error) {
    console.error('Failed to update building:', error);
    return NextResponse.json(
      { error: 'Не удалось обновить параметры дома' },
      { status: 500 }
    );
  }
}
