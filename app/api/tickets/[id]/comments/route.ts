import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/src/db/index.ts';
import { notifications, ticketComments, tickets } from '@/src/db/schema.ts';
import { requireAuth } from '@/lib/auth-server';

const createCommentSchema = z.object({
  message: z.string().trim().min(1, 'Введите сообщение').max(1500),
});

export async function POST(
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
    const parsed = createCommentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Некорректное сообщение' },
        { status: 400 }
      );
    }

    const ticketRows = await db
      .select()
      .from(tickets)
      .where(eq(tickets.id, ticketId))
      .limit(1);

    if (!ticketRows.length) {
      return NextResponse.json({ error: 'Заявка не найдена' }, { status: 404 });
    }

    const ticket = ticketRows[0];
    const { user } = authResult;

    if (user.role === 'resident' && ticket.authorId !== user.id) {
      return NextResponse.json(
        { error: 'Нет доступа к чужой заявке' },
        { status: 403 }
      );
    }

    const inserted = await db
      .insert(ticketComments)
      .values({
        ticketId,
        authorId: user.id,
        authorName: user.fullName,
        authorRole: user.role,
        message: parsed.data.message,
      })
      .returning();

    // Notify opposite party
    if (user.role === 'resident') {
      const targetUserId = ticket.assigneeId ?? ticket.dispatcherId ?? null;
      await db.insert(notifications).values({
        userId: targetUserId,
        targetRole: targetUserId ? null : 'dispatcher',
        buildingId: ticket.buildingId,
        type: 'ticket',
        title: `Новое сообщение по заявке ${ticket.ticketNumber}`,
        message: `${user.fullName}: ${parsed.data.message.slice(0, 140)}`,
        isRead: false,
      });
    } else if (ticket.authorId && ticket.authorId !== user.id) {
      await db.insert(notifications).values({
        userId: ticket.authorId,
        buildingId: ticket.buildingId,
        type: 'ticket',
        title: `Ответ по заявке ${ticket.ticketNumber}`,
        message: `${user.fullName}: ${parsed.data.message.slice(0, 140)}`,
        isRead: false,
      });
    }

    return NextResponse.json({ comment: inserted[0] }, { status: 201 });
  } catch (error) {
    console.error('Failed to add ticket comment:', error);
    return NextResponse.json(
      { error: 'Не удалось отправить сообщение' },
      { status: 500 }
    );
  }
}
