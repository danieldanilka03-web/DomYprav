'use client';

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Building2,
  ClipboardList,
  Gauge,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Plus,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { apiFetch, clearClientSessionToken } from '@/lib/api-client';
import { canPerformAction, ROLE_LABELS, type UserRole } from '@/lib/operations-logic';
import { AuthPortal } from './auth-portal';
import { OverviewView } from './overview-view';
import { BuildingsView } from './buildings-view';
import { TicketsView } from './tickets-view';
import { MaintenanceView } from './maintenance-view';
import { EmergenciesView } from './emergencies-view';
import { WarehouseView } from './warehouse-view';
import { StaffView } from './staff-view';
import { AnalyticsView } from './analytics-view';
import { NotificationsView } from './notifications-view';
import { MetersView } from './meters-view';
import type {
  AnalyticsPayload,
  BrigadeRecord,
  BuildingItem,
  BuildingShort,
  EmergencyItem,
  MaintenancePlanItem,
  MeterReadingRecord,
  NotificationRecord,
  StaffUserRecord,
  TicketItem,
  UserProfile,
  WarehouseItemRecord,
} from './types';

type NavTab =
  | 'overview'
  | 'buildings'
  | 'tickets'
  | 'meters'
  | 'maintenance'
  | 'emergencies'
  | 'warehouse'
  | 'staff'
  | 'analytics'
  | 'notifications';

function getTabTitle(tab: NavTab, role: UserRole): string {
  if (tab === 'overview') {
    if (role === 'resident') return 'Главная';
    if (role === 'dispatcher') return 'Диспетчерская';
    if (role === 'specialist') return 'Мои задачи';
    return 'Обзор';
  }
  if (tab === 'buildings') return role === 'resident' ? 'Мой дом' : 'Дома';
  if (tab === 'tickets') {
    if (role === 'resident') return 'Мои заявки';
    if (role === 'specialist') return 'Наряды';
    return 'Заявки';
  }
  if (tab === 'meters') return role === 'resident' ? 'Показания счётчиков' : 'Счётчики';
  if (tab === 'maintenance') return 'Плановое ТО';
  if (tab === 'emergencies') return 'Аварии';
  if (tab === 'warehouse') return 'Склад';
  if (tab === 'staff') return role === 'dispatcher' ? 'Бригады' : 'Сотрудники и роли';
  if (tab === 'analytics') return 'Аналитика';
  return 'Уведомления';
}

export function AppShell() {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [publicBuildings, setPublicBuildings] = useState<BuildingShort[]>([]);
  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Workspace Data State
  const [dataLoading, setDataLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [buildings, setBuildings] = useState<BuildingItem[]>([]);
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [maintenancePlans, setMaintenancePlans] = useState<MaintenancePlanItem[]>([]);
  const [emergencies, setEmergencies] = useState<EmergencyItem[]>([]);
  const [warehouseItems, setWarehouseItems] = useState<WarehouseItemRecord[]>([]);
  const [brigades, setBrigades] = useState<BrigadeRecord[]>([]);
  const [staffUsers, setStaffUsers] = useState<StaffUserRecord[]>([]);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [meterReadings, setMeterReadings] = useState<MeterReadingRecord[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null);

  // Cross-tab actions
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [createTicketOpen, setCreateTicketOpen] = useState(false);
  const [createTicketCategory, setCreateTicketCategory] = useState<string | undefined>(undefined);
  const [createEmergencyOpen, setCreateEmergencyOpen] = useState(false);
  const [createNotifOpen, setCreateNotifOpen] = useState(false);

  const loadWorkspaceData = useCallback(async (currentUser: UserProfile) => {
    try {
      const role = currentUser.role;
      const requests: Array<Promise<void>> = [
        apiFetch('/api/buildings')
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            if (d?.buildings) setBuildings(d.buildings);
          }),
        apiFetch('/api/tickets')
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            if (d?.tickets) setTickets(d.tickets);
          }),
        apiFetch('/api/maintenance')
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            if (d?.plans) setMaintenancePlans(d.plans);
          }),
        apiFetch('/api/notifications')
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            if (d?.notifications) setNotifications(d.notifications);
          }),
        apiFetch('/api/staff')
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            if (d?.brigades) setBrigades(d.brigades);
            if (d?.users) setStaffUsers(d.users);
          }),
      ];

      if (canPerformAction(role, 'view_emergencies')) {
        requests.push(
          apiFetch('/api/emergencies')
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => {
              if (d?.emergencies) setEmergencies(d.emergencies);
            })
        );
      } else {
        setEmergencies([]);
      }

      if (canPerformAction(role, 'view_warehouse')) {
        requests.push(
          apiFetch('/api/warehouse')
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => {
              if (d?.items) setWarehouseItems(d.items);
            })
        );
      } else {
        setWarehouseItems([]);
      }

      if (role !== 'specialist') {
        requests.push(
          apiFetch('/api/meters')
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => {
              if (d?.readings) setMeterReadings(d.readings);
            })
        );
      } else {
        setMeterReadings([]);
      }

      if (canPerformAction(role, 'view_analytics')) {
        requests.push(
          apiFetch('/api/analytics')
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => {
              if (d?.kpis) setAnalytics(d);
            })
        );
      } else {
        setAnalytics(null);
      }

      await Promise.all(requests);
      setLoadError(null);
    } catch {
      setLoadError('Часть данных не удалось загрузить. Попробуйте обновить страницу.');
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    apiFetch('/api/auth/session')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setPublicBuildings(data.buildings ?? []);
        const sessionUser: UserProfile | null = data.user ?? null;
        setUser(sessionUser);
        if (sessionUser) {
          void loadWorkspaceData(sessionUser);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError('Не удалось подключиться к серверу.');
      })
      .finally(() => {
        if (!cancelled) setInitializing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadWorkspaceData]);

  async function handleLogout() {
    clearClientSessionToken();
    setSelectedTicketId(null);
    setCreateTicketOpen(false);
    setCreateEmergencyOpen(false);
    setCreateNotifOpen(false);
    setMobileMenuOpen(false);
    setActiveTab('overview');
    setBuildings([]);
    setTickets([]);
    setMaintenancePlans([]);
    setEmergencies([]);
    setWarehouseItems([]);
    setBrigades([]);
    setStaffUsers([]);
    setNotifications([]);
    setMeterReadings([]);
    setAnalytics(null);
    setLoadError(null);
    setUser(null);
    await apiFetch('/api/auth/session', { method: 'DELETE' });
  }

  if (initializing) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center space-y-1.5">
          <div className="text-lg font-bold text-slate-900">ДомоУправ</div>
          <p className="text-sm text-slate-500">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <AuthPortal
        buildings={publicBuildings}
        onAuthenticated={(loggedInUser) => {
          setUser(loggedInUser);
          setActiveTab('overview');
          setDataLoading(true);
          void loadWorkspaceData(loggedInUser);
        }}
      />
    );
  }

  const unreadNotifications = notifications.filter((n) => !n.isRead).length;
  const activeEmergenciesCount = emergencies.filter((e) => e.status !== 'resolved').length;
  const openTicketsCount =
    user.role === 'specialist'
      ? tickets.filter(
          (t) =>
            t.status !== 'resolved' &&
            t.status !== 'closed' &&
            (t.assigneeId === user.id || (user.brigadeId && t.brigadeId === user.brigadeId))
        ).length
      : tickets.filter((t) => t.status !== 'resolved' && t.status !== 'closed').length;

  type NavItem = {
    id: NavTab;
    label: string;
    icon: typeof LayoutDashboard;
    count?: number;
  };

  let navItems: NavItem[] = [];
  if (user.role === 'resident') {
    navItems = [
      { id: 'overview', label: 'Главная', icon: Home },
      {
        id: 'tickets',
        label: 'Мои заявки',
        icon: ClipboardList,
        count: openTicketsCount > 0 ? openTicketsCount : undefined,
      },
      { id: 'meters', label: 'Показания счётчиков', icon: Gauge },
      { id: 'buildings', label: 'Мой дом', icon: Building2 },
      {
        id: 'notifications',
        label: 'Уведомления',
        icon: Bell,
        count: unreadNotifications > 0 ? unreadNotifications : undefined,
      },
    ];
  } else if (user.role === 'specialist') {
    navItems = [
      { id: 'overview', label: 'Мои задачи', icon: LayoutDashboard },
      {
        id: 'tickets',
        label: 'Наряды',
        icon: ClipboardList,
        count: openTicketsCount > 0 ? openTicketsCount : undefined,
      },
      { id: 'maintenance', label: 'Плановое ТО', icon: Wrench },
      {
        id: 'emergencies',
        label: 'Аварии',
        icon: AlertTriangle,
        count: activeEmergenciesCount > 0 ? activeEmergenciesCount : undefined,
      },
      { id: 'warehouse', label: 'Склад', icon: Package },
      { id: 'buildings', label: 'Дома', icon: Building2 },
      {
        id: 'notifications',
        label: 'Уведомления',
        icon: Bell,
        count: unreadNotifications > 0 ? unreadNotifications : undefined,
      },
    ];
  } else if (user.role === 'dispatcher') {
    navItems = [
      { id: 'overview', label: 'Диспетчерская', icon: LayoutDashboard },
      {
        id: 'tickets',
        label: 'Заявки',
        icon: ClipboardList,
        count: openTicketsCount > 0 ? openTicketsCount : undefined,
      },
      {
        id: 'emergencies',
        label: 'Аварии',
        icon: AlertTriangle,
        count: activeEmergenciesCount > 0 ? activeEmergenciesCount : undefined,
      },
      { id: 'maintenance', label: 'Плановое ТО', icon: Wrench },
      { id: 'meters', label: 'Счётчики', icon: Gauge },
      { id: 'buildings', label: 'Дома', icon: Building2 },
      { id: 'warehouse', label: 'Склад', icon: Package },
      { id: 'staff', label: 'Бригады', icon: Users },
      {
        id: 'notifications',
        label: 'Уведомления',
        icon: Bell,
        count: unreadNotifications > 0 ? unreadNotifications : undefined,
      },
    ];
  } else {
    navItems = [
      { id: 'overview', label: 'Обзор', icon: LayoutDashboard },
      { id: 'analytics', label: 'Аналитика', icon: BarChart3 },
      { id: 'buildings', label: 'Дома', icon: Building2 },
      {
        id: 'tickets',
        label: 'Заявки',
        icon: ClipboardList,
        count: openTicketsCount > 0 ? openTicketsCount : undefined,
      },
      {
        id: 'emergencies',
        label: 'Аварии',
        icon: AlertTriangle,
        count: activeEmergenciesCount > 0 ? activeEmergenciesCount : undefined,
      },
      { id: 'maintenance', label: 'Плановое ТО', icon: Wrench },
      { id: 'meters', label: 'Счётчики', icon: Gauge },
      { id: 'warehouse', label: 'Склад', icon: Package },
      { id: 'staff', label: 'Сотрудники и роли', icon: Users },
      {
        id: 'notifications',
        label: 'Уведомления',
        icon: Bell,
        count: unreadNotifications > 0 ? unreadNotifications : undefined,
      },
    ];
  }

  const canCreateTicket = canPerformAction(user.role, 'create_ticket');

  const handleOpenNewTicket = (category?: string) => {
    setCreateTicketCategory(category);
    setActiveTab('tickets');
    setCreateTicketOpen(true);
  };

  const handleOpenNewEmergency = () => {
    setActiveTab('emergencies');
    setCreateEmergencyOpen(true);
  };

  const handleOpenNewNotification = () => {
    setActiveTab('notifications');
    setCreateNotifOpen(true);
  };

  const handleRefreshAll = async () => {
    await loadWorkspaceData(user);
  };

  const SidebarContent = (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">
      {/* Brand */}
      <div className="h-16 px-5 border-b border-slate-200 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-700 flex items-center justify-center shrink-0">
            <Building2 className="w-4 h-4 text-white" aria-hidden="true" />
          </div>
          <span className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap">
            ДомоУправ
          </span>
        </div>
        <button
          type="button"
          aria-label="Закрыть меню"
          onClick={() => setMobileMenuOpen(false)}
          className="lg:hidden p-1.5 text-slate-500 hover:text-slate-900"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav aria-label="Основная навигация" className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setActiveTab(item.id);
                setMobileMenuOpen(false);
              }}
              aria-current={isActive ? 'page' : undefined}
              className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-blue-50 text-blue-800 font-semibold'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span className="flex items-center gap-3 min-w-0">
                <Icon
                  className={`w-4 h-4 shrink-0 ${isActive ? 'text-blue-700' : 'text-slate-400'}`}
                  aria-hidden="true"
                />
                <span className="truncate">{item.label}</span>
              </span>
              {item.count !== undefined && (
                <span
                  className={`font-mono tabular-nums text-xs font-semibold ${
                    item.id === 'emergencies' ? 'text-red-700' : 'text-slate-500'
                  }`}
                >
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Account Footer */}
      <div className="p-4 border-t border-slate-200 space-y-3 shrink-0">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900 truncate">{user.fullName}</div>
          <div className="text-xs text-slate-500 truncate">{ROLE_LABELS[user.role]}</div>
        </div>
        <button
          type="button"
          onClick={() => void handleLogout()}
          className="w-full py-2 px-3 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Выйти</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Sidebar (256px) */}
      <aside className="no-print hidden lg:block w-64 shrink-0 sticky top-0 h-screen">
        {SidebarContent}
      </aside>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="no-print fixed inset-0 z-50 lg:hidden flex">
          <div className="w-72 max-w-[85vw] h-full">{SidebarContent}</div>
          <button
            type="button"
            aria-label="Закрыть меню"
            onClick={() => setMobileMenuOpen(false)}
            className="flex-1 bg-slate-900/45"
          />
        </div>
      )}

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="no-print h-16 bg-white border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              aria-label="Открыть меню"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-lg"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="font-semibold text-sm text-slate-900 truncate">
              {getTabTitle(activeTab, user.role)}
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {canCreateTicket && (
              <button
                type="button"
                onClick={() => handleOpenNewTicket()}
                className="px-3.5 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>
                  {user.role === 'resident'
                    ? 'Подать заявку'
                    : user.role === 'dispatcher'
                      ? 'Принять заявку'
                      : 'Новая заявка'}
                </span>
              </button>
            )}
          </div>
        </header>

        {/* Viewport Main Content */}
        <main className="flex-1 p-4 sm:p-8 max-w-[1380px] w-full mx-auto">
          {loadError && (
            <div
              role="alert"
              className="mb-6 px-4 py-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between gap-4"
            >
              <span>{loadError}</span>
              <button
                type="button"
                onClick={() => void handleRefreshAll()}
                className="text-xs font-semibold underline shrink-0"
              >
                Повторить
              </button>
            </div>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            >
              {activeTab === 'overview' && (
                <OverviewView
                  user={user}
                  buildings={buildings}
                  tickets={tickets}
                  emergencies={emergencies}
                  maintenancePlans={maintenancePlans}
                  warehouseItems={warehouseItems}
                  brigades={brigades}
                  notifications={notifications}
                  analytics={analytics}
                  onNavigate={(tab) => setActiveTab(tab as NavTab)}
                  onSelectTicket={(id) => {
                    setSelectedTicketId(id);
                    setActiveTab('tickets');
                  }}
                  onOpenNewTicket={handleOpenNewTicket}
                  onOpenNewEmergency={handleOpenNewEmergency}
                  onOpenNewNotification={handleOpenNewNotification}
                  onRefresh={handleRefreshAll}
                />
              )}

              {activeTab === 'buildings' && (
                <BuildingsView
                  user={user}
                  buildings={buildings}
                  onRefresh={handleRefreshAll}
                />
              )}

              {activeTab === 'tickets' && (
                <TicketsView
                  user={user}
                  tickets={tickets}
                  buildings={buildings}
                  fallbackBuildings={publicBuildings}
                  brigades={brigades}
                  staffUsers={staffUsers}
                  warehouseItems={warehouseItems}
                  selectedTicketId={selectedTicketId}
                  createModalOpen={createTicketOpen}
                  defaultCategory={createTicketCategory}
                  onSetCreateModalOpen={(open) => {
                    setCreateTicketOpen(open);
                    if (!open) setCreateTicketCategory(undefined);
                  }}
                  onSelectTicket={setSelectedTicketId}
                  onRefresh={handleRefreshAll}
                />
              )}

              {activeTab === 'meters' && (
                <MetersView
                  user={user}
                  readings={meterReadings}
                  buildings={buildings}
                  onRefresh={handleRefreshAll}
                />
              )}

              {activeTab === 'maintenance' && (
                <MaintenanceView
                  user={user}
                  plans={maintenancePlans}
                  buildings={buildings}
                  brigades={brigades}
                  onRefresh={handleRefreshAll}
                />
              )}

              {activeTab === 'emergencies' && (
                <EmergenciesView
                  user={user}
                  emergencies={emergencies}
                  buildings={buildings}
                  brigades={brigades}
                  createModalOpen={createEmergencyOpen}
                  onSetCreateModalOpen={setCreateEmergencyOpen}
                  onRefresh={handleRefreshAll}
                />
              )}

              {activeTab === 'warehouse' && (
                <WarehouseView
                  user={user}
                  items={warehouseItems}
                  onRefresh={handleRefreshAll}
                />
              )}

              {activeTab === 'staff' && (
                <StaffView
                  user={user}
                  users={staffUsers}
                  brigades={brigades}
                  onRefresh={handleRefreshAll}
                />
              )}

              {activeTab === 'analytics' && (
                <AnalyticsView analytics={analytics} loading={dataLoading && !analytics} />
              )}

              {activeTab === 'notifications' && (
                <NotificationsView
                  user={user}
                  buildings={buildings}
                  notifications={notifications}
                  createModalOpen={createNotifOpen}
                  onSetCreateModalOpen={setCreateNotifOpen}
                  onRefresh={handleRefreshAll}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
