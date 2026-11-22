import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateSlaDeadline,
  canPerformAction,
  computeAverageResolutionHours,
  computeBrigadeRatings,
  computeBuildingConditionFromSystems,
  computeBuildingRiskRanking,
  computeMeterConsumption,
  computeSlaCompliancePercent,
  generateTicketNumber,
  getAllowedTicketTransitions,
  isTicketOverdue,
} from './operations-logic';

test('RBAC permissions enforce strict role boundaries', () => {
  assert.equal(canPerformAction('admin', 'manage_staff'), true);
  assert.equal(canPerformAction('admin', 'manage_buildings'), true);

  assert.equal(canPerformAction('dispatcher', 'triage_ticket'), true);
  assert.equal(canPerformAction('dispatcher', 'manage_staff'), false);
  assert.equal(canPerformAction('dispatcher', 'consume_materials'), false);

  assert.equal(canPerformAction('specialist', 'execute_ticket'), true);
  assert.equal(canPerformAction('specialist', 'consume_materials'), true);
  assert.equal(canPerformAction('specialist', 'triage_ticket'), false);
  assert.equal(canPerformAction('specialist', 'view_analytics'), false);

  assert.equal(canPerformAction('resident', 'create_ticket'), true);
  assert.equal(canPerformAction('resident', 'view_all_tickets'), false);
  assert.equal(canPerformAction('resident', 'manage_warehouse'), false);
});

test('Ticket workflow transitions follow role state machine', () => {
  assert.deepEqual(getAllowedTicketTransitions('new', 'dispatcher'), [
    'registered',
    'assigned',
  ]);
  assert.deepEqual(getAllowedTicketTransitions('assigned', 'specialist'), [
    'in_progress',
  ]);
  assert.deepEqual(getAllowedTicketTransitions('in_progress', 'specialist'), [
    'resolved',
  ]);
  assert.deepEqual(getAllowedTicketTransitions('resolved', 'resident'), [
    'closed',
  ]);
  assert.deepEqual(getAllowedTicketTransitions('new', 'resident'), []);
});

test('SLA deadline and overdue calculation match priority rules', () => {
  const start = new Date('2026-11-20T10:00:00Z');
  const criticalDeadline = calculateSlaDeadline(start, 'critical');
  assert.equal(criticalDeadline.toISOString(), '2026-11-20T14:00:00.000Z');

  const mediumDeadline = calculateSlaDeadline(start, 'medium');
  assert.equal(mediumDeadline.toISOString(), '2026-11-22T10:00:00.000Z');

  assert.equal(
    isTicketOverdue('in_progress', criticalDeadline, new Date('2026-11-20T15:00:00Z')),
    true
  );
  assert.equal(
    isTicketOverdue('resolved', criticalDeadline, new Date('2026-11-20T15:00:00Z')),
    false
  );
});

test('Analytics metrics compute building risk, SLA compliance, and resolution time', () => {
  const buildings = [
    { id: 1, address: 'ул. Ленина, 14', conditionScore: 92 },
    { id: 2, address: 'пр. Мира, 48', conditionScore: 62 },
  ];
  const tickets = [
    {
      buildingId: 2,
      category: 'heating',
      status: 'in_progress',
      priority: 'high',
      createdAt: '2026-11-18T08:00:00Z',
      completedAt: null,
      slaDeadline: '2026-11-18T20:00:00Z',
      laborCost: 4500,
      materialsCost: 3200,
    },
    {
      buildingId: 1,
      category: 'plumbing',
      status: 'resolved',
      priority: 'medium',
      createdAt: '2026-11-19T08:00:00Z',
      completedAt: '2026-11-19T14:00:00Z',
      slaDeadline: '2026-11-21T08:00:00Z',
      laborCost: 2000,
      materialsCost: 500,
    },
  ];
  const emergencies = [
    {
      buildingId: 2,
      systemType: 'heating',
      status: 'active',
      damageCost: 25000,
      responseMinutes: 18,
    },
  ];
  const maintenance = [
    { buildingId: 2, status: 'overdue', estimatedCost: 12000 },
    { buildingId: 1, status: 'completed', estimatedCost: 8000 },
  ];

  const ranking = computeBuildingRiskRanking(
    buildings,
    tickets,
    emergencies,
    maintenance
  );
  assert.equal(ranking[0].buildingId, 2);
  assert.ok(ranking[0].riskIndex > ranking[1].riskIndex);
  assert.equal(ranking[0].totalCost, 4500 + 3200 + 25000);
  assert.equal(ranking[1].totalCost, 2000 + 500 + 8000);

  const sla = computeSlaCompliancePercent(tickets, new Date('2026-11-20T12:00:00Z'));
  assert.equal(sla, 50);

  const avgHours = computeAverageResolutionHours(tickets);
  assert.equal(avgHours, 6);

  assert.equal(generateTicketNumber(42, 2026), 'З-2026-0042');
});

test('Building condition recalculation, meter consumption, and brigade ratings work accurately', () => {
  const goodCond = computeBuildingConditionFromSystems([
    { wearPercent: 10, condition: 'normal' },
    { wearPercent: 14, condition: 'normal' },
  ]);
  assert.equal(goodCond.conditionScore, 88);
  assert.equal(goodCond.conditionStatus, 'excellent');

  const wornCond = computeBuildingConditionFromSystems([
    { wearPercent: 40, condition: 'wear' },
    { wearPercent: 60, condition: 'critical' },
  ]);
  assert.equal(wornCond.conditionScore, 44);
  assert.equal(wornCond.conditionStatus, 'needs_repair');

  const okMeter = computeMeterConsumption(142.5, 138.2);
  assert.equal(okMeter.valid, true);
  assert.equal(okMeter.consumption, 4.3);

  const badMeter = computeMeterConsumption(130, 138.2);
  assert.equal(badMeter.valid, false);

  const ratings = computeBrigadeRatings(
    [
      { id: 1, name: 'Бригада 1' },
      { id: 2, name: 'Бригада 2' },
    ],
    [
      { brigadeId: 1, status: 'closed', residentRating: 5 },
      { brigadeId: 1, status: 'resolved', residentRating: 4 },
      { brigadeId: 2, status: 'closed', residentRating: 5 },
    ]
  );
  assert.equal(ratings[0].brigadeId, 2);
  assert.equal(ratings[0].avgRating, 5);
  assert.equal(ratings[1].avgRating, 4.5);
  assert.equal(ratings[1].ratedCount, 2);
});
