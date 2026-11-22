'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Plus, ShieldAlert, X } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import {
  canPerformAction,
  EMERGENCY_STATUS_LABELS,
  formatDateTime,
  formatRubles,
  SYSTEM_TYPE_LABELS,
} from '@/lib/operations-logic';
import type {
  BrigadeRecord,
  BuildingItem,
  EmergencyItem,
  UserProfile,
} from './types';

interface EmergenciesViewProps {
  user: UserProfile;
  emergencies: EmergencyItem[];
  buildings: BuildingItem[];
  brigades: BrigadeRecord[];
  createModalOpen: boolean;
  onSetCreateModalOpen: (open: boolean) => void;
  onRefresh: () => Promise<void>;
}

export function EmergenciesView({
  user,
  emergencies,
  buildings,
  brigades,
  createModalOpen,
  onSetCreateModalOpen,
  onRefresh,
}: EmergenciesViewProps) {
  const canManage = canPerformAction(user.role, 'manage_emergencies');
  const [filter, setFilter] = useState<'all' | 'active' | 'localized' | 'resolved'>('all');
  const showCreate = createModalOpen;
  const setShowCreate = onSetCreateModalOpen;

  const [buildingId, setBuildingId] = useState(buildings[0]?.id ? String(buildings[0].id) : '');
  const [systemType, setSystemType] = useState('water_supply');
  const [severity, setSeverity] = useState<'high' | 'critical'>('critical');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [affectedApartments, setAffectedApartments] = useState('');
  const [brigadeId, setBrigadeId] = useState(brigades[0]?.id ? String(brigades[0].id) : '');
  const [damageCost, setDamageCost] = useState('0');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await apiFetch('/api/emergencies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buildingId: Number(buildingId || buildings[0]?.id),
          systemType,
          severity,
          title,
          description,
          affectedApartments,
          brigadeId: brigadeId ? Number(brigadeId) : null,
          damageCost: Number(damageCost) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Не удалось зарегистрировать аварию');
        return;
      }
      setShowCreate(false);
      setTitle('');
      setDescription('');
      setAffectedApartments('');
      await onRefresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function updateEmergencyStatus(id: number, status: 'localized' | 'resolved') {
    await apiFetch('/api/emergencies', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    await onRefresh();
  }

  const filtered = emergencies.filter((e) => (filter === 'all' ? true : e.status === filter));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Аварии</h1>

        {canManage && (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="px-4 py-2.5 bg-red-700 hover:bg-red-800 text-white text-sm font-semibold rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Зарегистрировать аварию</span>
          </button>
        )}
      </div>

      <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
        {[
          { id: 'all', label: `Все (${emergencies.length})` },
          { id: 'active', label: 'Активные' },
          { id: 'localized', label: 'Локализованные' },
          { id: 'resolved', label: 'Ликвидированные' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id as 'all' | 'active' | 'localized' | 'resolved')}
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

      <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-200">
        {filtered.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            Аварийных ситуаций по выбранному фильтру нет.
          </p>
        ) : (
          filtered.map((em) => (
            <div key={em.id} className="p-5 flex flex-col lg:flex-row justify-between gap-5">
              <div className="space-y-1.5 min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span
                    className={`font-semibold ${
                      em.status === 'active'
                        ? 'text-red-700'
                        : em.status === 'localized'
                          ? 'text-amber-700'
                          : 'text-emerald-700'
                    }`}
                  >
                    {EMERGENCY_STATUS_LABELS[em.status]}
                  </span>
                  <span className="text-slate-400">·</span>
                  <span className="font-medium text-slate-700">
                    {em.severity === 'critical' ? 'Критический уровень' : 'Высокий уровень'}
                  </span>
                  <span className="text-slate-400">·</span>
                  <span className="text-slate-500">
                    {SYSTEM_TYPE_LABELS[em.systemType] || em.systemType}
                  </span>
                </div>

                <h2 className="text-base font-bold text-slate-900">{em.title}</h2>
                <div className="text-xs font-medium text-slate-700">
                  {em.buildingAddress} · Зона отключения: {em.affectedApartments}
                </div>
                <p className="text-sm text-slate-600">{em.description}</p>
                {em.rootCause && (
                  <p className="text-xs text-slate-500">Установленная причина: {em.rootCause}</p>
                )}
              </div>

              <div className="flex flex-col justify-between lg:items-end gap-3 shrink-0 text-xs">
                <div className="lg:text-right space-y-1">
                  <div className="font-mono tabular-nums text-slate-600">
                    Зафиксирована: {formatDateTime(em.reportedAt)}
                  </div>
                  <div className="text-slate-600">
                    Бригада: <strong className="text-slate-900">{em.brigadeName || '—'}</strong>
                  </div>
                  <div className="font-mono tabular-nums text-slate-600">
                    Реагирование: {em.responseMinutes ?? '—'} мин · Затраты:{' '}
                    <strong className="text-slate-900">{formatRubles(em.damageCost)}</strong>
                  </div>
                </div>

                {em.status !== 'resolved' && user.role !== 'resident' && (
                  <div className="flex items-center gap-2">
                    {em.status === 'active' && (
                      <button
                        type="button"
                        onClick={() => void updateEmergencyStatus(em.id, 'localized')}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                        <span>Локализовать</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void updateEmergencyStatus(em.id, 'resolved')}
                      className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Ликвидировать</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-700" />
                <h2 className="text-lg font-bold text-slate-900">Регистрация аварийной ситуации</h2>
              </div>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                    Инженерная система
                  </label>
                  <select
                    value={systemType}
                    onChange={(e) => setSystemType(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  >
                    {Object.entries(SYSTEM_TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Краткое описание аварии
                </label>
                <input
                  required
                  minLength={5}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Например: Прорыв магистрали отопления в подвале"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Подробности и предпринятые меры
                </label>
                <textarea
                  required
                  minLength={10}
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Зона отключения
                  </label>
                  <input
                    required
                    value={affectedApartments}
                    onChange={(e) => setAffectedApartments(e.target.value)}
                    placeholder="Подъезд №2 (кв. 37–72)"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Уровень опасности
                  </label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as 'high' | 'critical')}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  >
                    <option value="critical">Критический</option>
                    <option value="high">Высокий</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Аварийная бригада
                  </label>
                  <select
                    value={brigadeId}
                    onChange={(e) => setBrigadeId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  >
                    <option value="">Не назначена</option>
                    {brigades.map((br) => (
                      <option key={br.id} value={br.id}>
                        {br.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Оценка затрат (₽)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={damageCost}
                    onChange={(e) => setDamageCost(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                  />
                </div>
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
                  className="px-4 py-2 text-sm font-semibold text-white bg-red-700 hover:bg-red-800 rounded-lg"
                >
                  {submitting ? 'Сохранение...' : 'Зарегистрировать'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
