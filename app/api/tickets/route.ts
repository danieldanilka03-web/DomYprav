import { NextRequest, NextResponse } from 'next/server';
import { count, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/src/db/index.ts';
import {
  brigades,
  buildings,
  notifications,
  ticketHistory,
  ticketMaterials,
  tickets,
  users,
  warehouseItems,
} from '@/src/db/schema.ts';
import { ensureSeedData } from '@/src/db/seed.ts';
import { requireAuth } from '@/lib/auth-server';
import {
  calculateSlaDeadline,
  generateTicketNumber,
  type TicketPriority,
} from '@/lib/operations-logic';

const createTicketSchema = z.object({
  buildingId: z.number().int().positive('Выберите дом'),
  apartmentNumber: z.string().trim().max(25).optional(),
  category: z.enum([
    'plumbing',
    'electricity',
    'heating',
    'elevator',
    'cleaning',
    'roof_facade',
    'intercom',
    'other',
  ]),
  title: z.string().trim().min(5, 'Укажите краткую суть проблемы (минимум 5 символов)'),
  description: z.string().trim().min(10, 'Опишите неисправность подробнее (минимум 10 символов)'),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  photoData: z.string().max(3_000_000, 'Размер фото слишком велик').nullable().optional(),
});

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req);
  if ('response' in authResult) return authResult.response;

  try {
    await ensureSeedData();
    const { user } = authResult;

    const [allTickets, allBuildings, allUsers, allBrigades, allMaterials, allItems] =
      await Promise.all([
        user.role === 'resident'
          ? db
              .select()
              .from(tickets)
              .where(eq(tickets.authorId, user.id))
              .orderBy(desc(tickets.createdAt))
          : db.select().from(tickets).orderBy(desc(tickets.createdAt)),
        db.select().from(buildings),
        db.select().from(users),
        db.select().from(brigades),
        db.select().from(ticketMaterials),
        db.select().from(warehouseItems),
      ]);

    const buildingMap = new Map(allBuildings.map((b) => [b.id, b.address]));
    const userMap = new Map(allUsers.map((u) => [u.id, u.fullName]));
    const brigadeMap = new Map(allBrigades.map((br) => [br.id, br.name]));
    const itemMap = new Map(allItems.map((i) => [i.id, i]));

    const enriched = allTickets.map((t) => {
      const usedMats = allMaterials
        .filter((m) => m.ticketId === t.id)
        .map((m) => {
          const item = itemMap.get(m.itemId);
          return {
            id: m.id,
            itemId: m.itemId,
            itemName: item?.name ?? 'Материал',
            unit: item?.unit ?? 'шт',
            quantityUsed: m.quantityUsed,
            unitPriceAtUse: Number(m.unitPriceAtUse),
            lineTotal: m.quantityUsed * Number(m.unitPriceAtUse),
          };
        });

      const materialsCost = usedMats.reduce((sum, m) => sum + m.lineTotal, 0);

      return {
        ...t,
        laborCost: Number(t.laborCost),
        materialsCost,
        totalCost: Number(t.laborCost) + materialsCost,
        buildingAddress: buildingMap.get(t.buildingId) ?? 'Не указан',
        authorName: t.authorId ? userMap.get(t.authorId) ?? 'Житель' : 'Система',
        dispatcherName: t.dispatcherId ? userMap.get(t.dispatcherId) ?? null : null,
        assigneeName: t.assigneeId ? userMap.get(t.assigneeId) ?? null : null,
        brigadeName: t.brigadeId ? brigadeMap.get(t.brigadeId) ?? null : null,
        materials: usedMats,
      };
    });

    return NextResponse.json({ tickets: enriched });
  } catch (error) {
    console.error('Failed to fetch tickets:', error);
    return NextResponse.json(
      { error: 'Не удалось загрузить список заявок' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req, 'create_ticket');
  if ('response' in authResult) return authResult.response;

  try {
    const body = await req.json();
    const parsed = createTicketSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Проверьте заполнение заявки' },
        { status: 400 }
      );
    }

    const { user } = authResult;
    const totalCount = await db.select({ value: count() }).from(tickets);
    const nextSeq = 101 + Number(totalCount[0]?.value ?? 0);
    const ticketNumber = generateTicketNumber(nextSeq, 2026);

    // Residents default to medium priority unless dispatcher/admin specifies priority
    const effectivePriority: TicketPriority =
      user.role === 'resident'
        ? 'medium'
        : parsed.data.priority ?? 'medium';

    const createdAt = new Date();
    const slaDeadline = calculateSlaDeadline(createdAt, effectivePriority);
    const initialStatus = user.role === 'resident' ? 'new' : 'registered';

    const inserted = await db
      .insert(tickets)
      .values({
        ticketNumber,
        buildingId: parsed.data.buildingId,
        apartmentNumber: parsed.data.apartmentNumber || user.apartmentNumber || null,
        category: parsed.data.category,
        title: parsed.data.title,
        description: parsed.data.description,
        photoData: parsed.data.photoData || null,
        priority: effectivePriority,
        status: initialStatus,
        authorId: user.id,
        dispatcherId: user.role === 'dispatcher' || user.role === 'admin' ? user.id : null,
        slaDeadline,
        createdAt,
        updatedAt: createdAt,
      })
      .returning();

    const created = inserted[0];

    await db.insert(ticketHistory).values({
      ticketId: created.id,
      actorId: user.id,
      actorName: user.fullName,
      action:
        user.role === 'resident'
          ? 'Обращение создано жителем'
          : 'Заявка зарегистрирована в системе',
      fromStatus: null,
      toStatus: initialStatus,
      comment: parsed.data.title,
    });

    await db.insert(notifications).values({
      targetRole: 'dispatcher',
      buildingId: created.buildingId,
      type: 'ticket',
      title: `Новая заявка ${created.ticketNumber}`,
      message: `${parsed.data.title} (кв. ${created.apartmentNumber || 'МОП'})`,
      isRead: false,
    });

    return NextResponse.json({ ticket: created }, { status: 201 });
  } catch (error) {
    console.error('Failed to create ticket:', error);
    return NextResponse.json(
      { error: 'Не удалось создать заявку' },
      { status: 500 }
    );
  }
}
