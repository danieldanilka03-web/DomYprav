import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/db/index.ts';
import {
  brigades,
  buildings,
  emergencies,
  engineeringSystems,
  maintenancePlans,
  ticketMaterials,
  tickets,
  warehouseItems,
} from '@/src/db/schema.ts';
import { ensureSeedData } from '@/src/db/seed.ts';
import { requireAuth } from '@/lib/auth-server';
import {
  CATEGORY_LABELS,
  computeAverageResolutionHours,
  computeBrigadeRatings,
  computeBuildingRiskRanking,
  computeSlaCompliancePercent,
  STATUS_LABELS,
  SYSTEM_TYPE_LABELS,
  type TicketStatus,
} from '@/lib/operations-logic';

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req, 'view_analytics');
  if ('response' in authResult) return authResult.response;

  try {
    await ensureSeedData();
    const [
      allBuildings,
      allTickets,
      allMaterials,
      allEmergencies,
      allMaintenance,
      allSystems,
      allItems,
      allBrigades,
    ] = await Promise.all([
      db.select().from(buildings),
      db.select().from(tickets),
      db.select().from(ticketMaterials),
      db.select().from(emergencies),
      db.select().from(maintenancePlans),
      db.select().from(engineeringSystems),
      db.select().from(warehouseItems),
      db.select().from(brigades),
    ]);

    // Map material cost per ticket
    const matCostByTicket = new Map<number, number>();
    let totalMaterialsCost = 0;
    for (const m of allMaterials) {
      const cost = m.quantityUsed * Number(m.unitPriceAtUse);
      totalMaterialsCost += cost;
      matCostByTicket.set(m.ticketId, (matCostByTicket.get(m.ticketId) ?? 0) + cost);
    }

    const analyticsTickets = allTickets.map((t) => ({
      buildingId: t.buildingId,
      category: t.category,
      status: t.status,
      priority: t.priority,
      createdAt: t.createdAt,
      completedAt: t.completedAt,
      slaDeadline: t.slaDeadline,
      laborCost: Number(t.laborCost),
      materialsCost: matCostByTicket.get(t.id) ?? 0,
    }));

    const analyticsEmergencies = allEmergencies.map((e) => ({
      buildingId: e.buildingId,
      systemType: e.systemType,
      status: e.status,
      damageCost: Number(e.damageCost),
      responseMinutes: e.responseMinutes,
    }));

    const analyticsMaintenance = allMaintenance.map((m) => ({
      buildingId: m.buildingId,
      status: m.status,
      estimatedCost: Number(m.estimatedCost),
    }));

    const slaCompliancePercent = computeSlaCompliancePercent(analyticsTickets);
    const avgResolutionHours = computeAverageResolutionHours(analyticsTickets);
    const buildingRanking = computeBuildingRiskRanking(
      allBuildings.map((b) => ({
        id: b.id,
        address: b.address,
        conditionScore: b.conditionScore,
      })),
      analyticsTickets,
      analyticsEmergencies,
      analyticsMaintenance
    );

    // Tickets by category
    const categoryCounts = new Map<string, number>();
    for (const t of allTickets) {
      categoryCounts.set(t.category, (categoryCounts.get(t.category) ?? 0) + 1);
    }
    const ticketsByCategory = Array.from(categoryCounts.entries())
      .map(([key, count]) => ({
        key,
        name: CATEGORY_LABELS[key] ?? key,
        count,
      }))
      .sort((a, b) => b.count - a.count);

    // Tickets by status
    const statusOrder: TicketStatus[] = [
      'new',
      'registered',
      'assigned',
      'in_progress',
      'resolved',
      'closed',
    ];
    const ticketsByStatus = statusOrder.map((st) => ({
      key: st,
      name: STATUS_LABELS[st],
      count: allTickets.filter((t) => t.status === st).length,
    }));

    // Problem engineering systems ranked by wear & emergencies
    const systemAgg = new Map<
      string,
      { count: number; totalWear: number; criticalCount: number; emergencyCount: number }
    >();
    for (const s of allSystems) {
      const curr = systemAgg.get(s.systemType) ?? {
        count: 0,
        totalWear: 0,
        criticalCount: 0,
        emergencyCount: 0,
      };
      curr.count += 1;
      curr.totalWear += s.wearPercent;
      if (s.condition === 'critical') curr.criticalCount += 1;
      systemAgg.set(s.systemType, curr);
    }
    for (const e of allEmergencies) {
      const curr = systemAgg.get(e.systemType) ?? {
        count: 0,
        totalWear: 0,
        criticalCount: 0,
        emergencyCount: 0,
      };
      curr.emergencyCount += 1;
      systemAgg.set(e.systemType, curr);
    }

    const problemSystems = Array.from(systemAgg.entries())
      .map(([type, data]) => ({
        systemType: type,
        name: SYSTEM_TYPE_LABELS[type] ?? type,
        avgWearPercent: data.count > 0 ? Math.round(data.totalWear / data.count) : 0,
        criticalCount: data.criticalCount,
        emergencyCount: data.emergencyCount,
      }))
      .sort((a, b) => b.avgWearPercent + b.emergencyCount * 15 - (a.avgWearPercent + a.emergencyCount * 15));

    // Expense breakdown
    const totalLaborCost = analyticsTickets.reduce((s, t) => s + t.laborCost, 0);
    const totalEmergencyCost = analyticsEmergencies.reduce((s, e) => s + e.damageCost, 0);
    const totalMaintenanceCost = analyticsMaintenance
      .filter((m) => m.status === 'completed' || m.status === 'in_progress')
      .reduce((s, m) => s + m.estimatedCost, 0);
    const totalOperationalExpenses = Math.round(
      totalLaborCost + totalMaterialsCost + totalEmergencyCost + totalMaintenanceCost
    );

    const expensesBreakdown = [
      { name: 'Аварийно-восстановительные работы', value: Math.round(totalEmergencyCost) },
      { name: 'Плановое ТО систем', value: Math.round(totalMaintenanceCost) },
      { name: 'Текущий ремонт (трудозатраты)', value: Math.round(totalLaborCost) },
      { name: 'Списанные материалы со склада', value: Math.round(totalMaterialsCost) },
    ];

    const avgEmergencyResponseMinutes = allEmergencies.length
      ? Math.round(
          allEmergencies.reduce((sum, e) => sum + (e.responseMinutes ?? 20), 0) /
            allEmergencies.length
        )
      : 0;

    const lowStockItemsCount = allItems.filter((i) => i.quantity <= i.minQuantity).length;
    const warehouseTotalValue = Math.round(
      allItems.reduce((sum, i) => sum + i.quantity * Number(i.unitPrice), 0)
    );

    const ratedTickets = allTickets.filter(
      (t) => typeof t.residentRating === 'number' && t.residentRating >= 1 && t.residentRating <= 5
    );
    const avgResidentRating =
      ratedTickets.length > 0
        ? Math.round(
            (ratedTickets.reduce((s, t) => s + Number(t.residentRating), 0) /
              ratedTickets.length) *
              10
          ) / 10
        : 0;

    const brigadeRatings = computeBrigadeRatings(
      allBrigades.map((br) => ({ id: br.id, name: br.name })),
      allTickets.map((t) => ({
        brigadeId: t.brigadeId,
        status: t.status,
        residentRating: t.residentRating,
      }))
    );

    return NextResponse.json({
      kpis: {
        buildingsCount: allBuildings.length,
        totalTickets: allTickets.length,
        openTickets: allTickets.filter(
          (t) => t.status !== 'resolved' && t.status !== 'closed'
        ).length,
        slaCompliancePercent,
        avgResolutionHours,
        activeEmergencies: allEmergencies.filter((e) => e.status !== 'resolved').length,
        totalEmergencies: allEmergencies.length,
        avgEmergencyResponseMinutes,
        overdueMaintenance: allMaintenance.filter((m) => m.status === 'overdue').length,
        lowStockItemsCount,
        warehouseTotalValue,
        totalOperationalExpenses,
        avgResidentRating,
        ratedTicketsCount: ratedTickets.length,
      },
      ticketsByCategory,
      ticketsByStatus,
      expensesBreakdown,
      buildingRanking,
      problemSystems,
      brigadeRatings,
    });
  } catch (error) {
    console.error('Failed to compute analytics:', error);
    return NextResponse.json(
      { error: 'Не удалось сформировать аналитический отчёт' },
      { status: 500 }
    );
  }
}
