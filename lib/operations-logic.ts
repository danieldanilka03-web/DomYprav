export type UserRole = 'admin' | 'dispatcher' | 'specialist' | 'resident';

export type TicketPriority = 'low' | 'medium' | 'high' | 'critical';

export type TicketStatus =
  | 'new'
  | 'registered'
  | 'assigned'
  | 'in_progress'
  | 'resolved'
  | 'closed';

export type TicketCategory =
  | 'plumbing'
  | 'electricity'
  | 'heating'
  | 'elevator'
  | 'cleaning'
  | 'roof_facade'
  | 'intercom'
  | 'other';

export type Permission =
  | 'view_dashboard'
  | 'view_buildings'
  | 'manage_buildings'
  | 'view_all_tickets'
  | 'create_ticket'
  | 'triage_ticket'
  | 'execute_ticket'
  | 'close_ticket'
  | 'view_maintenance'
  | 'manage_maintenance'
  | 'view_emergencies'
  | 'manage_emergencies'
  | 'view_warehouse'
  | 'manage_warehouse'
  | 'consume_materials'
  | 'view_analytics'
  | 'manage_staff'
  | 'view_notifications';

const ROLE_PERMISSIONS: Record<UserRole, ReadonlySet<Permission>> = {
  admin: new Set<Permission>([
    'view_dashboard',
    'view_buildings',
    'manage_buildings',
    'view_all_tickets',
    'create_ticket',
    'triage_ticket',
    'execute_ticket',
    'close_ticket',
    'view_maintenance',
    'manage_maintenance',
    'view_emergencies',
    'manage_emergencies',
    'view_warehouse',
    'manage_warehouse',
    'consume_materials',
    'view_analytics',
    'manage_staff',
    'view_notifications',
  ]),
  dispatcher: new Set<Permission>([
    'view_dashboard',
    'view_buildings',
    'view_all_tickets',
    'create_ticket',
    'triage_ticket',
    'close_ticket',
    'view_maintenance',
    'manage_maintenance',
    'view_emergencies',
    'manage_emergencies',
    'view_warehouse',
    'view_analytics',
    'view_notifications',
  ]),
  specialist: new Set<Permission>([
    'view_dashboard',
    'view_buildings',
    'view_all_tickets',
    'execute_ticket',
    'view_maintenance',
    'view_emergencies',
    'view_warehouse',
    'consume_materials',
    'view_notifications',
  ]),
  resident: new Set<Permission>([
    'view_dashboard',
    'view_buildings',
    'create_ticket',
    'view_maintenance',
    'view_notifications',
  ]),
};

export function isValidRole(value: string): value is UserRole {
  return (
    value === 'admin' ||
    value === 'dispatcher' ||
    value === 'specialist' ||
    value === 'resident'
  );
}

export function canPerformAction(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

export function getAllowedTicketTransitions(
  currentStatus: TicketStatus,
  role: UserRole
): TicketStatus[] {
  if (role === 'resident') {
    if (currentStatus === 'resolved') return ['closed'];
    return [];
  }

  if (role === 'specialist') {
    switch (currentStatus) {
      case 'assigned':
        return ['in_progress'];
      case 'in_progress':
        return ['resolved'];
      default:
        return [];
    }
  }

  if (role === 'dispatcher') {
    switch (currentStatus) {
      case 'new':
        return ['registered', 'assigned'];
      case 'registered':
        return ['assigned'];
      case 'assigned':
        return ['in_progress', 'closed'];
      case 'in_progress':
        return ['resolved'];
      case 'resolved':
        return ['closed', 'in_progress'];
      default:
        return [];
    }
  }

  // Admin can manage full lifecycle
  switch (currentStatus) {
    case 'new':
      return ['registered', 'assigned', 'closed'];
    case 'registered':
      return ['assigned', 'in_progress', 'closed'];
    case 'assigned':
      return ['in_progress', 'resolved', 'closed'];
    case 'in_progress':
      return ['resolved', 'closed'];
    case 'resolved':
      return ['closed', 'in_progress'];
    case 'closed':
      return ['in_progress'];
  }
}

const SLA_HOURS_BY_PRIORITY: Record<TicketPriority, number> = {
  critical: 4,
  high: 12,
  medium: 48,
  low: 120,
};

export function calculateSlaDeadline(
  createdAt: Date,
  priority: TicketPriority
): Date {
  const hours = SLA_HOURS_BY_PRIORITY[priority] ?? 48;
  return new Date(createdAt.getTime() + hours * 60 * 60 * 1000);
}

export function isTicketOverdue(
  status: TicketStatus,
  slaDeadline: Date | string | null,
  now: Date = new Date()
): boolean {
  if (status === 'resolved' || status === 'closed' || !slaDeadline) {
    return false;
  }
  const deadlineDate = typeof slaDeadline === 'string' ? new Date(slaDeadline) : slaDeadline;
  return deadlineDate.getTime() < now.getTime();
}

export interface AnalyticsTicketInput {
  buildingId: number;
  category: string;
  status: string;
  priority: string;
  createdAt: Date | string;
  completedAt: Date | string | null;
  slaDeadline: Date | string | null;
  laborCost: number;
  materialsCost: number;
}

export interface AnalyticsEmergencyInput {
  buildingId: number;
  systemType: string;
  status: string;
  damageCost: number;
  responseMinutes: number | null;
}

export interface AnalyticsMaintenanceInput {
  buildingId: number;
  status: string;
  estimatedCost: number;
}

export interface BuildingRiskSummary {
  buildingId: number;
  address: string;
  ticketsCount: number;
  openTicketsCount: number;
  emergenciesCount: number;
  overdueMaintenanceCount: number;
  totalCost: number;
  riskIndex: number;
}

export function computeBuildingRiskRanking(
  buildingsList: Array<{ id: number; address: string; conditionScore: number }>,
  ticketsList: AnalyticsTicketInput[],
  emergenciesList: AnalyticsEmergencyInput[],
  maintenanceList: AnalyticsMaintenanceInput[]
): BuildingRiskSummary[] {
  return buildingsList
    .map((b) => {
      const bTickets = ticketsList.filter((t) => t.buildingId === b.id);
      const openTickets = bTickets.filter(
        (t) => t.status !== 'resolved' && t.status !== 'closed'
      );
      const bEmergencies = emergenciesList.filter((e) => e.buildingId === b.id);
      const bMaint = maintenanceList.filter((m) => m.buildingId === b.id);
      const overdueMaint = bMaint.filter((m) => m.status === 'overdue');

      const ticketsCost = bTickets.reduce(
        (sum, t) => sum + Number(t.laborCost || 0) + Number(t.materialsCost || 0),
        0
      );
      const emergCost = bEmergencies.reduce(
        (sum, e) => sum + Number(e.damageCost || 0),
        0
      );
      const maintCost = bMaint
        .filter((m) => m.status === 'completed')
        .reduce((sum, m) => sum + Number(m.estimatedCost || 0), 0);

      // Composite risk score (0-100): higher means more problematic building
      const wearPenalty = Math.max(0, 100 - b.conditionScore) * 0.45;
      const emergencyPenalty = bEmergencies.length * 16;
      const openTicketPenalty = openTickets.length * 4.5;
      const overduePenalty = overdueMaint.length * 8;
      const riskIndex = Math.min(
        100,
        Math.round(wearPenalty + emergencyPenalty + openTicketPenalty + overduePenalty)
      );

      return {
        buildingId: b.id,
        address: b.address,
        ticketsCount: bTickets.length,
        openTicketsCount: openTickets.length,
        emergenciesCount: bEmergencies.length,
        overdueMaintenanceCount: overdueMaint.length,
        totalCost: Math.round(ticketsCost + emergCost + maintCost),
        riskIndex,
      };
    })
    .sort((a, b) => b.riskIndex - a.riskIndex);
}

export function computeSlaCompliancePercent(
  ticketsList: AnalyticsTicketInput[],
  now: Date = new Date()
): number {
  const evaluated = ticketsList.filter((t) => t.slaDeadline !== null);
  if (evaluated.length === 0) return 100;

  let onTime = 0;
  for (const t of evaluated) {
    const deadline = new Date(t.slaDeadline as string | Date).getTime();
    if (t.completedAt) {
      if (new Date(t.completedAt).getTime() <= deadline) onTime++;
    } else if (t.status !== 'resolved' && t.status !== 'closed') {
      if (now.getTime() <= deadline) onTime++;
    } else {
      onTime++;
    }
  }
  return Math.round((onTime / evaluated.length) * 100);
}

export function computeAverageResolutionHours(
  ticketsList: AnalyticsTicketInput[]
): number {
  const completed = ticketsList.filter((t) => t.completedAt !== null);
  if (completed.length === 0) return 0;

  const totalHours = completed.reduce((acc, t) => {
    const start = new Date(t.createdAt).getTime();
    const end = new Date(t.completedAt as string | Date).getTime();
    const diffHours = Math.max(0, (end - start) / (1000 * 60 * 60));
    return acc + diffHours;
  }, 0);

  return Math.round((totalHours / completed.length) * 10) / 10;
}

export function generateTicketNumber(sequenceNumber: number, year = 2026): string {
  const padded = String(sequenceNumber).padStart(4, '0');
  return `З-${year}-${padded}`;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Администратор',
  dispatcher: 'Диспетчер',
  specialist: 'Специалист',
  resident: 'Житель',
};

export const STATUS_LABELS: Record<TicketStatus, string> = {
  new: 'Новая',
  registered: 'Зарегистрирована',
  assigned: 'Назначена',
  in_progress: 'В работе',
  resolved: 'Выполнена',
  closed: 'Закрыта',
};

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: 'Низкий',
  medium: 'Средний',
  high: 'Высокий',
  critical: 'Критический',
};

export const CATEGORY_LABELS: Record<string, string> = {
  plumbing: 'Водоснабжение и сантехника',
  electricity: 'Электроснабжение',
  heating: 'Отопление и ИТП',
  elevator: 'Лифтовое хозяйство',
  cleaning: 'Санитарное содержание',
  roof_facade: 'Кровля и фасад',
  intercom: 'Домофон и СКУД',
  other: 'Прочие работы',
};

export const SYSTEM_TYPE_LABELS: Record<string, string> = {
  heating: 'Система отопления и ИТП',
  water_supply: 'ХВС / ГВС и канализация',
  electricity: 'Электроснабжение и ВРУ',
  elevator: 'Лифтовое оборудование',
  ventilation: 'Вентиляция и дымоудаление',
  roof_facade: 'Кровля и фасадные конструкции',
  gas: 'Газоснабжение',
};

export const CONDITION_LABELS: Record<string, string> = {
  excellent: 'Отличное',
  good: 'Хорошее',
  satisfactory: 'Удовлетворительное',
  needs_repair: 'Требует ремонта',
  normal: 'Исправно',
  wear: 'Повышенный износ',
  critical: 'Аварийное состояние',
};

export const MAINTENANCE_STATUS_LABELS: Record<string, string> = {
  planned: 'Запланировано',
  in_progress: 'Выполняется',
  completed: 'Выполнено',
  overdue: 'Просрочено',
};

export const EMERGENCY_STATUS_LABELS: Record<string, string> = {
  active: 'Активна',
  localized: 'Локализована',
  resolved: 'Ликвидирована',
};

export const FREQUENCY_LABELS: Record<string, string> = {
  monthly: 'Ежемесячно',
  quarterly: 'Ежеквартально',
  semiannual: 'Раз в полгода',
  annual: 'Ежегодно',
  once: 'Разово',
};

export const METER_TYPE_LABELS: Record<string, string> = {
  cold_water: 'Холодная вода (ХВС)',
  hot_water: 'Горячая вода (ГВС)',
  electricity: 'Электроэнергия',
};

export const METER_UNIT_LABELS: Record<string, string> = {
  cold_water: 'м³',
  hot_water: 'м³',
  electricity: 'кВт·ч',
};

export function computeBuildingConditionFromSystems(
  systems: Array<{ wearPercent: number; condition: string }>
): { conditionScore: number; conditionStatus: 'excellent' | 'good' | 'satisfactory' | 'needs_repair' } {
  if (systems.length === 0) {
    return { conditionScore: 85, conditionStatus: 'good' };
  }
  const avgWear =
    systems.reduce((sum, s) => sum + Math.max(0, Math.min(100, s.wearPercent)), 0) / systems.length;
  const criticalPenalty = systems.filter((s) => s.condition === 'critical').length * 6;
  const score = Math.max(10, Math.min(100, Math.round(100 - avgWear - criticalPenalty)));
  let status: 'excellent' | 'good' | 'satisfactory' | 'needs_repair' = 'good';
  if (score >= 88) status = 'excellent';
  else if (score >= 75) status = 'good';
  else if (score >= 60) status = 'satisfactory';
  else status = 'needs_repair';
  return { conditionScore: score, conditionStatus: status };
}

export function computeMeterConsumption(
  currentValue: number,
  previousValue: number | null
): { valid: boolean; consumption: number | null; error?: string } {
  if (!Number.isFinite(currentValue) || currentValue < 0) {
    return { valid: false, consumption: null, error: 'Показание должно быть неотрицательным числом' };
  }
  if (previousValue === null || previousValue === undefined) {
    return { valid: true, consumption: 0 };
  }
  if (currentValue < previousValue) {
    return {
      valid: false,
      consumption: null,
      error: `Новое показание (${currentValue}) не может быть меньше предыдущего (${previousValue})`,
    };
  }
  const diff = Math.round((currentValue - previousValue) * 100) / 100;
  return { valid: true, consumption: diff };
}

export interface BrigadeRatingSummary {
  brigadeId: number;
  brigadeName: string;
  ratedCount: number;
  avgRating: number;
  completedCount: number;
}

export function computeBrigadeRatings(
  brigadesList: Array<{ id: number; name: string }>,
  ticketsList: Array<{
    brigadeId: number | null;
    status: string;
    residentRating: number | null;
  }>
): BrigadeRatingSummary[] {
  return brigadesList
    .map((br) => {
      const brTickets = ticketsList.filter((t) => t.brigadeId === br.id);
      const completedCount = brTickets.filter(
        (t) => t.status === 'resolved' || t.status === 'closed'
      ).length;
      const rated = brTickets.filter(
        (t) => typeof t.residentRating === 'number' && t.residentRating >= 1 && t.residentRating <= 5
      );
      const avgRating =
        rated.length > 0
          ? Math.round(
              (rated.reduce((s, t) => s + Number(t.residentRating), 0) / rated.length) * 10
            ) / 10
          : 0;
      return {
        brigadeId: br.id,
        brigadeName: br.name,
        ratedCount: rated.length,
        avgRating,
        completedCount,
      };
    })
    .sort((a, b) => b.avgRating - a.avgRating || b.completedCount - a.completedCount);
}

export function formatRubles(amount: number | string): string {
  const value = typeof amount === 'string' ? Number(amount) : amount;
  if (Number.isNaN(value)) return '0 ₽';
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Math.round(value))} ₽`;
}

export function formatShortDate(dateValue: string | Date | null | undefined): string {
  if (!dateValue) return '—';
  const d = typeof dateValue === 'string' ? new Date(dateValue) : dateValue;
  if (Number.isNaN(d.getTime())) return String(dateValue);
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

export function formatDateTime(dateValue: string | Date | null | undefined): string {
  if (!dateValue) return '—';
  const d = typeof dateValue === 'string' ? new Date(dateValue) : dateValue;
  if (Number.isNaN(d.getTime())) return String(dateValue);
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}
