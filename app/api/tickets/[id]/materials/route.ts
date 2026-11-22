import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/src/db/index.ts';
import {
  notifications,
  ticketHistory,
  ticketMaterials,
  tickets,
  warehouseItems,
} from '@/src/db/schema.ts';
import { requireAuth } from '@/lib/auth-server';

const consumeSchema = z.object({
  itemId: z.number().int().positive('Выберите материал со склада'),
  quantityUsed: z.number().int().positive('Укажите количество больше 0'),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(req, 'consume_materials');
  if ('response' in authResult) return authResult.response;

  const { id } = await context.params;
  const ticketId = Number(id);
  if (!Number.isInteger(ticketId) || ticketId <= 0) {
    return NextResponse.json({ error: 'Некорректный ID заявки' }, { status: 400 });
  }

  try {
    const body = await req.json();
    const parsed = consumeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Некорректные данные расхода' },
        { status: 400 }
      );
    }

    const [ticketRows, itemRows] = await Promise.all([
      db.select().from(tickets).where(eq(tickets.id, ticketId)).limit(1),
      db.select().from(warehouseItems).where(eq(warehouseItems.id, parsed.data.itemId)).limit(1),
    ]);

    if (!ticketRows.length) {
      return NextResponse.json({ error: 'Заявка не найдена' }, { status: 404 });
    }
    if (!itemRows.length) {
      return NextResponse.json({ error: 'Материал на складе не найден' }, { status: 404 });
    }

    const item = itemRows[0];
    if (item.quantity < parsed.data.quantityUsed) {
      return NextResponse.json(
        { error: `Недостаточно остатка на складе (доступно ${item.quantity} ${item.unit})` },
        { status: 400 }
      );
    }

    const newQuantity = item.quantity - parsed.data.quantityUsed;

    await db
      .update(warehouseItems)
      .set({
        quantity: newQuantity,
        updatedAt: new Date(),
      })
      .where(eq(warehouseItems.id, item.id));

    const inserted = await db
      .insert(ticketMaterials)
      .values({
        ticketId,
        itemId: item.id,
        quantityUsed: parsed.data.quantityUsed,
        unitPriceAtUse: item.unitPrice,
        recordedById: authResult.user.id,
      })
      .returning();

    await db.insert(ticketHistory).values({
      ticketId,
      actorId: authResult.user.id,
      actorName: authResult.user.fullName,
      action: `Списан материал со склада: ${item.name}`,
      comment: `${parsed.data.quantityUsed} ${item.unit} × ${Number(item.unitPrice)} ₽`,
    });

    if (newQuantity <= item.minQuantity) {
      await db.insert(notifications).values({
        targetRole: 'admin',
        type: 'inventory',
        title: `Низкий остаток материала: ${item.name}`,
        message: `Остаток на складе снизился до ${newQuantity} ${item.unit} (минимум: ${item.minQuantity} ${item.unit}). Требуется закупка.`,
        isRead: false,
      });
    }

    return NextResponse.json(
      {
        materialUsage: inserted[0],
        remainingQuantity: newQuantity,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Failed to record ticket material usage:', error);
    return NextResponse.json(
      { error: 'Не удалось списать материал по заявке' },
      { status: 500 }
    );
  }
}
