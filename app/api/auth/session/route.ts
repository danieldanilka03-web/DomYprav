import { NextRequest, NextResponse } from 'next/server';
import { asc } from 'drizzle-orm';
import { db } from '@/src/db/index.ts';
import { buildings } from '@/src/db/schema.ts';
import { ensureSeedData } from '@/src/db/seed.ts';
import { clearSessionCookie, getAuthenticatedUser } from '@/lib/auth-server';

export async function GET(req: NextRequest) {
  try {
    await ensureSeedData();
    const user = await getAuthenticatedUser(req);
    const buildingsList = await db
      .select({
        id: buildings.id,
        address: buildings.address,
        district: buildings.district,
      })
      .from(buildings)
      .orderBy(asc(buildings.address));

    return NextResponse.json({
      user,
      buildings: buildingsList,
    });
  } catch (error) {
    console.error('Session check failed:', error);
    return NextResponse.json(
      { error: 'Не удалось загрузить сессию. Попробуйте обновить страницу.' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const res = NextResponse.json({ ok: true });
  clearSessionCookie(res, req);
  return res;
}
