import { NextRequest, NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/src/db/index.ts';
import {
  brigades,
  buildings,
  engineeringSystems,
  maintenancePlans,
  notifications,
} from '@/src/db/schema.ts';
import { ensureSeedData } from '@/src/db/seed.ts';
import { requireAuth } from '@/lib/auth-server';

const createPlanSchema = z.object({
  buildingId: z.number().int().positive(),
  systemId: z.number().int().positive().nullable().optional(),
  title: z.string().trim().min(5, 'Укажите название работ ТО'),
  description: z.string().trim().min(5, 'Укажите описание регламентных работ'),
  frequency: z.enum(['monthly', 'quarterly', 'semiannual', 'annual', 'once']),
  scheduledDate: z.string().min(4),
  brigadeId: z.number().int().positive().nullable().optional(),
  estimatedCost: z.number().min(0).default(0),
});

const patchPlanSchema = z.object({
  id: z.number().int().positive(),
  status: z.enum(['planned', 'in_progress', 'completed', 'overdue']),
  completedDate: z.string().nullable().optional(),
});

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req, 'view_maintenance');
  if ('response' in authResult) return authResult.response;

  try {
    await ensureSeedData();
    const { user } = authResult;

    const [plans, allBuildings, allBrigades, allSystems] = await Promise.all([
      user.role === 'resident' && user.buildingId
        ? db
            .select()
            .from(maintenancePlans)
            .where(eq(maintenancePlans.buildingId, user.buildingId))
            .orderBy(desc(maintenancePlans.scheduledDate))
        : db
            .select()
            .from(maintenancePlans)
            .orderBy(desc(maintenancePlans.scheduledDate)),
      db.select().from(buildings),
      db.select().from(brigades),
      db.select().from(engineeringSystems),
    ]);

    const buildingMap = new Map(allBuildings.map((b) => [b.id, b.address]));
    const brigadeMap = new Map(allBrigades.map((br) => [br.id, br.name]));
    const systemMap = new Map(allSystems.map((s) => [s.id, s.name]));

    return NextResponse.json({
      plans: plans.map((p) => ({
        ...p,
        estimatedCost: Number(p.estimatedCost),
        buildingAddress: buildingMap.get(p.buildingId) ?? 'Не указан',
        brigadeName: p.brigadeId ? brigadeMap.get(p.brigadeId) ?? null : null,
        systemName: p.systemId ? systemMap.get(p.systemId) ?? null : null,
      })),
    });
  } catch (error) {
    console.error('Failed to load maintenance plans:', error);
    return NextResponse.json(
      { error: 'Не удалось загрузить график техобслуживания' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req, 'manage_maintenance');
  if ('response' in authResult) return authResult.response;

  try {
    const body = await req.json();
    const parsed = createPlanSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Некорректные данные плана ТО' },
        { status: 400 }
      );
    }

    const inserted = await db
      .insert(maintenancePlans)
      .values({
        buildingId: parsed.data.buildingId,
        systemId: parsed.data.systemId ?? null,
        title: parsed.data.title,
        description: parsed.data.description,
        frequency: parsed.data.frequency,
        scheduledDate: parsed.data.scheduledDate,
        brigadeId: parsed.data.brigadeId ?? null,
        estimatedCost: parsed.data.estimatedCost.toFixed(2),
        status: 'planned',
      })
      .returning();

    await db.insert(notifications).values({
      targetRole: 'resident',
      buildingId: parsed.data.buildingId,
      type: 'maintenance',
      title: `Плановое ТО: ${parsed.data.title}`,
      message: `Запланировано на ${parsed.data.scheduledDate}. ${parsed.data.description}`,
      isRead: false,
    });

    return NextResponse.json({ plan: inserted[0] }, { status: 201 });
  } catch (error) {
    console.error('Failed to create maintenance plan:', error);
    return NextResponse.json(
      { error: 'Не удалось запланировать техническое обслуживание' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const authResult = await requireAuth(req);
  if ('response' in authResult) return authResult.response;

  const { user } = authResult;
  if (user.role === 'resident') {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = patchPlanSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Некорректные параметры обновления' }, { status: 400 });
    }

    const completedDate =
      parsed.data.status === 'completed'
        ? parsed.data.completedDate || new Date().toISOString().slice(0, 10)
        : null;

    const updated = await db
      .update(maintenancePlans)
      .set({
        status: parsed.data.status,
        completedDate,
      })
      .where(eq(maintenancePlans.id, parsed.data.id))
      .returning();

    return NextResponse.json({ plan: updated[0] });
  } catch (error) {
    console.error('Failed to update maintenance plan:', error);
    return NextResponse.json(
      { error: 'Не удалось обновить статус ТО' },
      { status: 500 }
    );
  }
}
