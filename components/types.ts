import type { TicketPriority, TicketStatus, UserRole } from '@/lib/operations-logic';

export interface UserProfile {
  id: number;
  uid: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: UserRole;
  position: string | null;
  brigadeId: number | null;
  buildingId: number | null;
  apartmentNumber: string | null;
  isActive: boolean;
}

export interface BuildingShort {
  id: number;
  address: string;
  district: string;
}

export interface BuildingItem {
  id: number;
  address: string;
  district: string;
  yearBuilt: number;
  floors: number;
  entrances: number;
  totalAreaSqm: number;
  apartmentsCount: number;
  conditionScore: number;
  conditionStatus: string;
  managementSince: string;
  imageKey: string;
  notes: string | null;
  stats: {
    totalTickets: number;
    openTickets: number;
    activeEmergencies: number;
    systemsCount: number;
    criticalSystems: number;
    plannedMaintenance: number;
    registeredUnits: number;
  };
}

export interface ApartmentItem {
  id: number;
  buildingId: number;
  number: string;
  entrance: number;
  floor: number;
  areaSqm: number;
  unitType: string;
  ownerName: string;
  ownerPhone: string | null;
  residentsCount: number;
}

export interface EngineeringSystemItem {
  id: number;
  buildingId: number;
  systemType: string;
  name: string;
  condition: string;
  wearPercent: number;
  lastInspectionDate: string;
  nextInspectionDate: string;
  notes: string | null;
}

export interface TicketMaterialUsage {
  id: number;
  itemId: number;
  sku?: string;
  itemName: string;
  unit: string;
  quantityUsed: number;
  unitPriceAtUse: number;
  lineTotal: number;
}

export interface TicketItem {
  id: number;
  ticketNumber: string;
  buildingId: number;
  buildingAddress: string;
  apartmentNumber: string | null;
  category: string;
  title: string;
  description: string;
  photoData: string | null;
  priority: TicketPriority;
  status: TicketStatus;
  authorId: number | null;
  authorName: string;
  dispatcherId: number | null;
  dispatcherName: string | null;
  assigneeId: number | null;
  assigneeName: string | null;
  brigadeId: number | null;
  brigadeName: string | null;
  slaDeadline: string | null;
  startedAt: string | null;
  completedAt: string | null;
  resolutionNotes: string | null;
  afterPhotoData: string | null;
  residentRating: number | null;
  residentFeedback: string | null;
  laborCost: number;
  materialsCost: number;
  totalCost: number;
  createdAt: string;
  updatedAt: string;
  materials?: TicketMaterialUsage[];
}

export interface TicketHistoryEntry {
  id: number;
  ticketId: number;
  actorId: number | null;
  actorName: string;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  comment: string | null;
  createdAt: string;
}

export interface TicketCommentEntry {
  id: number;
  ticketId: number;
  authorId: number | null;
  authorName: string;
  authorRole: UserRole;
  message: string;
  createdAt: string;
}

export interface MeterReadingRecord {
  id: number;
  userId: number | null;
  buildingId: number;
  buildingAddress: string;
  apartmentNumber: string;
  residentName: string;
  meterType: 'cold_water' | 'hot_water' | 'electricity';
  period: string;
  value: number;
  previousValue: number | null;
  consumption: number | null;
  submittedAt: string;
}

export interface MaintenancePlanItem {
  id: number;
  buildingId: number;
  buildingAddress: string;
  systemId: number | null;
  systemName: string | null;
  title: string;
  description: string;
  frequency: string;
  scheduledDate: string;
  completedDate: string | null;
  status: string;
  brigadeId: number | null;
  brigadeName: string | null;
  estimatedCost: number;
}

export interface EmergencyItem {
  id: number;
  buildingId: number;
  buildingAddress: string;
  systemType: string;
  severity: string;
  title: string;
  description: string;
  affectedApartments: string;
  status: string;
  brigadeId: number | null;
  brigadeName: string | null;
  reportedAt: string;
  localizedAt: string | null;
  resolvedAt: string | null;
  responseMinutes: number | null;
  damageCost: number;
  rootCause: string | null;
}

export interface WarehouseItemRecord {
  id: number;
  sku: string;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  minQuantity: number;
  unitPrice: number;
  totalValue: number;
  isLowStock: boolean;
  location: string;
  updatedAt: string;
}

export interface BrigadeRecord {
  id: number;
  name: string;
  specialization: string;
  leaderName: string;
  phone: string;
  status: string;
  membersCount: number;
}

export interface StaffUserRecord {
  id: number;
  email: string;
  fullName: string;
  phone: string | null;
  role: UserRole;
  position: string | null;
  brigadeId: number | null;
  brigadeName: string | null;
  buildingId: number | null;
  buildingAddress: string | null;
  apartmentNumber: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface NotificationRecord {
  id: number;
  userId: number | null;
  targetRole: string | null;
  buildingId: number | null;
  buildingAddress: string | null;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface AnalyticsPayload {
  kpis: {
    buildingsCount: number;
    totalTickets: number;
    openTickets: number;
    slaCompliancePercent: number;
    avgResolutionHours: number;
    activeEmergencies: number;
    totalEmergencies: number;
    avgEmergencyResponseMinutes: number;
    overdueMaintenance: number;
    lowStockItemsCount: number;
    warehouseTotalValue: number;
    totalOperationalExpenses: number;
    avgResidentRating: number;
    ratedTicketsCount: number;
  };
  ticketsByCategory: Array<{ key: string; name: string; count: number }>;
  ticketsByStatus: Array<{ key: string; name: string; count: number }>;
  expensesBreakdown: Array<{ name: string; value: number }>;
  buildingRanking: Array<{
    buildingId: number;
    address: string;
    ticketsCount: number;
    openTicketsCount: number;
    emergenciesCount: number;
    overdueMaintenanceCount: number;
    totalCost: number;
    riskIndex: number;
  }>;
  problemSystems: Array<{
    systemType: string;
    name: string;
    avgWearPercent: number;
    criticalCount: number;
    emergencyCount: number;
  }>;
  brigadeRatings?: Array<{
    brigadeId: number;
    brigadeName: string;
    ratedCount: number;
    avgRating: number;
    completedCount: number;
  }>;
}
