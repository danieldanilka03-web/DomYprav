import { NextRequest, NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/src/db/index.ts';
import { warehouseItems } from '@/src/db/schema.ts';
import { ensureSeedData } from '@/src/db/seed.ts';
import { requireAuth } from '@/lib/auth-server';

const createItemSchema = z.object({
  sku: z.string().trim().min(2, 'Укажите артикул'),
  name: z.string().trim().min(3, 'Укажите наименование материала'),
  category: z.enum([
    'plumbing',
    'electricity',
    'heating',
    'construction',
    'fasteners',
    'consumables',
  ]),
  unit: z.string().trim().min(1).max(16),
  quantity: z.number().int().min(0),
  minQuantity: z.number().int().min(0),
  unitPrice: z.number().min(0),
  location: z.string().trim().min(2),
});

const patchItemSchema = z.object({
  id: z.number().int().positive(),
  deltaQuantity: z.number().int().optional(),
  quantity: z.number().int().min(0).optional(),
  minQuantity: z.number().int().min(0).optional(),
  unitPrice: z.number().min(0).optional(),
});

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req, 'view_warehouse');
  if ('response' in authResult) return authResult.response;

  try {
    await ensureSeedData();
    const items = await db
      .select()
      .from(warehouseItems)
      .orderBy(asc(warehouseItems.name));

    return NextResponse.json({
      items: items.map((i) => ({
        ...i,
        unitPrice: Number(i.unitPrice),
        totalValue: i.quantity * Number(i.unitPrice),
        isLowStock: i.quantity <= i.minQuantity,
      })),
    });
  } catch (error) {
    console.error('Failed to load warehouse inventory:', error);
    return NextResponse.json(
      { error: 'Не удалось загрузить остатки склада' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req, 'manage_warehouse');
  if ('response' in authResult) return authResult.response;

  try {
    const body = await req.json();
    const parsed = createItemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Проверьте заполнение позиции' },
        { status: 400 }
      );
    }

    const inserted = await db
      .insert(warehouseItems)
      .values({
        sku: parsed.data.sku.toUpperCase(),
        name: parsed.data.name,
        category: parsed.data.category,
        unit: parsed.data.unit,
        quantity: parsed.data.quantity,
        minQuantity: parsed.data.minQuantity,
        unitPrice: parsed.data.unitPrice.toFixed(2),
        location: parsed.data.location,
        updatedAt: new Date(),
      })
      .returning();

    return NextResponse.json({ item: inserted[0] }, { status: 201 });
  } catch (error) {
    console.error('Failed to create warehouse item:', error);
    return NextResponse.json(
      { error: 'Не удалось добавить позицию на склад (проверьте уникальность артикула)' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const authResult = await requireAuth(req, 'manage_warehouse');
  if ('response' in authResult) return authResult.response;

  try {
    const body = await req.json();
    const parsed = patchItemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Некорректные данные обновления склада' }, { status: 400 });
    }

    const existing = await db
      .select()
      .from(warehouseItems)
      .where(eq(warehouseItems.id, parsed.data.id))
      .limit(1);

    if (!existing.length) {
      return NextResponse.json({ error: 'Позиция не найдена' }, { status: 404 });
    }

    const nextQuantity =
      parsed.data.deltaQuantity !== undefined
        ? Math.max(0, existing[0].quantity + parsed.data.deltaQuantity)
        : parsed.data.quantity ?? existing[0].quantity;

    const updated = await db
      .update(warehouseItems)
      .set({
        quantity: nextQuantity,
        ...(parsed.data.minQuantity !== undefined
          ? { minQuantity: parsed.data.minQuantity }
          : {}),
        ...(parsed.data.unitPrice !== undefined
          ? { unitPrice: parsed.data.unitPrice.toFixed(2) }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(warehouseItems.id, parsed.data.id))
      .returning();

    return NextResponse.json({ item: updated[0] });
  } catch (error) {
    console.error('Failed to update warehouse item:', error);
    return NextResponse.json(
      { error: 'Не удалось обновить складскую позицию' },
      { status: 500 }
    );
  }
}
