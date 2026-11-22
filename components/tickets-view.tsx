'use client';

import { useEffect, useState } from 'react';
import {
  Camera,
  Check,
  MessageSquare,
  PackagePlus,
  Plus,
  Printer,
  Search,
  Send,
  Star,
  X,
} from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import {
  canPerformAction,
  CATEGORY_LABELS,
  formatDateTime,
  formatRubles,
  getAllowedTicketTransitions,
  isTicketOverdue,
  PRIORITY_LABELS,
  ROLE_LABELS,
  STATUS_LABELS,
  type TicketPriority,
  type TicketStatus,
} from '@/lib/operations-logic';
import { TicketActPrintModal } from './print-documents';
import type {
  BrigadeRecord,
  BuildingItem,
  BuildingShort,
  StaffUserRecord,
  TicketCommentEntry,
  TicketHistoryEntry,
  TicketItem,
  TicketMaterialUsage,
  UserProfile,
  WarehouseItemRecord,
} from './types';

interface TicketsViewProps {
  user: UserProfile;
  tickets: TicketItem[];
  buildings: BuildingItem[];
  fallbackBuildings?: BuildingShort[];
  brigades: BrigadeRecord[];
  staffUsers: StaffUserRecord[];
  warehouseItems: WarehouseItemRecord[];
  selectedTicketId: number | null;
  createModalOpen: boolean;
  defaultCategory?: string;
  onSetCreateModalOpen: (open: boolean) => void;
  onSelectTicket: (id: number | null) => void;
  onRefresh: () => Promise<void>;
}

interface TicketDetailState {
  ticket: TicketItem;
  history: TicketHistoryEntry[];
  materials: TicketMaterialUsage[];
  comments: TicketCommentEntry[];
}

export function TicketsView({
  user,
  tickets,
  buildings,
  fallbackBuildings = [],
  brigades,
  staffUsers,
  warehouseItems,
  selectedTicketId,
  createModalOpen,
  defaultCategory,
  onSetCreateModalOpen,
  onSelectTicket,
  onRefresh,
}: TicketsViewProps) {
  const buildingOptions: BuildingShort[] =
    buildings.length > 0 ? buildings : fallbackBuildings;
  const canCreate = canPerformAction(user.role, 'create_ticket');
  const canTriage = canPerformAction(user.role, 'triage_ticket');
  const canExecute = canPerformAction(user.role, 'execute_ticket');
  const canConsume = canPerformAction(user.role, 'consume_materials');

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [specialistScope, setSpecialistScope] = useState<'my_brigade' | 'mine' | 'all'>(
    'my_brigade'
  );
  const [buildingFilter, setBuildingFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  // Create ticket modal fields
  const [cBuildingId, setCBuildingId] = useState<string>('');
  const effectiveBuildingId =
    cBuildingId ||
    (user.buildingId
      ? String(user.buildingId)
      : buildingOptions[0]?.id
        ? String(buildingOptions[0].id)
        : '');
  const [cApt, setCApt] = useState(user.apartmentNumber || '');
  const [cCategory, setCCategory] = useState('');
  const effectiveCategory = cCategory || defaultCategory || 'plumbing';
  const [cTitle, setCTitle] = useState('');
  const [cDescription, setCDescription] = useState('');
  const [cPriority, setCPriority] = useState<TicketPriority>('medium');
  const [cPhotoData, setCPhotoData] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Ticket detail drawer
  const [detail, setDetail] = useState<TicketDetailState | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [savingAction, setSavingAction] = useState(false);

  // Triage & execution form states inside drawer
  const [editPriority, setEditPriority] = useState<TicketPriority>('medium');
  const [editAssigneeId, setEditAssigneeId] = useState<string>('');
  const [editBrigadeId, setEditBrigadeId] = useState<string>('');
  const [editResolution, setEditResolution] = useState<string>('');
  const [editLaborCost, setEditLaborCost] = useState<string>('0');
  const [editAfterPhoto, setEditAfterPhoto] = useState<string | null>(null);
  const [consumeItemId, setConsumeItemId] = useState<string>('');
  const [consumeQty, setConsumeQty] = useState<string>('1');

  // Print Act, Comments & Resident Quality Rating states
  const [showPrintAct, setShowPrintAct] = useState(false);
  const [commentInput, setCommentInput] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [ratingValue, setRatingValue] = useState<number>(5);
  const [ratingFeedback, setRatingFeedback] = useState('');

  async function loadDetail(ticketId: number) {
    setActionError(null);
    const res = await apiFetch(`/api/tickets/${ticketId}`);
    if (res.ok) {
      const data: TicketDetailState = await res.json();
      setDetail({ ...data, comments: data.comments ?? [] });
      setEditPriority(data.ticket.priority);
      setEditAssigneeId(data.ticket.assigneeId ? String(data.ticket.assigneeId) : '');
      setEditBrigadeId(data.ticket.brigadeId ? String(data.ticket.brigadeId) : '');
      setEditResolution(data.ticket.resolutionNotes || '');
      setEditLaborCost(String(data.ticket.laborCost || 0));
      setEditAfterPhoto(data.ticket.afterPhotoData || null);
      setRatingValue(data.ticket.residentRating || 5);
      setRatingFeedback(data.ticket.residentFeedback || '');
    }
  }

  useEffect(() => {
    if (!selectedTicketId) return;
    let cancelled = false;
    apiFetch(`/api/tickets/${selectedTicketId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: TicketDetailState | null) => {
        if (cancelled || !data) return;
        setDetail({ ...data, comments: data.comments ?? [] });
        setActionError(null);
        setEditPriority(data.ticket.priority);
        setEditAssigneeId(data.ticket.assigneeId ? String(data.ticket.assigneeId) : '');
        setEditBrigadeId(data.ticket.brigadeId ? String(data.ticket.brigadeId) : '');
        setEditResolution(data.ticket.resolutionNotes || '');
        setEditLaborCost(String(data.ticket.laborCost || 0));
        setEditAfterPhoto(data.ticket.afterPhotoData || null);
        setRatingValue(data.ticket.residentRating || 5);
        setRatingFeedback(data.ticket.residentFeedback || '');
      })
      .catch(() => {
        if (!cancelled) setActionError('Не удалось загрузить карточку заявки');
      });
    return () => {
      cancelled = true;
    };
  }, [selectedTicketId]);

  const detailLoading = selectedTicketId !== null && detail?.ticket.id !== selectedTicketId;

  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setCreateError('Размер изображения не должен превышать 2 МБ');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCPhotoData(reader.result);
      }
    };
    reader.readAsDataURL(file);
  }

  function handleAfterPhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setActionError('Размер фото после ремонта не должен превышать 2 МБ');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setEditAfterPhoto(reader.result);
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleSendComment(e: React.FormEvent) {
    e.preventDefault();
    if (!detail || !commentInput.trim()) return;
    setActionError(null);
    setSendingComment(true);
    try {
      const res = await apiFetch(`/api/tickets/${detail.ticket.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: commentInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || 'Не удалось отправить сообщение');
        return;
      }
      setCommentInput('');
      await loadDetail(detail.ticket.id);
    } finally {
      setSendingComment(false);
    }
  }

  async function handleCreateTicket(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreating(true);
    try {
      const res = await apiFetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buildingId: Number(effectiveBuildingId),
          apartmentNumber: cApt || undefined,
          category: effectiveCategory,
          title: cTitle,
          description: cDescription,
          priority: canTriage ? cPriority : undefined,
          photoData: cPhotoData,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error || 'Не удалось создать заявку');
        return;
      }
      onSetCreateModalOpen(false);
      setCCategory('');
      setCTitle('');
      setCDescription('');
      setCPhotoData(null);
      await onRefresh();
    } finally {
      setCreating(false);
    }
  }

  async function handleUpdateTicket(payload: Record<string, unknown>) {
    if (!detail) return;
    setActionError(null);
    setSavingAction(true);
    try {
      const res = await apiFetch(`/api/tickets/${detail.ticket.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || 'Не удалось обновить заявку');
        return;
      }
      await loadDetail(detail.ticket.id);
      await onRefresh();
    } finally {
      setSavingAction(false);
    }
  }

  async function handleConsumeMaterial(e: React.FormEvent) {
    e.preventDefault();
    if (!detail || !consumeItemId) return;
    setActionError(null);
    setSavingAction(true);
    try {
      const res = await apiFetch(`/api/tickets/${detail.ticket.id}/materials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: Number(consumeItemId),
          quantityUsed: Number(consumeQty),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || 'Не удалось списать материал');
        return;
      }
      setConsumeItemId('');
      setConsumeQty('1');
      await loadDetail(detail.ticket.id);
      await onRefresh();
    } finally {
      setSavingAction(false);
    }
  }

  const specialists = staffUsers.filter(
    (u) => u.role === 'specialist' || u.role === 'admin'
  );

  const filteredTickets = tickets.filter((t) => {
    if (user.role === 'specialist') {
      if (specialistScope === 'mine' && t.assigneeId !== user.id) return false;
      if (
        specialistScope === 'my_brigade' &&
        t.assigneeId !== user.id &&
        (!user.brigadeId || t.brigadeId !== user.brigadeId)
      ) {
        return false;
      }
    }
    if (statusFilter === 'open' && (t.status === 'resolved' || t.status === 'closed')) {
      return false;
    }
    if (statusFilter === 'overdue' && !isTicketOverdue(t.status, t.slaDeadline)) {
      return false;
    }
    if (
      statusFilter !== 'all' &&
      statusFilter !== 'open' &&
      statusFilter !== 'overdue' &&
      t.status !== statusFilter
    ) {
      return false;
    }
    if (buildingFilter !== 'all' && String(t.buildingId) !== buildingFilter) {
      return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        t.ticketNumber.toLowerCase().includes(q) ||
        t.title.toLowerCase().includes(q) ||
        t.buildingAddress.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const statusTabs =
    user.role === 'resident'
      ? [
          { id: 'all', label: 'Все' },
          { id: 'open', label: 'Активные' },
          { id: 'resolved', label: 'Выполнены' },
          { id: 'closed', label: 'Закрыты' },
        ]
      : [
          { id: 'all', label: 'Все' },
          { id: 'open', label: 'В работе' },
          { id: 'new', label: 'Новые' },
          { id: 'overdue', label: 'Просроченные' },
          { id: 'assigned', label: 'Назначены' },
          { id: 'in_progress', label: 'Выполняются' },
          { id: 'resolved', label: 'Выполнены' },
          { id: 'closed', label: 'Закрыты' },
        ];

  return (
    <div className="space-y-6">
      <div className="print-hide-when-modal space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {user.role === 'resident'
            ? 'Мои заявки'
            : user.role === 'specialist'
              ? 'Наряды'
              : 'Заявки'}
        </h1>

        {canCreate && (
          <button
            type="button"
            onClick={() => onSetCreateModalOpen(true)}
            className="px-4 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>{user.role === 'resident' ? 'Подать заявку' : 'Создать заявку'}</span>
          </button>
        )}
      </div>

      {/* Filters Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {user.role === 'specialist' && (
            <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {[
                { id: 'my_brigade', label: 'Мои и бригада' },
                { id: 'mine', label: 'Только мои' },
                { id: 'all', label: 'Все заявки' },
              ].map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSpecialistScope(s.id as 'my_brigade' | 'mine' | 'all')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    specialistScope === s.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}

          <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {statusTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  statusFilter === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {user.role !== 'resident' && (
            <select
              aria-label="Фильтр по дому"
              value={buildingFilter}
              onChange={(e) => setBuildingFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
            >
              <option value="all">Все дома</option>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.address}
                </option>
              ))}
            </select>
          )}

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Номер или тема заявки..."
              aria-label="Поиск заявок"
              className="pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-lg w-56 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
            />
          </div>
        </div>
      </div>

      {/* Tickets Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {filteredTickets.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm text-slate-600">По выбранным параметрам заявок не найдено.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                  <th className="py-2.5 px-4 whitespace-nowrap">Номер</th>
                  <th className="py-2.5 px-4">Объект и описание</th>
                  <th className="py-2.5 px-4 whitespace-nowrap">Приоритет</th>
                  <th className="py-2.5 px-4 whitespace-nowrap">Статус</th>
                  <th className="py-2.5 px-4 whitespace-nowrap">Исполнитель</th>
                  <th className="py-2.5 px-4 text-right whitespace-nowrap">Срок SLA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {filteredTickets.map((t) => {
                  const overdue = isTicketOverdue(t.status, t.slaDeadline);
                  return (
                    <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-mono tabular-nums text-xs font-semibold whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onSelectTicket(t.id)}
                          className="text-blue-700 hover:underline"
                        >
                          {t.ticketNumber}
                        </button>
                      </td>
                      <td className="py-3 px-4 max-w-md">
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
                            {t.apartmentNumber ? `, кв. ${t.apartmentNumber}` : ''} ·{' '}
                            {CATEGORY_LABELS[t.category] || t.category}
                          </div>
                        </button>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-xs font-semibold">
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
                      <td className="py-3 px-4 whitespace-nowrap text-xs font-medium">
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
                      <td className="py-3 px-4 whitespace-nowrap text-xs text-slate-600">
                        {t.assigneeName || t.brigadeName || 'Не назначен'}
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-mono tabular-nums text-xs whitespace-nowrap ${
                          overdue ? 'text-red-700 font-semibold' : 'text-slate-500'
                        }`}
                      >
                        {formatDateTime(t.slaDeadline)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Ticket Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 w-full max-w-lg p-6 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">Новое обращение / заявка</h2>
              <button
                type="button"
                aria-label="Закрыть форму создания заявки"
                onClick={() => onSetCreateModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {createError && (
              <div className="mb-4 px-3.5 py-2.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateTicket} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label
                    htmlFor="ticket-building"
                    className="block text-xs font-medium text-slate-700 mb-1"
                  >
                    Многоквартирный дом
                  </label>
                  <select
                    id="ticket-building"
                    required
                    value={effectiveBuildingId}
                    onChange={(e) => setCBuildingId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  >
                    {buildingOptions.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.address}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="ticket-apt"
                    className="block text-xs font-medium text-slate-700 mb-1"
                  >
                    Квартира / МОП
                  </label>
                  <input
                    id="ticket-apt"
                    type="text"
                    value={cApt}
                    onChange={(e) => setCApt(e.target.value)}
                    placeholder="42 или Подъезд 1"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="ticket-category"
                    className="block text-xs font-medium text-slate-700 mb-1"
                  >
                    Категория проблемы
                  </label>
                  <select
                    id="ticket-category"
                    value={effectiveCategory}
                    onChange={(e) => setCCategory(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  >
                    {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                {canTriage && (
                  <div>
                    <label
                      htmlFor="ticket-priority"
                      className="block text-xs font-medium text-slate-700 mb-1"
                    >
                      Приоритет
                    </label>
                    <select
                      id="ticket-priority"
                      value={cPriority}
                      onChange={(e) => setCPriority(e.target.value as TicketPriority)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    >
                      <option value="low">Низкий (120 ч)</option>
                      <option value="medium">Средний (48 ч)</option>
                      <option value="high">Высокий (12 ч)</option>
                      <option value="critical">Критический (4 ч)</option>
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label
                  htmlFor="ticket-title"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Краткая тема обращения
                </label>
                <input
                  id="ticket-title"
                  required
                  minLength={5}
                  value={cTitle}
                  onChange={(e) => setCTitle(e.target.value)}
                  placeholder="Например: Протечка крана на стояке холодной воды"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label
                  htmlFor="ticket-desc"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Подробное описание неисправности
                </label>
                <textarea
                  id="ticket-desc"
                  required
                  minLength={10}
                  rows={3}
                  value={cDescription}
                  onChange={(e) => setCDescription(e.target.value)}
                  placeholder="Опишите место неисправности, удобное время доступа и контактные данные..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              {/* Photo Attachment */}
              <div>
                <label
                  htmlFor="ticket-photo"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Фотография неисправности (необязательно, до 2 МБ)
                </label>
                <div className="flex items-center gap-3">
                  <label
                    htmlFor="ticket-photo"
                    className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-lg cursor-pointer"
                  >
                    <Camera className="w-4 h-4 text-slate-500" />
                    <span>Прикрепить фото</span>
                  </label>
                  <input
                    id="ticket-photo"
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="sr-only"
                  />
                  {cPhotoData && (
                    <button
                      type="button"
                      onClick={() => setCPhotoData(null)}
                      className="text-xs text-red-700 hover:underline"
                    >
                      Удалить фото
                    </button>
                  )}
                </div>
                {cPhotoData && (
                  <div className="mt-2.5 relative h-36 w-full rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={cPhotoData}
                      alt="Предпросмотр прикреплённого фото неисправности"
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => onSetCreateModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg"
                >
                  {creating ? 'Отправка...' : 'Отправить заявку'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ticket Detail Slide-Over Drawer */}
      {selectedTicketId && (
        <div className="print-hide-when-modal fixed inset-0 z-40 bg-slate-900/45 flex justify-end">
          <div className="bg-white w-full max-w-2xl h-full overflow-y-auto border-l border-slate-200 flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-3 sticky top-0 bg-white z-10">
              <div>
                <div className="text-xs font-mono text-slate-500">
                  {detail ? detail.ticket.ticketNumber : 'Загрузка...'}
                </div>
                <h2 className="text-lg font-bold text-slate-900">Карточка заявки</h2>
              </div>
              <div className="flex items-center gap-2">
                {detail && (
                  <button
                    type="button"
                    onClick={() => setShowPrintAct(true)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Акт (PDF)</span>
                  </button>
                )}
                <button
                  type="button"
                  aria-label="Закрыть карточку заявки"
                  onClick={() => onSelectTicket(null)}
                  className="p-2 text-slate-400 hover:text-slate-800 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {detailLoading || !detail ? (
              <div className="p-10 text-center text-sm text-slate-500">
                Загрузка данных заявки...
              </div>
            ) : (
              <div className="p-6 space-y-6 flex-1">
                {actionError && (
                  <div className="px-4 py-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg">
                    {actionError}
                  </div>
                )}

                {/* Core Info */}
                <div>
                  <div className="text-xs text-slate-500">
                    {detail.ticket.buildingAddress}
                    {detail.ticket.apartmentNumber
                      ? `, кв. ${detail.ticket.apartmentNumber}`
                      : ''}{' '}
                    · {CATEGORY_LABELS[detail.ticket.category]}
                  </div>
                  <h3 className="mt-1 text-xl font-bold text-slate-900">
                    {detail.ticket.title}
                  </h3>
                  <p className="mt-2 text-sm text-slate-700 leading-relaxed">
                    {detail.ticket.description}
                  </p>
                </div>

                {/* Before / After Photos */}
                {(detail.ticket.photoData || detail.ticket.afterPhotoData) && (
                  <div
                    className={`grid gap-3 ${
                      detail.ticket.photoData && detail.ticket.afterPhotoData
                        ? 'grid-cols-1 sm:grid-cols-2'
                        : 'grid-cols-1'
                    }`}
                  >
                    {detail.ticket.photoData && (
                      <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                        <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-600 border-b border-slate-200 bg-white">
                          Фото неисправности (до ремонта)
                        </div>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={detail.ticket.photoData}
                          alt="Фотография неисправности от заявителя"
                          className="w-full max-h-56 object-contain"
                        />
                      </div>
                    )}
                    {detail.ticket.afterPhotoData && (
                      <div className="border border-emerald-200 rounded-lg overflow-hidden bg-slate-50">
                        <div className="px-3 py-1.5 text-[11px] font-semibold text-emerald-800 border-b border-emerald-200 bg-emerald-50">
                          Фото после выполнения работ
                        </div>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={detail.ticket.afterPhotoData}
                          alt="Фотография результата выполненных работ"
                          className="w-full max-h-56 object-contain"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Metadata Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4 border-y border-slate-200 text-xs">
                  <div>
                    <div className="text-slate-500">Статус</div>
                    <div className="mt-0.5 font-semibold text-slate-900">
                      {STATUS_LABELS[detail.ticket.status]}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Приоритет</div>
                    <div className="mt-0.5 font-semibold text-slate-900">
                      {PRIORITY_LABELS[detail.ticket.priority]}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Срок SLA</div>
                    <div className="mt-0.5 font-mono tabular-nums text-slate-900">
                      {formatDateTime(detail.ticket.slaDeadline)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Затраты (труд + мат.)</div>
                    <div className="mt-0.5 font-mono tabular-nums font-semibold text-slate-900">
                      {formatRubles(detail.ticket.laborCost + detail.ticket.materialsCost)}
                    </div>
                  </div>
                </div>

                {/* Dispatcher / Admin Triage Panel */}
                {canTriage && detail.ticket.status !== 'closed' && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                    <div className="text-sm font-semibold text-slate-900">
                      Диспетчеризация и назначение
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">Приоритет</label>
                        <select
                          aria-label="Приоритет заявки"
                          value={editPriority}
                          onChange={(e) => setEditPriority(e.target.value as TicketPriority)}
                          className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                        >
                          <option value="low">Низкий</option>
                          <option value="medium">Средний</option>
                          <option value="high">Высокий</option>
                          <option value="critical">Критический</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">Исполнитель</label>
                        <select
                          aria-label="Назначить специалиста"
                          value={editAssigneeId}
                          onChange={(e) => setEditAssigneeId(e.target.value)}
                          className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                        >
                          <option value="">Не назначен</option>
                          {specialists.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.fullName}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">Бригада</label>
                        <select
                          aria-label="Назначить бригаду"
                          value={editBrigadeId}
                          onChange={(e) => setEditBrigadeId(e.target.value)}
                          className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                        >
                          <option value="">Не выбрана</option>
                          {brigades.map((br) => (
                            <option key={br.id} value={br.id}>
                              {br.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        disabled={savingAction}
                        onClick={() =>
                          void handleUpdateTicket({
                            priority: editPriority,
                            assigneeId: editAssigneeId ? Number(editAssigneeId) : null,
                            brigadeId: editBrigadeId ? Number(editBrigadeId) : null,
                            status:
                              detail.ticket.status === 'new' && !editAssigneeId && !editBrigadeId
                                ? 'registered'
                                : editAssigneeId || editBrigadeId
                                  ? 'assigned'
                                  : undefined,
                            comment: 'Обновлены параметры диспетчеризации',
                          })
                        }
                        className="px-3.5 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg"
                      >
                        Сохранить назначение
                      </button>

                      {detail.ticket.status === 'resolved' && (
                        <button
                          type="button"
                          disabled={savingAction}
                          onClick={() =>
                            void handleUpdateTicket({
                              status: 'closed',
                              comment: 'Заявка проверена и закрыта диспетчером',
                            })
                          }
                          className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg"
                        >
                          Закрыть заявку
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Specialist Execution Panel */}
                {canExecute &&
                  (detail.ticket.status === 'assigned' ||
                    detail.ticket.status === 'in_progress') && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                      <div className="text-sm font-semibold text-slate-900">
                        Выполнение эксплуатационных работ
                      </div>
                      {detail.ticket.status === 'assigned' && (
                        <button
                          type="button"
                          disabled={savingAction}
                          onClick={() =>
                            void handleUpdateTicket({
                              status: 'in_progress',
                              comment: 'Специалист приступил к выполнению работ',
                            })
                          }
                          className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg"
                        >
                          Взять заявку в работу
                        </button>
                      )}

                      {detail.ticket.status === 'in_progress' && (
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="sm:col-span-2">
                              <label className="block text-xs text-slate-600 mb-1">
                                Отчёт о выполненных работах
                              </label>
                              <input
                                type="text"
                                value={editResolution}
                                onChange={(e) => setEditResolution(e.target.value)}
                                placeholder="Опишите устранение неисправности..."
                                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-slate-600 mb-1">
                                Стоимость работ (₽)
                              </label>
                              <input
                                type="number"
                                min={0}
                                value={editLaborCost}
                                onChange={(e) => setEditLaborCost(e.target.value)}
                                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-mono"
                              />
                            </div>
                          </div>
                          {/* Specialist After-Repair Photo Upload */}
                          <div>
                            <div className="flex items-center gap-3">
                              <label
                                htmlFor="ticket-after-photo"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg cursor-pointer"
                              >
                                <Camera className="w-3.5 h-3.5 text-slate-500" />
                                <span>
                                  {editAfterPhoto
                                    ? 'Заменить фото после ремонта'
                                    : 'Прикрепить фото после ремонта'}
                                </span>
                              </label>
                              <input
                                id="ticket-after-photo"
                                type="file"
                                accept="image/*"
                                onChange={handleAfterPhotoUpload}
                                className="sr-only"
                              />
                              {editAfterPhoto && (
                                <button
                                  type="button"
                                  onClick={() => setEditAfterPhoto(null)}
                                  className="text-xs text-red-700 hover:underline"
                                >
                                  Убрать
                                </button>
                              )}
                            </div>
                            {editAfterPhoto && editAfterPhoto !== detail.ticket.afterPhotoData && (
                              <div className="mt-2 h-24 rounded-lg overflow-hidden border border-slate-200 bg-white">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={editAfterPhoto}
                                  alt="Предпросмотр фото после ремонта"
                                  className="w-full h-full object-contain"
                                />
                              </div>
                            )}
                          </div>

                          <button
                            type="button"
                            disabled={savingAction}
                            onClick={() =>
                              void handleUpdateTicket({
                                status: 'resolved',
                                resolutionNotes:
                                  editResolution || 'Неисправность полностью устранена',
                                laborCost: Number(editLaborCost) || 0,
                                afterPhotoData: editAfterPhoto,
                                comment: editResolution || 'Работы завершены',
                              })
                            }
                            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Завершить и отметить выполненной</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                {/* Quality Rating & Resident Confirmation */}
                {(detail.ticket.status === 'resolved' || detail.ticket.status === 'closed') && (
                  <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-xs text-emerald-950">
                        <div className="font-semibold text-sm">
                          {detail.ticket.residentRating
                            ? 'Оценка качества выполненных работ'
                            : 'Работы выполнены — оцените качество'}
                        </div>
                        {detail.ticket.resolutionNotes && (
                          <p className="mt-1 text-emerald-900">
                            Заключение мастера: {detail.ticket.resolutionNotes}
                          </p>
                        )}
                      </div>
                      {user.role === 'resident' &&
                        getAllowedTicketTransitions(detail.ticket.status, 'resident').includes(
                          'closed'
                        ) &&
                        detail.ticket.residentRating && (
                          <button
                            type="button"
                            disabled={savingAction}
                            onClick={() =>
                              void handleUpdateTicket({
                                status: 'closed',
                                comment: 'Житель подтвердил выполнение работ',
                              })
                            }
                            className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg whitespace-nowrap shrink-0"
                          >
                            Закрыть заявку
                          </button>
                        )}
                    </div>

                    {detail.ticket.residentRating ? (
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1" aria-label={`Оценка ${detail.ticket.residentRating} из 5`}>
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`w-4 h-4 ${
                                star <= (detail.ticket.residentRating || 0)
                                  ? 'text-amber-500 fill-amber-500'
                                  : 'text-slate-300'
                              }`}
                            />
                          ))}
                          <span className="ml-1.5 text-xs font-mono font-semibold text-slate-800">
                            {detail.ticket.residentRating} / 5
                          </span>
                        </div>
                        {detail.ticket.residentFeedback && (
                          <p className="text-xs text-slate-700">
                            Отзыв жителя: «{detail.ticket.residentFeedback}»
                          </p>
                        )}
                      </div>
                    ) : user.role === 'resident' ? (
                      <div className="space-y-2.5 pt-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-slate-700 mr-1">Ваша оценка:</span>
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              aria-label={`Поставить ${star} из 5`}
                              onClick={() => setRatingValue(star)}
                              className="p-0.5 rounded hover:scale-110 transition-transform"
                            >
                              <Star
                                className={`w-5 h-5 ${
                                  star <= ratingValue
                                    ? 'text-amber-500 fill-amber-500'
                                    : 'text-slate-300'
                                }`}
                              />
                            </button>
                          ))}
                          <span className="text-xs font-mono font-semibold text-slate-800 ml-1">
                            {ratingValue} / 5
                          </span>
                        </div>
                        <textarea
                          rows={2}
                          value={ratingFeedback}
                          onChange={(e) => setRatingFeedback(e.target.value)}
                          placeholder="Комментарий о работе мастера (необязательно)..."
                          className="w-full px-3 py-2 text-xs bg-white border border-emerald-300 rounded-lg"
                        />
                        <button
                          type="button"
                          disabled={savingAction}
                          onClick={() =>
                            void handleUpdateTicket({
                              residentRating: ratingValue,
                              residentFeedback: ratingFeedback.trim() || undefined,
                              status:
                                detail.ticket.status === 'resolved' ? 'closed' : undefined,
                              comment: `Житель оценил качество работ на ${ratingValue}/5`,
                            })
                          }
                          className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg whitespace-nowrap"
                        >
                          {detail.ticket.status === 'resolved'
                            ? 'Отправить оценку и закрыть заявку'
                            : 'Сохранить оценку'}
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-600">
                        Житель ещё не оставил оценку по данной заявке.
                      </p>
                    )}
                  </div>
                )}

                {/* Used Warehouse Materials */}
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 mb-2.5">
                    Использованные материалы ({detail.materials.length})
                  </h4>
                  {detail.materials.length > 0 ? (
                    <div className="border border-slate-200 rounded-lg divide-y divide-slate-200 text-xs">
                      {detail.materials.map((m) => (
                        <div
                          key={m.id}
                          className="px-3.5 py-2.5 flex items-center justify-between gap-3"
                        >
                          <span className="text-slate-900 font-medium">{m.itemName}</span>
                          <span className="font-mono tabular-nums text-slate-600 shrink-0">
                            {m.quantityUsed} {m.unit} × {formatRubles(m.unitPriceAtUse)} ={' '}
                            <strong className="text-slate-900">{formatRubles(m.lineTotal)}</strong>
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">Материалы по заявке не списывались.</p>
                  )}

                  {canConsume && detail.ticket.status !== 'closed' && (
                    <form
                      onSubmit={handleConsumeMaterial}
                      className="mt-3 flex flex-wrap sm:flex-nowrap items-center gap-2"
                    >
                      <select
                        aria-label="Выбрать материал со склада"
                        value={consumeItemId}
                        onChange={(e) => setConsumeItemId(e.target.value)}
                        className="flex-1 px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                      >
                        <option value="">Списать материал со склада...</option>
                        {warehouseItems
                          .filter((w) => w.quantity > 0)
                          .map((w) => (
                            <option key={w.id} value={w.id}>
                              {w.name} (ост. {w.quantity} {w.unit})
                            </option>
                          ))}
                      </select>
                      <input
                        type="number"
                        min={1}
                        aria-label="Количество материала"
                        value={consumeQty}
                        onChange={(e) => setConsumeQty(e.target.value)}
                        className="w-20 px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg font-mono"
                      />
                      <button
                        type="submit"
                        disabled={!consumeItemId || savingAction}
                        className="px-3 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <PackagePlus className="w-3.5 h-3.5" />
                        <span>Списать</span>
                      </button>
                    </form>
                  )}
                </div>

                {/* In-Ticket Dialogue / Comments */}
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-slate-500" aria-hidden="true" />
                    <span>Диалог по заявке ({detail.comments.length})</span>
                  </h4>

                  {detail.comments.length === 0 ? (
                    <p className="text-xs text-slate-500 mb-3">
                      Сообщений пока нет. Напишите жителю или исполнителю для уточнения деталей.
                    </p>
                  ) : (
                    <div className="space-y-2.5 mb-3">
                      {detail.comments.map((c) => {
                        const isMine = c.authorId === user.id;
                        return (
                          <div
                            key={c.id}
                            className={`rounded-lg px-3.5 py-2.5 text-xs border ${
                              isMine
                                ? 'bg-blue-50/70 border-blue-200'
                                : 'bg-slate-50 border-slate-200'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-slate-900">
                                {c.authorName}{' '}
                                <span className="font-normal text-slate-500">
                                  ({ROLE_LABELS[c.authorRole]})
                                </span>
                              </span>
                              <span className="font-mono tabular-nums text-[11px] text-slate-400">
                                {formatDateTime(c.createdAt)}
                              </span>
                            </div>
                            <p className="mt-1 text-slate-800 leading-relaxed whitespace-pre-wrap">
                              {c.message}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <form onSubmit={handleSendComment} className="flex gap-2">
                    <input
                      type="text"
                      value={commentInput}
                      onChange={(e) => setCommentInput(e.target.value)}
                      placeholder="Написать сообщение по заявке..."
                      aria-label="Сообщение в диалог по заявке"
                      className="flex-1 px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                    />
                    <button
                      type="submit"
                      disabled={sendingComment || !commentInput.trim()}
                      className="px-3.5 py-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Отправить</span>
                    </button>
                  </form>
                </div>

                {/* History Timeline */}
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 mb-3">
                    История обработки заявки
                  </h4>
                  <ol className="divide-y divide-slate-200 border border-slate-200 rounded-lg">
                    {detail.history.map((h) => (
                      <li key={h.id} className="px-4 py-3 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-slate-900">{h.action}</span>
                          <span className="font-mono tabular-nums text-slate-500">
                            {formatDateTime(h.createdAt)}
                          </span>
                        </div>
                        <div className="text-slate-600 mt-0.5">
                          {h.actorName}
                          {h.comment ? ` · ${h.comment}` : ''}
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      </div>

      {/* Printable Work Completion Act Modal */}
      {showPrintAct && detail && (
        <TicketActPrintModal
          ticket={detail.ticket}
          materials={detail.materials}
          onClose={() => setShowPrintAct(false)}
        />
      )}
    </div>
  );
}
