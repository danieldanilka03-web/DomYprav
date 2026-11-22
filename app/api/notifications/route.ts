import { NextRequest, NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/src/db/index.ts';
import { buildings, notifications } from '@/src/db/schema.ts';
import { ensureSeedData } from '@/src/db/seed.ts';
import { requireAuth } from '@/lib/auth-server';

const markReadSchema = z.object({
  id: z.number().int().positive().optional(),
  markAll: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req, 'view_notifications');
  if ('response' in authResult) return authResult.response;

  try {
    await ensureSeedData();
    const { user } = authResult;
    const [allNotifications, allBuildings] = await Promise.all([
      db.select().from(notifications).orderBy(desc(notifications.createdAt)),
      db.select().from(buildings),
    ]);

    const buildingMap = new Map(allBuildings.map((b) => [b.id, b.address]));

    const relevant = allNotifications.filter((n) => {
      if (n.userId !== null) return n.userId === user.id;
      if (user.role === 'admin') return true;
      if (n.targetRole && n.targetRole !== user.role) return false;
      if (user.role === 'resident' && n.buildingId && user.buildingId) {
        return n.buildingId === user.buildingId;
      }
      return true;
    });

    return NextResponse.json({
      notifications: relevant.map((n) => ({
        ...n,
        buildingAddress: n.buildingId ? buildingMap.get(n.buildingId) ?? null : null,
      })),
    });
  } catch (error) {
    console.error('Failed to fetch notifications:', error);
    return NextResponse.json(
      { error: 'Не удалось загрузить уведомления' },
      { status: 500 }
    );
  }
}

const createNotificationSchema = z.object({
  title: z.string().trim().min(3, 'Укажите заголовок оповещения').max(200),
  message: z.string().trim().min(5, 'Введите текст сообщения').max(1500),
  type: z.enum(['emergency', 'ticket', 'maintenance', 'inventory', 'system']).default('system'),
  targetRole: z.enum(['all', 'resident', 'specialist', 'dispatcher', 'admin']).default('resident'),
  buildingId: z.number().int().positive().nullable().optional(),
});

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req, 'triage_ticket');
  if ('response' in authResult) return authResult.response;

  try {
    const body = await req.json();
    const parsed = createNotificationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Некорректные данные оповещения' },
        { status: 400 }
      );
    }

    const inserted = await db
      .insert(notifications)
      .values({
        userId: null,
        targetRole: parsed.data.targetRole === 'all' ? null : parsed.data.targetRole,
        buildingId: parsed.data.buildingId ?? null,
        type: parsed.data.type,
        title: parsed.data.title,
        message: parsed.data.message,
        isRead: false,
      })
      .returning();

    return NextResponse.json({ notification: inserted[0] }, { status: 201 });
  } catch (error) {
    console.error('Failed to create notification:', error);
    return NextResponse.json(
      { error: 'Не удалось отправить оповещение' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const authResult = await requireAuth(req, 'view_notifications');
  if ('response' in authResult) return authResult.response;

  try {
    const body = await req.json();
    const parsed = markReadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Некорректный запрос' }, { status: 400 });
    }

    if (parsed.data.id) {
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(eq(notifications.id, parsed.data.id));
    } else if (parsed.data.markAll) {
      const all = await db.select().from(notifications);
      const { user } = authResult;
      const toMark = all.filter((n) => {
        if (n.isRead) return false;
        if (n.userId !== null) return n.userId === user.id;
        if (user.role === 'admin') return true;
        if (n.targetRole && n.targetRole !== user.role) return false;
        return true;
      });
      await Promise.all(
        toMark.map((n) =>
          db.update(notifications).set({ isRead: true }).where(eq(notifications.id, n.id))
        )
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Failed to update notifications:', error);
    return NextResponse.json(
      { error: 'Не удалось обновить статус уведомлений' },
      { status: 500 }
    );
  }
}
