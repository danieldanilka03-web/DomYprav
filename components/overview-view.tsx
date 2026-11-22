'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpDown,
  Bell,
  Building2,
  Check,
  ClipboardList,
  Droplets,
  Flame,
  Megaphone,
  Package,
  Phone,
  Play,
  Plus,
  Users,
  Wrench,
  Zap,
} from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import {
  CATEGORY_LABELS,
  EMERGENCY_STATUS_LABELS,
  formatDateTime,
  formatRubles,
  formatShortDate,
  isTicketOverdue,
  MAINTENANCE_STATUS_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
  type TicketStatus,
} from '@/lib/operations-logic';
import type {
  AnalyticsPayload,
  BrigadeRecord,
  BuildingItem,
  EmergencyItem,
  MaintenancePlanItem,
  NotificationRecord,
  TicketItem,
  UserProfile,
  WarehouseItemRecord,
} from './types';

interface OverviewViewProps {
  user: UserProfile;
  buildings: BuildingItem[];
  tickets: TicketItem[];
  emergencies: EmergencyItem[];
  maintenancePlans: MaintenancePlanItem[];
  warehouseItems: WarehouseItemRecord[];
  brigades: BrigadeRecord[];
  notifications: NotificationRecord[];
  analytics: AnalyticsPayload | null;
  onNavigate: (tab: string) => void;
  onSelectTicket: (ticketId: number) => void;
  onOpenNewTicket: (category?: string) => void;
  onOpenNewEmergency: () => void;
  onOpenNewNotification: () => void;
  onRefresh: () => Promise<void>;
}

const RESIDENT_QUICK_CATEGORIES = [
  { id: 'plumbing', label: 'Сантехника', hint: 'Течь, напор, канализация', icon: Droplets },
  { id: 'electricity', label: 'Электрика', hint: 'Свет, щиток, розетки', icon: Zap },
  { id: 'heating', label: 'Отопление', hint: 'Батареи, стояки, ИТП', icon: Flame },
  { id: 'elevator', label: 'Лифт и подъезд', hint: 'Лифт, домофон, уборка', icon: ArrowUpDown },
];

function getResidentStepIndex(status: TicketStatus): number {
  if (status === 'new' || status === 'registered') return 0;
  if (status === 'assigned') return 1;
  if (status === 'in_progress') return 2;
  return 3;
}

const RESIDENT_STEPS = ['Принята', 'Назначена', 'В работе', 'Выполнена'];

export function OverviewView(props: OverviewViewProps) {
  if (props.user.role === 'resident') return <ResidentOverview {...props} />;
  if (props.user.role === 'dispatcher') return <DispatcherOverview {...props} />;
  if (props.user.role === 'specialist') return <SpecialistOverview {...props} />;
  return <AdminOverview {...props} />;
}

/* ============================================================================
 * 1. ЖИТЕЛЬ — Личный кабинет жителя
 * ========================================================================== */
function ResidentOverview({
  user,
  buildings,
  tickets,
  maintenancePlans,
  notifications,
  onNavigate,
  onSelectTicket,
  onOpenNewTicket,
}: OverviewViewProps) {
  const myBuilding = user.buildingId
    ? buildings.find((b) => b.id === user.buildingId) ?? null
    : null;

  const activeTickets = tickets.filter((t) => t.status !== 'resolved' && t.status !== 'closed');
  const completedTickets = tickets.filter((t) => t.status === 'resolved' || t.status === 'closed');

  const houseMaintenance = maintenancePlans
    .filter(
      (m) =>
        m.status !== 'completed' &&
        (!user.buildingId || m.buildingId === user.buildingId)
    )
    .slice(0, 4);

  const recentNotifications = notifications.slice(0, 4);

  return (
    <div className="space-y-7">
      {/* Resident Home Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {myBuilding ? myBuilding.address : 'Личный кабинет'}
            {user.apartmentNumber ? `, кв. ${user.apartmentNumber}` : ''}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-slate-600">
            <span>{user.fullName}</span>
            {myBuilding && (
              <>
                <span className="text-slate-300">·</span>
                <span>
                  Техсостояние дома:{' '}
                  <strong className="font-mono tabular-nums text-slate-900">
                    {myBuilding.conditionScore}%
                  </strong>
                </span>
                <span className="text-slate-300">·</span>
                <button
                  type="button"
                  onClick={() => onNavigate('buildings')}
                  className="text-blue-700 hover:underline font-medium"
                >
                  Паспорт дома
                </button>
              </>
            )}
            <span className="text-slate-300">·</span>
            <button
              type="button"
              onClick={() => onNavigate('meters')}
              className="text-blue-700 hover:underline font-medium"
            >
              Показания счётчиков
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onOpenNewTicket()}
          className="px-4 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Подать заявку</span>
        </button>
      </div>

      {/* Quick Category Launchers */}
      <section>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Быстрая подача заявки</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {RESIDENT_QUICK_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => onOpenNewTicket(cat.id)}
                className="text-left bg-white border border-slate-200 hover:border-blue-400 hover:bg-blue-50/20 rounded-xl p-4 transition-colors flex items-start gap-3.5 group"
              >
                <div className="w-9 h-9 rounded-lg bg-slate-100 group-hover:bg-blue-100 flex items-center justify-center shrink-0 transition-colors">
                  <Icon className="w-4 h-4 text-slate-700 group-hover:text-blue-700" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900 group-hover:text-blue-800">
                    {cat.label}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">{cat.hint}</div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Active Requests with Visual Step Progress */}
        <section className="xl:col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-slate-500" aria-hidden="true" />
              <h2 className="text-base font-semibold text-slate-900">
                Активные обращения ({activeTickets.length})
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('tickets')}
              className="text-xs font-semibold text-blue-700 hover:text-blue-900 flex items-center gap-1 whitespace-nowrap"
            >
              <span>Все заявки ({tickets.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {activeTickets.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-slate-600">Сейчас нет активных заявок.</p>
              {completedTickets.length > 0 && (
                <p className="text-xs text-slate-500 mt-1">
                  Выполнено ранее: {completedTickets.length}
                </p>
              )}
              <button
                type="button"
                onClick={() => onOpenNewTicket()}
                className="mt-4 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium rounded-lg"
              >
                Создать обращение
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {activeTickets.slice(0, 5).map((t) => {
                const step = getResidentStepIndex(t.status);
                return (
                  <div key={t.id} className="p-5 hover:bg-slate-50/70 transition-colors">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => onSelectTicket(t.id)}
                        className="text-left group min-w-0 flex-1"
                      >
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-mono tabular-nums font-semibold text-blue-700">
                            {t.ticketNumber}
                          </span>
                          <span className="text-slate-400">·</span>
                          <span className="text-slate-500">
                            {CATEGORY_LABELS[t.category] || t.category}
                          </span>
                        </div>
                        <div className="mt-1 text-base font-semibold text-slate-900 group-hover:text-blue-700">
                          {t.title}
                        </div>
                      </button>
                      <div className="text-right text-xs shrink-0">
                        <div className="font-semibold text-blue-700">{STATUS_LABELS[t.status]}</div>
                        {t.slaDeadline && (
                          <div className="text-slate-500 font-mono tabular-nums mt-0.5">
                            до {formatShortDate(t.slaDeadline)}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 4-step Progress Bar */}
                    <div className="mt-4 grid grid-cols-4 gap-2">
                      {RESIDENT_STEPS.map((label, idx) => (
                        <div key={label}>
                          <div
                            className={`h-1.5 rounded-full ${
                              idx <= step ? 'bg-blue-600' : 'bg-slate-200'
                            }`}
                          />
                          <div
                            className={`mt-1 text-[11px] ${
                              idx <= step ? 'text-slate-800 font-medium' : 'text-slate-400'
                            }`}
                          >
                            {label}
                          </div>
                        </div>
                      ))}
                    </div>

                    {(t.assigneeName || t.brigadeName) && (
                      <div className="mt-3 text-xs text-slate-600">
                        Исполнитель: <strong className="font-medium text-slate-900">{t.assigneeName || t.brigadeName}</strong>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Right Column: House Announcements + Planned House Works */}
        <div className="space-y-6">
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-slate-500" aria-hidden="true" />
                <h2 className="text-base font-semibold text-slate-900">Объявления по дому</h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('notifications')}
                className="text-xs font-semibold text-blue-700 hover:text-blue-900"
              >
                Все
              </button>
            </div>
            <div className="divide-y divide-slate-200">
              {recentNotifications.length === 0 ? (
                <p className="p-5 text-sm text-slate-500">Новых объявлений нет.</p>
              ) : (
                recentNotifications.map((n) => (
                  <div
                    key={n.id}
                    className={`px-5 py-3.5 ${n.isRead ? '' : 'bg-blue-50/35'}`}
                  >
                    <div className="text-sm font-medium text-slate-900">{n.title}</div>
                    <p className="text-xs text-slate-600 mt-1 line-clamp-2">{n.message}</p>
                    <div className="text-[11px] font-mono tabular-nums text-slate-400 mt-1.5">
                      {formatDateTime(n.createdAt)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wrench className="w-4 h-4 text-slate-500" aria-hidden="true" />
                <h2 className="text-base font-semibold text-slate-900">Плановые работы</h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('buildings')}
                className="text-xs font-semibold text-blue-700 hover:text-blue-900"
              >
                Мой дом
              </button>
            </div>
            <div className="divide-y divide-slate-200">
              {houseMaintenance.length === 0 ? (
                <p className="p-5 text-sm text-slate-500">Ближайших работ не запланировано.</p>
              ) : (
                houseMaintenance.map((m) => (
                  <div key={m.id} className="px-5 py-3.5">
                    <div className="text-sm font-medium text-slate-900">{m.title}</div>
                    <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                      <span className="font-mono tabular-nums">{formatShortDate(m.scheduledDate)}</span>
                      <span>{MAINTENANCE_STATUS_LABELS[m.status]}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
 * 2. ДИСПЕТЧЕР — Диспетчерская смена
 * ========================================================================== */
function DispatcherOverview({
  tickets,
  emergencies,
  brigades,
  onNavigate,
  onSelectTicket,
  onOpenNewEmergency,
  onOpenNewNotification,
}: OverviewViewProps) {
  const openTickets = tickets.filter((t) => t.status !== 'resolved' && t.status !== 'closed');
  const needsTriage = openTickets.filter(
    (t) => t.status === 'new' || t.status === 'registered' || (!t.assigneeId && !t.brigadeId)
  );
  const overdueTickets = openTickets.filter((t) => isTicketOverdue(t.status, t.slaDeadline));
  const activeEmergencies = emergencies.filter((e) => e.status !== 'resolved');

  return (
    <div className="space-y-6">
      {/* Shift Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Диспетчерская</h1>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenNewNotification}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Megaphone className="w-3.5 h-3.5 text-slate-600" />
            <span>Оповестить жителей</span>
          </button>
          <button
            type="button"
            onClick={onOpenNewEmergency}
            className="px-3.5 py-2 bg-red-700 hover:bg-red-800 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Зафиксировать аварию</span>
          </button>
        </div>
      </div>

      {/* Shift KPIs */}
      <div className="bg-white border border-slate-200 rounded-xl grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">Ждут распределения</div>
          <div className="mt-1.5 text-3xl font-bold font-mono tabular-nums text-blue-700">
            {needsTriage.length}
          </div>
        </div>
        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">Всего в работе</div>
          <div className="mt-1.5 text-3xl font-bold font-mono tabular-nums text-slate-900">
            {openTickets.length}
          </div>
        </div>
        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">Просрочено по SLA</div>
          <div
            className={`mt-1.5 text-3xl font-bold font-mono tabular-nums ${
              overdueTickets.length > 0 ? 'text-red-700' : 'text-emerald-700'
            }`}
          >
            {overdueTickets.length}
          </div>
        </div>
        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">Активные аварии</div>
          <div
            className={`mt-1.5 text-3xl font-bold font-mono tabular-nums ${
              activeEmergencies.length > 0 ? 'text-red-700' : 'text-slate-900'
            }`}
          >
            {activeEmergencies.length}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Triage Queue */}
        <section className="xl:col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">
              Требуют распределения ({needsTriage.length})
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('tickets')}
              className="text-xs font-semibold text-blue-700 hover:text-blue-900 flex items-center gap-1"
            >
              <span>Все заявки</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {needsTriage.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">
              Все поступившие обращения распределены между исполнителями.
            </p>
          ) : (
            <div className="divide-y divide-slate-200">
              {needsTriage.map((t) => (
                <div
                  key={t.id}
                  className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-mono tabular-nums font-semibold text-blue-700">
                        {t.ticketNumber}
                      </span>
                      <span
                        className={`font-semibold ${
                          t.priority === 'critical' || t.priority === 'high'
                            ? 'text-red-700'
                            : 'text-slate-600'
                        }`}
                      >
                        {PRIORITY_LABELS[t.priority]}
                      </span>
                      <span className="text-slate-400">·</span>
                      <span className="text-slate-500 font-mono tabular-nums">
                        {formatDateTime(t.createdAt)}
                      </span>
                    </div>
                    <div className="mt-1 text-sm font-semibold text-slate-900">{t.title}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {t.buildingAddress}
                      {t.apartmentNumber ? `, кв. ${t.apartmentNumber}` : ''} · {t.authorName}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectTicket(t.id)}
                    className="px-3.5 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 self-start sm:self-center"
                  >
                    Назначить
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Right Rail: Brigade Workload + Active Emergencies */}
        <div className="space-y-6">
          {activeEmergencies.length > 0 && (
            <section className="bg-red-50/70 border border-red-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-red-200 flex items-center justify-between">
                <span className="text-sm font-semibold text-red-900">Активные аварии</span>
                <button
                  type="button"
                  onClick={() => onNavigate('emergencies')}
                  className="text-xs font-semibold text-red-800 hover:underline"
                >
                  Журнал
                </button>
              </div>
              <div className="divide-y divide-red-200/70">
                {activeEmergencies.map((em) => (
                  <div key={em.id} className="px-5 py-3.5">
                    <div className="text-sm font-semibold text-red-950">{em.title}</div>
                    <div className="text-xs text-red-800 mt-0.5">
                      {em.buildingAddress} · {EMERGENCY_STATUS_LABELS[em.status]}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-500" aria-hidden="true" />
                <h2 className="text-base font-semibold text-slate-900">Загрузка бригад</h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('staff')}
                className="text-xs font-semibold text-blue-700 hover:text-blue-900"
              >
                Все
              </button>
            </div>
            <div className="divide-y divide-slate-200">
              {brigades.map((br) => {
                const activeCount = openTickets.filter((t) => t.brigadeId === br.id).length;
                return (
                  <div key={br.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-900 truncate">{br.name}</div>
                      <div className="text-xs text-slate-600 mt-0.5 truncate">{br.leaderName}</div>
                      {br.phone && (
                        <div className="text-xs text-slate-500 font-mono tabular-nums inline-flex items-center gap-1 mt-0.5 whitespace-nowrap">
                          <Phone className="w-3 h-3 shrink-0" />
                          <span>{br.phone}</span>
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <span
                        className={`text-sm font-bold font-mono tabular-nums ${
                          activeCount >= 3 ? 'text-amber-700' : 'text-slate-900'
                        }`}
                      >
                        {activeCount}
                      </span>
                      <div className="text-[11px] text-slate-400">заявок</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
 * 3. СПЕЦИАЛИСТ — Рабочее место мастера / исполнителя
 * ========================================================================== */
function SpecialistOverview({
  user,
  tickets,
  maintenancePlans,
  warehouseItems,
  brigades,
  onNavigate,
  onSelectTicket,
  onRefresh,
}: OverviewViewProps) {
  const [busyId, setBusyId] = useState<number | null>(null);
  const [busyMaintId, setBusyMaintId] = useState<number | null>(null);

  const myBrigade = user.brigadeId
    ? brigades.find((b) => b.id === user.brigadeId) ?? null
    : null;

  const openTickets = tickets.filter((t) => t.status !== 'resolved' && t.status !== 'closed');
  const myTickets = openTickets.filter(
    (t) => t.assigneeId === user.id || (user.brigadeId && t.brigadeId === user.brigadeId)
  );
  const inProgressCount = myTickets.filter((t) => t.status === 'in_progress').length;
  const urgentCount = myTickets.filter(
    (t) => t.priority === 'critical' || t.priority === 'high' || isTicketOverdue(t.status, t.slaDeadline)
  ).length;

  const myMaintenance = maintenancePlans
    .filter(
      (m) =>
        m.status !== 'completed' &&
        (!user.brigadeId || m.brigadeId === user.brigadeId)
    )
    .slice(0, 4);

  const lowStock = warehouseItems.filter((w) => w.isLowStock).slice(0, 4);

  async function takeIntoWork(ticketId: number) {
    setBusyId(ticketId);
    try {
      await apiFetch(`/api/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'in_progress' }),
      });
      await onRefresh();
    } finally {
      setBusyId(null);
    }
  }

  async function updateMaintenance(id: number, status: 'in_progress' | 'completed') {
    setBusyMaintId(id);
    try {
      await apiFetch('/api/maintenance', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      await onRefresh();
    } finally {
      setBusyMaintId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Мои задачи</h1>
          {(user.position || myBrigade) && (
            <p className="text-sm text-slate-600 mt-1">
              {[user.position, myBrigade?.name].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => onNavigate('tickets')}
          className="text-sm font-semibold text-blue-700 hover:text-blue-900 inline-flex items-center gap-1 self-start sm:self-auto"
        >
          <span>Все наряды</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Specialist KPI Strip */}
      <div className="bg-white border border-slate-200 rounded-xl grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">Назначено на смену</div>
          <div className="mt-1.5 text-3xl font-bold font-mono tabular-nums text-slate-900">
            {myTickets.length}
          </div>
        </div>
        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">Выполняется сейчас</div>
          <div className="mt-1.5 text-3xl font-bold font-mono tabular-nums text-blue-700">
            {inProgressCount}
          </div>
        </div>
        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">Срочные / просрочка</div>
          <div
            className={`mt-1.5 text-3xl font-bold font-mono tabular-nums ${
              urgentCount > 0 ? 'text-red-700' : 'text-emerald-700'
            }`}
          >
            {urgentCount}
          </div>
        </div>
        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">Плановое ТО бригады</div>
          <div className="mt-1.5 text-3xl font-bold font-mono tabular-nums text-slate-900">
            {myMaintenance.length}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Direct Action Work Orders */}
        <section className="xl:col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Текущие наряды</h2>
            <span className="text-xs font-mono tabular-nums text-slate-500">
              {myTickets.length} акт.
            </span>
          </div>

          {myTickets.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">
              Активных нарядов, назначенных на вас или вашу бригаду, нет.
            </p>
          ) : (
            <div className="divide-y divide-slate-200">
              {myTickets.map((t) => {
                const overdue = isTicketOverdue(t.status, t.slaDeadline);
                const canStartNow = t.status === 'assigned' || t.status === 'registered';
                return (
                  <div
                    key={t.id}
                    className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/70"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => onSelectTicket(t.id)}
                          className="font-mono tabular-nums font-semibold text-blue-700 hover:underline"
                        >
                          {t.ticketNumber}
                        </button>
                        <span
                          className={`font-semibold ${
                            t.priority === 'critical' || t.priority === 'high'
                              ? 'text-red-700'
                              : 'text-slate-600'
                          }`}
                        >
                          {PRIORITY_LABELS[t.priority]}
                        </span>
                        <span className="text-slate-400">·</span>
                        <span className={overdue ? 'text-red-700 font-semibold' : 'text-slate-600'}>
                          {STATUS_LABELS[t.status]}
                          {overdue ? ' (просрочена)' : ''}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onSelectTicket(t.id)}
                        className="mt-1 text-left text-base font-semibold text-slate-900 hover:text-blue-700 block"
                      >
                        {t.title}
                      </button>
                      <div className="text-xs text-slate-600 mt-1">
                        {t.buildingAddress}
                        {t.apartmentNumber ? `, кв. ${t.apartmentNumber}` : ''}
                        {t.slaDeadline ? ` · SLA до ${formatDateTime(t.slaDeadline)}` : ''}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {canStartNow ? (
                        <button
                          type="button"
                          disabled={busyId === t.id}
                          onClick={() => void takeIntoWork(t.id)}
                          className="px-3.5 py-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span>Взять в работу</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onSelectTicket(t.id)}
                          className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg whitespace-nowrap"
                        >
                          Материалы и отчёт
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Right Rail: Brigade Maintenance + Low Stock */}
        <div className="space-y-6">
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">ТО бригады</h2>
              <button
                type="button"
                onClick={() => onNavigate('maintenance')}
                className="text-xs font-semibold text-blue-700 hover:text-blue-900"
              >
                График
              </button>
            </div>
            <div className="divide-y divide-slate-200">
              {myMaintenance.length === 0 ? (
                <p className="p-5 text-sm text-slate-500">Запланированных работ ТО нет.</p>
              ) : (
                myMaintenance.map((m) => (
                  <div key={m.id} className="px-5 py-3.5 space-y-2">
                    <div className="text-sm font-medium text-slate-900">{m.title}</div>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span className="truncate">{m.buildingAddress}</span>
                      <span className="font-mono tabular-nums shrink-0">
                        {formatShortDate(m.scheduledDate)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs font-medium text-slate-600">
                        {MAINTENANCE_STATUS_LABELS[m.status]}
                      </span>
                      {m.status === 'planned' || m.status === 'overdue' ? (
                        <button
                          type="button"
                          disabled={busyMaintId === m.id}
                          onClick={() => void updateMaintenance(m.id, 'in_progress')}
                          className="text-xs font-semibold text-blue-700 hover:underline inline-flex items-center gap-1"
                        >
                          <Play className="w-3 h-3" />
                          <span>Начать</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busyMaintId === m.id}
                          onClick={() => void updateMaintenance(m.id, 'completed')}
                          className="text-xs font-semibold text-emerald-700 hover:underline inline-flex items-center gap-1"
                        >
                          <Check className="w-3 h-3" />
                          <span>Завершить</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-slate-500" aria-hidden="true" />
                <h2 className="text-base font-semibold text-slate-900">Мало на складе</h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('warehouse')}
                className="text-xs font-semibold text-blue-700 hover:text-blue-900"
              >
                Склад
              </button>
            </div>
            <div className="divide-y divide-slate-200">
              {lowStock.length === 0 ? (
                <p className="p-5 text-sm text-slate-500">Запасы материалов в норме.</p>
              ) : (
                lowStock.map((item) => (
                  <div key={item.id} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-900 truncate">{item.name}</div>
                      <div className="text-xs text-slate-500 font-mono">{item.location}</div>
                    </div>
                    <div className="text-sm font-mono tabular-nums font-semibold text-red-700 shrink-0">
                      {item.quantity} {item.unit}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
 * 4. АДМИНИСТРАТОР — Управленческий обзор
 * ========================================================================== */
function AdminOverview({
  buildings,
  tickets,
  emergencies,
  maintenancePlans,
  warehouseItems,
  analytics,
  onNavigate,
  onSelectTicket,
}: OverviewViewProps) {
  const openTickets = tickets.filter((t) => t.status !== 'resolved' && t.status !== 'closed');
  const overdueTickets = openTickets.filter((t) => isTicketOverdue(t.status, t.slaDeadline));
  const activeEmergencies = emergencies.filter((e) => e.status !== 'resolved');
  const lowStockItems = warehouseItems.filter((w) => w.isLowStock);
  const upcomingMaintenance = maintenancePlans
    .filter((m) => m.status !== 'completed')
    .slice(0, 4);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Обзор управления</h1>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => onNavigate('staff')}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg whitespace-nowrap"
          >
            Сотрудники и роли
          </button>
          <button
            type="button"
            onClick={() => onNavigate('analytics')}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg whitespace-nowrap"
          >
            Аналитика и отчёт
          </button>
        </div>
      </div>

      {activeEmergencies.length > 0 && (
        <div className="bg-red-50/70 border border-red-200 rounded-xl px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-700 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <div className="text-sm font-semibold text-red-900">
                Активные аварии: {activeEmergencies.length}
              </div>
              <p className="text-xs text-red-800 mt-0.5">
                {activeEmergencies[0].buildingAddress} — {activeEmergencies[0].title} (
                {EMERGENCY_STATUS_LABELS[activeEmergencies[0].status]})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('emergencies')}
            className="text-xs font-semibold text-red-800 hover:text-red-950 flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <span>Журнал аварий</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Executive KPI Strip */}
      <div className="bg-white border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">Заявки в работе</div>
          <div className="mt-2 flex items-baseline gap-3">
            <span className="text-3xl font-bold font-mono tabular-nums text-slate-900">
              {openTickets.length}
            </span>
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              из {tickets.length}
            </span>
          </div>
          <div className="mt-2 text-xs">
            {overdueTickets.length > 0 ? (
              <span className="text-red-700 font-medium">
                Просрочено по SLA: {overdueTickets.length}
              </span>
            ) : (
              <span className="text-emerald-700 font-medium">Без просрочек SLA</span>
            )}
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">Соблюдение SLA</div>
          <div className="mt-2 flex items-baseline gap-3">
            <span className="text-3xl font-bold font-mono tabular-nums text-slate-900">
              {analytics ? `${analytics.kpis.slaCompliancePercent}%` : '—'}
            </span>
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              {analytics ? `~${analytics.kpis.avgResolutionHours} ч` : ''}
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Среднее время устранения
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">Затраты эксплуатации</div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900">
            {analytics ? formatRubles(analytics.kpis.totalOperationalExpenses) : '—'}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Домов в управлении: {buildings.length}
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">Склад материалов</div>
          <div className="mt-2 flex items-baseline gap-3">
            <span className="text-3xl font-bold font-mono tabular-nums text-slate-900">
              {warehouseItems.length}
            </span>
            <span className="text-xs text-slate-500">позиций</span>
          </div>
          <div className="mt-2 text-xs">
            {lowStockItems.length > 0 ? (
              <span className="text-red-700 font-medium">
                Ниже минимума: {lowStockItems.length}
              </span>
            ) : (
              <span className="text-emerald-700 font-medium">Остатки в норме</span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          {/* Risk Buildings Table */}
          {analytics && analytics.buildingRanking.length > 0 && (
            <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-slate-500" aria-hidden="true" />
                  <h2 className="text-base font-semibold text-slate-900">Состояние жилого фонда</h2>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('buildings')}
                  className="text-xs font-semibold text-blue-700 hover:text-blue-900 flex items-center gap-1"
                >
                  <span>Реестр домов</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                      <th className="py-2.5 px-4">Адрес</th>
                      <th className="py-2.5 px-4 text-right">Состояние</th>
                      <th className="py-2.5 px-4 text-right">Заявки</th>
                      <th className="py-2.5 px-4 text-right">Аварии</th>
                      <th className="py-2.5 px-4 text-right">Риск</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-sm">
                    {analytics.buildingRanking.map((b) => {
                      const matched = buildings.find((item) => item.id === b.buildingId);
                      return (
                        <tr key={b.buildingId} className="hover:bg-slate-50">
                          <td className="py-3 px-4 font-medium text-slate-900">{b.address}</td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-slate-700">
                            {matched ? `${matched.conditionScore}%` : '—'}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-slate-700">
                            {b.ticketsCount}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-slate-700">
                            {b.emergenciesCount}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-xs font-semibold">
                            <span
                              className={
                                b.riskIndex >= 60
                                  ? 'text-red-700'
                                  : b.riskIndex >= 35
                                    ? 'text-amber-700'
                                    : 'text-emerald-700'
                              }
                            >
                              {b.riskIndex}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Recent Tickets */}
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Последние заявки</h2>
              <button
                type="button"
                onClick={() => onNavigate('tickets')}
                className="text-xs font-semibold text-blue-700 hover:text-blue-900 flex items-center gap-1"
              >
                <span>Все заявки</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse table-fixed">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                    <th className="py-2.5 px-4 w-32">Номер / Дата</th>
                    <th className="py-2.5 px-4">Объект и суть</th>
                    <th className="py-2.5 px-4 w-24">Приоритет</th>
                    <th className="py-2.5 px-4 w-36 text-right">Статус</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {tickets.slice(0, 5).map((t) => {
                    const overdue = isTicketOverdue(t.status, t.slaDeadline);
                    return (
                      <tr key={t.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 align-top">
                          <button
                            type="button"
                            onClick={() => onSelectTicket(t.id)}
                            className="font-mono tabular-nums text-xs font-semibold text-blue-700 hover:underline block"
                          >
                            {t.ticketNumber}
                          </button>
                          <div className="font-mono tabular-nums text-[11px] text-slate-400 mt-0.5">
                            {formatShortDate(t.createdAt)}
                          </div>
                        </td>
                        <td className="py-3 px-4 align-top">
                          <button
                            type="button"
                            onClick={() => onSelectTicket(t.id)}
                            className="text-left block w-full group"
                          >
                            <div className="font-medium text-slate-900 group-hover:text-blue-700 truncate">
                              {t.title}
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5 truncate">
                              {t.buildingAddress}
                              {t.apartmentNumber ? `, кв. ${t.apartmentNumber}` : ''}
                            </div>
                          </button>
                        </td>
                        <td className="py-3 px-4 align-top whitespace-nowrap text-xs font-medium">
                          <span
                            className={
                              t.priority === 'critical' || t.priority === 'high'
                                ? 'text-red-700'
                                : t.priority === 'medium'
                                  ? 'text-amber-700'
                                  : 'text-slate-600'
                            }
                          >
                            {PRIORITY_LABELS[t.priority]}
                          </span>
                        </td>
                        <td className="py-3 px-4 align-top text-right whitespace-nowrap text-xs font-medium">
                          <span
                            className={
                              overdue
                                ? 'text-red-700'
                                : t.status === 'resolved' || t.status === 'closed'
                                  ? 'text-emerald-700'
                                  : t.status === 'in_progress'
                                    ? 'text-blue-700'
                                    : 'text-slate-700'
                            }
                          >
                            {STATUS_LABELS[t.status]}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* Right Rail: Maintenance + Low Stock */}
        <div className="space-y-6">
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Ближайшее ТО</h2>
              <button
                type="button"
                onClick={() => onNavigate('maintenance')}
                className="text-xs font-semibold text-blue-700 hover:text-blue-900"
              >
                График
              </button>
            </div>
            <div className="divide-y divide-slate-200">
              {upcomingMaintenance.length === 0 ? (
                <p className="p-5 text-sm text-slate-500">Запланированных работ нет.</p>
              ) : (
                upcomingMaintenance.map((m) => (
                  <div key={m.id} className="px-5 py-3.5">
                    <div className="text-sm font-medium text-slate-900">{m.title}</div>
                    <div className="mt-1 flex items-center justify-between gap-2 text-xs text-slate-500">
                      <span className="truncate">{m.buildingAddress}</span>
                      <span
                        className={`font-mono tabular-nums shrink-0 font-medium ${
                          m.status === 'overdue' ? 'text-red-700' : 'text-slate-600'
                        }`}
                      >
                        {formatShortDate(m.scheduledDate)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Дефицит на складе</h2>
              <button
                type="button"
                onClick={() => onNavigate('warehouse')}
                className="text-xs font-semibold text-blue-700 hover:text-blue-900"
              >
                Склад
              </button>
            </div>
            <div className="divide-y divide-slate-200">
              {lowStockItems.length === 0 ? (
                <p className="p-5 text-sm text-slate-500">Все позиции выше минимума.</p>
              ) : (
                lowStockItems.map((item) => (
                  <div key={item.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-900 truncate">{item.name}</div>
                      <div className="text-xs text-slate-500 font-mono">{item.sku}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-mono tabular-nums font-semibold text-red-700">
                        {item.quantity} {item.unit}
                      </div>
                      <div className="text-xs text-slate-500 font-mono tabular-nums">
                        мин. {item.minQuantity}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
