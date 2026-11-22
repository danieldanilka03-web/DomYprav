'use client';

import { useState } from 'react';
import { Check, Play, Plus, X } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import {
  canPerformAction,
  formatRubles,
  formatShortDate,
  FREQUENCY_LABELS,
  MAINTENANCE_STATUS_LABELS,
} from '@/lib/operations-logic';
import type {
  BrigadeRecord,
  BuildingItem,
  MaintenancePlanItem,
  UserProfile,
} from './types';

interface MaintenanceViewProps {
  user: UserProfile;
  plans: MaintenancePlanItem[];
  buildings: BuildingItem[];
  brigades: BrigadeRecord[];
  onRefresh: () => Promise<void>;
}

export function MaintenanceView({
  user,
  plans,
  buildings,
  brigades,
  onRefresh,
}: MaintenanceViewProps) {
  const canManage = canPerformAction(user.role, 'manage_maintenance');
  const canUpdateStatus = user.role !== 'resident';

  const [filter, setFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [buildingId, setBuildingId] = useState(buildings[0]?.id ? String(buildings[0].id) : '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [frequency, setFrequency] = useState('quarterly');
  const [scheduledDate, setScheduledDate] = useState('2026-12-15');
  const [brigadeId, setBrigadeId] = useState('');
  const [estimatedCost, setEstimatedCost] = useState('15000');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await apiFetch('/api/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buildingId: Number(buildingId || buildings[0]?.id),
          title,
          description,
          frequency,
          scheduledDate,
          brigadeId: brigadeId ? Number(brigadeId) : null,
          estimatedCost: Number(estimatedCost) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Не удалось создать план ТО');
        return;
      }
      setShowCreate(false);
      setTitle('');
      setDescription('');
      await onRefresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(id: number, status: string) {
    await apiFetch('/api/maintenance', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    await onRefresh();
  }

  const filtered = plans.filter((p) => (filter === 'all' ? true : p.status === filter));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Плановое ТО</h1>

        {canManage && (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="px-4 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Запланировать ТО</span>
          </button>
        )}
      </div>

      <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
        {[
          { id: 'all', label: `Все (${plans.length})` },
          { id: 'planned', label: 'Запланировано' },
          { id: 'in_progress', label: 'Выполняется' },
          { id: 'overdue', label: 'Просрочено' },
          { id: 'completed', label: 'Выполнено' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              filter === tab.id
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            Регламентных работ по выбранному фильтру не найдено.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                  <th className="py-2.5 px-4 whitespace-nowrap">Плановая дата</th>
                  <th className="py-2.5 px-4">Регламентные работы и объект</th>
                  <th className="py-2.5 px-4 whitespace-nowrap">Периодичность</th>
                  <th className="py-2.5 px-4 whitespace-nowrap">Бригада</th>
                  <th className="py-2.5 px-4 text-right whitespace-nowrap">Бюджет</th>
                  <th className="py-2.5 px-4 whitespace-nowrap">Статус</th>
                  {canUpdateStatus && (
                    <th className="py-2.5 px-4 text-right whitespace-nowrap">Действие</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="py-3.5 px-4 font-mono tabular-nums text-xs text-slate-700 whitespace-nowrap">
                      {formatShortDate(p.scheduledDate)}
                    </td>
                    <td className="py-3.5 px-4 max-w-md">
                      <div className="font-semibold text-slate-900">{p.title}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {p.buildingAddress}
                        {p.systemName ? ` · ${p.systemName}` : ''}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-600 whitespace-nowrap">
                      {FREQUENCY_LABELS[p.frequency] || p.frequency}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-600 whitespace-nowrap">
                      {p.brigadeName || 'Не назначена'}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-xs text-slate-900 whitespace-nowrap">
                      {formatRubles(p.estimatedCost)}
                    </td>
                    <td className="py-3.5 px-4 text-xs font-semibold whitespace-nowrap">
                      <span
                        className={
                          p.status === 'overdue'
                            ? 'text-red-700'
                            : p.status === 'completed'
                              ? 'text-emerald-700'
                              : p.status === 'in_progress'
                                ? 'text-blue-700'
                                : 'text-slate-700'
                        }
                      >
                        {MAINTENANCE_STATUS_LABELS[p.status]}
                      </span>
                    </td>
                    {canUpdateStatus && (
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {(p.status === 'planned' || p.status === 'overdue') && (
                          <button
                            type="button"
                            onClick={() => void handleStatusChange(p.id, 'in_progress')}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900"
                          >
                            <Play className="w-3.5 h-3.5" />
                            <span>Начать</span>
                          </button>
                        )}
                        {p.status === 'in_progress' && (
                          <button
                            type="button"
                            onClick={() => void handleStatusChange(p.id, 'completed')}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-900"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Завершить</span>
                          </button>
                        )}
                        {p.status === 'completed' && (
                          <span className="text-xs font-mono text-slate-400">
                            {formatShortDate(p.completedDate)}
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">
                Запланировать техническое обслуживание
              </h2>
              <button
                type="button"
                aria-label="Закрыть окно"
                onClick={() => setShowCreate(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {error && (
              <div className="mb-4 px-3.5 py-2.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg">
                {error}
              </div>
            )}
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Дом</label>
                <select
                  required
                  value={buildingId || buildings[0]?.id || ''}
                  onChange={(e) => setBuildingId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                >
                  {buildings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.address}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Наименование регламентных работ
                </label>
                <input
                  required
                  minLength={5}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Например: Промывка теплообменников ИТП"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Состав работ
                </label>
                <textarea
                  required
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Перечень проверяемых узлов и операций..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Периодичность
                  </label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  >
                    {Object.entries(FREQUENCY_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Дата</label>
                  <input
                    type="date"
                    required
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Смета (₽)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={estimatedCost}
                    onChange={(e) => setEstimatedCost(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Ответственная бригада
                </label>
                <select
                  value={brigadeId}
                  onChange={(e) => setBrigadeId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                >
                  <option value="">Выбрать позже</option>
                  {brigades.map((br) => (
                    <option key={br.id} value={br.id}>
                      {br.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg"
                >
                  {submitting ? 'Сохранение...' : 'Запланировать'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
