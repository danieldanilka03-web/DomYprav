import { NextRequest, NextResponse } from 'next/server';
import { asc, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/src/db/index.ts';
import {
  brigades,
  buildings,
  notifications,
  ticketComments,
  ticketHistory,
  ticketMaterials,
  tickets,
  users,
  warehouseItems,
} from '@/src/db/schema.ts';
import { requireAuth } from '@/lib/auth-server';
import {
  calculateSlaDeadline,
  canPerformAction,
  getAllowedTicketTransitions,
  STATUS_LABELS,
  type TicketPriority,
  type TicketStatus,
} from '@/lib/operations-logic';

const updateTicketSchema = z.object({
  status: z
    .enum(['new', 'registered', 'assigned', 'in_progress', 'resolved', 'closed'])
    .optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  assigneeId: z.number().int().positive().nullable().optional(),
  brigadeId: z.number().int().positive().nullable().optional(),
  resolutionNotes: z.string().trim().max(2000).optional(),
  afterPhotoData: z.string().max(3_000_000).nullable().optional(),
  residentRating: z.number().int().min(1).max(5).optional(),
  residentFeedback: z.string().trim().max(1000).optional(),
  laborCost: z.number().min(0).optional(),
  comment: z.string().trim().max(500).optional(),
});

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(req);
  if ('response' in authResult) return authResult.response;

  const { id } = await context.params;
  const ticketId = Number(id);
  if (!Number.isInteger(ticketId) || ticketId <= 0) {
    return NextResponse.json({ error: 'Некорректный ID заявки' }, { status: 400 });
  }

  try {
    const rows = await db
      .select()
      .from(tickets)
      .where(eq(tickets.id, ticketId))
      .limit(1);

    if (!rows.length) {
      return NextResponse.json({ error: 'Заявка не найдена' }, { status: 404 });
    }

    const ticket = rows[0];
    if (
      authResult.user.role === 'resident' &&
      ticket.authorId !== authResult.user.id
    ) {
      return NextResponse.json(
        { error: 'Нет доступа к чужому обращению' },
        { status: 403 }
      );
    }

    const [historyRows, commentRows, matRows, allItems, allUsers, allBuildings, allBrigades] =
      await Promise.all([
        db
          .select()
          .from(ticketHistory)
          .where(eq(ticketHistory.ticketId, ticketId))
          .orderBy(desc(ticketHistory.createdAt)),
        db
          .select()
          .from(ticketComments)
          .where(eq(ticketComments.ticketId, ticketId))
          .orderBy(asc(ticketComments.createdAt)),
        db
          .select()
          .from(ticketMaterials)
          .where(eq(ticketMaterials.ticketId, ticketId)),
        db.select().from(warehouseItems),
        db.select().from(users),
        db.select().from(buildings),
        db.select().from(brigades),
      ]);

    const itemMap = new Map(allItems.map((i) => [i.id, i]));
    const userMap = new Map(allUsers.map((u) => [u.id, u.fullName]));
    const buildingMap = new Map(allBuildings.map((b) => [b.id, b.address]));
    const brigadeMap = new Map(allBrigades.map((br) => [br.id, br.name]));

    const materials = matRows.map((m) => {
      const item = itemMap.get(m.itemId);
      return {
        id: m.id,
        itemId: m.itemId,
        sku: item?.sku ?? '',
        itemName: item?.name ?? 'Материал',
        unit: item?.unit ?? 'шт',
        quantityUsed: m.quantityUsed,
        unitPriceAtUse: Number(m.unitPriceAtUse),
        lineTotal: m.quantityUsed * Number(m.unitPriceAtUse),
        createdAt: m.createdAt,
      };
    });

    const materialsCost = materials.reduce((sum, m) => sum + m.lineTotal, 0);

    return NextResponse.json({
      ticket: {
        ...ticket,
        laborCost: Number(ticket.laborCost),
        materialsCost,
        totalCost: Number(ticket.laborCost) + materialsCost,
        buildingAddress: buildingMap.get(ticket.buildingId) ?? 'Не указан',
        authorName: ticket.authorId ? userMap.get(ticket.authorId) ?? 'Житель' : 'Система',
        dispatcherName: ticket.dispatcherId ? userMap.get(ticket.dispatcherId) ?? null : null,
        assigneeName: ticket.assigneeId ? userMap.get(ticket.assigneeId) ?? null : null,
        brigadeName: ticket.brigadeId ? brigadeMap.get(ticket.brigadeId) ?? null : null,
      },
      history: historyRows,
      comments: commentRows,
      materials,
    });
  } catch (error) {
    console.error('Failed to load ticket detail:', error);
    return NextResponse.json(
      { error: 'Не удалось загрузить карточку заявки' },
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

  const { id } = await context.params;
  const ticketId = Number(id);
  if (!Number.isInteger(ticketId) || ticketId <= 0) {
    return NextResponse.json({ error: 'Некорректный ID заявки' }, { status: 400 });
  }

  try {
    const body = await req.json();
    const parsed = updateTicketSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Некорректные данные обновления' },
        { status: 400 }
      );
    }

    const existingRows = await db
      .select()
      .from(tickets)
      .where(eq(tickets.id, ticketId))
      .limit(1);

    if (!existingRows.length) {
      return NextResponse.json({ error: 'Заявка не найдена' }, { status: 404 });
    }

    const existing = existingRows[0];
    const { user } = authResult;
    const data = parsed.data;

    // Permission checks
    if (user.role === 'resident') {
      if (existing.authorId !== user.id) {
        return NextResponse.json({ error: 'Нет доступа к этой заявке' }, { status: 403 });
      }
      if (data.status && data.status !== 'closed') {
        return NextResponse.json(
          { error: 'Житель может только подтвердить закрытие выполненной заявки' },
          { status: 403 }
        );
      }
      if (
        (data.residentRating !== undefined || data.residentFeedback !== undefined) &&
        existing.status !== 'resolved' &&
        existing.status !== 'closed'
      ) {
        return NextResponse.json(
          { error: 'Оценить качество работ можно после выполнения заявки' },
          { status: 400 }
        );
      }
    }

    if (
      (data.priority || data.assigneeId !== undefined || data.brigadeId !== undefined) &&
      !canPerformAction(user.role, 'triage_ticket')
    ) {
      return NextResponse.json(
        { error: 'Назначение исполнителя и приоритета доступно диспетчеру и администратору' },
        { status: 403 }
      );
    }

    if (
      data.afterPhotoData !== undefined &&
      !canPerformAction(user.role, 'execute_ticket')
    ) {
      return NextResponse.json(
        { error: 'Загружать фото после ремонта может только исполнитель или администратор' },
        { status: 403 }
      );
    }

    const currentStatus = existing.status as TicketStatus;
    let nextStatus = currentStatus;

    if (data.status && data.status !== currentStatus) {
      const allowed = getAllowedTicketTransitions(currentStatus, user.role);
      if (!allowed.includes(data.status)) {
        return NextResponse.json(
          { error: `Недопустимый переход статуса для роли «${user.role}»` },
          { status: 400 }
        );
      }
      nextStatus = data.status;
    } else if (
      (data.assigneeId || data.brigadeId) &&
      (currentStatus === 'new' || currentStatus === 'registered')
    ) {
      nextStatus = 'assigned';
    }

    const now = new Date();
    const nextPriority = (data.priority ?? existing.priority) as TicketPriority;
    const slaDeadline = data.priority
      ? calculateSlaDeadline(existing.createdAt, nextPriority)
      : existing.slaDeadline;

    const updatedRows = await db
      .update(tickets)
      .set({
        status: nextStatus,
        priority: nextPriority,
        slaDeadline,
        ...(data.assigneeId !== undefined ? { assigneeId: data.assigneeId } : {}),
        ...(data.brigadeId !== undefined ? { brigadeId: data.brigadeId } : {}),
        ...(user.role === 'dispatcher' || user.role === 'admin'
          ? { dispatcherId: user.id }
          : {}),
        ...(data.resolutionNotes !== undefined
          ? { resolutionNotes: data.resolutionNotes }
          : {}),
        ...(data.afterPhotoData !== undefined
          ? { afterPhotoData: data.afterPhotoData }
          : {}),
        ...(data.residentRating !== undefined
          ? { residentRating: data.residentRating }
          : {}),
        ...(data.residentFeedback !== undefined
          ? { residentFeedback: data.residentFeedback }
          : {}),
        ...(data.laborCost !== undefined
          ? { laborCost: data.laborCost.toFixed(2) }
          : {}),
        ...(nextStatus === 'in_progress' && !existing.startedAt
          ? { startedAt: now }
          : {}),
        ...(nextStatus === 'resolved' || nextStatus === 'closed'
          ? { completedAt: existing.completedAt ?? now }
          : {}),
        updatedAt: now,
      })
      .where(eq(tickets.id, ticketId))
      .returning();

    const updated = updatedRows[0];

    let actionText =
      nextStatus !== currentStatus
        ? `Статус изменён: ${STATUS_LABELS[currentStatus]} → ${STATUS_LABELS[nextStatus]}`
        : 'Обновлены параметры заявки';

    if (data.residentRating !== undefined) {
      actionText = `Житель оценил качество работ: ${data.residentRating} из 5`;
    }

    await db.insert(ticketHistory).values({
      ticketId: updated.id,
      actorId: user.id,
      actorName: user.fullName,
      action: actionText,
      fromStatus: currentStatus,
      toStatus: nextStatus,
      comment: data.residentFeedback || data.comment || data.resolutionNotes || null,
    });

    // Notify author on key milestones
    if (existing.authorId && existing.authorId !== user.id && nextStatus !== currentStatus) {
      await db.insert(notifications).values({
        userId: existing.authorId,
        buildingId: existing.buildingId,
        type: 'ticket',
        title: `Обновление по заявке ${existing.ticketNumber}`,
        message: `${actionText}${data.resolutionNotes ? ` — ${data.resolutionNotes}` : ''}`,
        isRead: false,
      });
    }

    // Notify newly assigned specialist
    if (data.assigneeId && data.assigneeId !== existing.assigneeId) {
      await db.insert(notifications).values({
        userId: data.assigneeId,
        buildingId: existing.buildingId,
        type: 'ticket',
        title: `Вам назначена заявка ${existing.ticketNumber}`,
        message: existing.title,
        isRead: false,
      });
    }

    return NextResponse.json({ ticket: updated });
  } catch (error) {
    console.error('Failed to update ticket:', error);
    return NextResponse.json(
      { error: 'Не удалось обновить заявку' },
      { status: 500 }
    );
  }
}
