import { NextRequest, NextResponse } from 'next/server';
import { asc } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/src/db/index.ts';
import {
  apartments,
  buildings,
  emergencies,
  engineeringSystems,
  maintenancePlans,
  tickets,
} from '@/src/db/schema.ts';
import { ensureSeedData } from '@/src/db/seed.ts';
import { requireAuth } from '@/lib/auth-server';

const createBuildingSchema = z.object({
  address: z.string().trim().min(5, 'Укажите полный адрес дома'),
  district: z.string().trim().min(2, 'Укажите район'),
  yearBuilt: z.number().int().min(1900).max(2030),
  floors: z.number().int().min(1).max(100),
  entrances: z.number().int().min(1).max(30),
  totalAreaSqm: z.number().positive(),
  apartmentsCount: z.number().int().positive(),
  conditionScore: z.number().int().min(0).max(100).default(85),
  conditionStatus: z.enum(['excellent', 'good', 'satisfactory', 'needs_repair']).default('good'),
  managementSince: z.string().min(4),
  imageKey: z
    .enum(['building_modern_tower', 'building_courtyard_block', 'building_brick_classic'])
    .default('building_modern_tower'),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req, 'view_buildings');
  if ('response' in authResult) return authResult.response;

  try {
    await ensureSeedData();
    const [allBuildings, allTickets, allEmergencies, allSystems, allMaintenance, allApartments] =
      await Promise.all([
        db.select().from(buildings).orderBy(asc(buildings.id)),
        db.select().from(tickets),
        db.select().from(emergencies),
        db.select().from(engineeringSystems),
        db.select().from(maintenancePlans),
        db.select().from(apartments),
      ]);

    const enriched = allBuildings.map((b) => {
      const bTickets = allTickets.filter((t) => t.buildingId === b.id);
      const openTickets = bTickets.filter(
        (t) => t.status !== 'resolved' && t.status !== 'closed'
      );
      const activeEmergencies = allEmergencies.filter(
        (e) => e.buildingId === b.id && e.status !== 'resolved'
      );
      const bSystems = allSystems.filter((s) => s.buildingId === b.id);
      const criticalSystems = bSystems.filter((s) => s.condition === 'critical').length;
      const plannedMaint = allMaintenance.filter(
        (m) => m.buildingId === b.id && (m.status === 'planned' || m.status === 'overdue')
      ).length;
      const registeredUnits = allApartments.filter((a) => a.buildingId === b.id).length;

      return {
        ...b,
        totalAreaSqm: Number(b.totalAreaSqm),
        stats: {
          totalTickets: bTickets.length,
          openTickets: openTickets.length,
          activeEmergencies: activeEmergencies.length,
          systemsCount: bSystems.length,
          criticalSystems,
          plannedMaintenance: plannedMaint,
          registeredUnits,
        },
      };
    });

    return NextResponse.json({ buildings: enriched });
  } catch (error) {
    console.error('Failed to load buildings:', error);
    return NextResponse.json(
      { error: 'Не удалось загрузить реестр домов' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req, 'manage_buildings');
  if ('response' in authResult) return authResult.response;

  try {
    const body = await req.json();
    const parsed = createBuildingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Некорректные данные объекта' },
        { status: 400 }
      );
    }

    const inserted = await db
      .insert(buildings)
      .values({
        address: parsed.data.address,
        district: parsed.data.district,
        yearBuilt: parsed.data.yearBuilt,
        floors: parsed.data.floors,
        entrances: parsed.data.entrances,
        totalAreaSqm: parsed.data.totalAreaSqm.toFixed(2),
        apartmentsCount: parsed.data.apartmentsCount,
        conditionScore: parsed.data.conditionScore,
        conditionStatus: parsed.data.conditionStatus,
        managementSince: parsed.data.managementSince,
        imageKey: parsed.data.imageKey,
        notes: parsed.data.notes || null,
      })
      .returning();

    return NextResponse.json({ building: inserted[0] }, { status: 201 });
  } catch (error) {
    console.error('Failed to create building:', error);
    return NextResponse.json(
      { error: 'Не удалось добавить многоквартирный дом' },
      { status: 500 }
    );
  }
}
