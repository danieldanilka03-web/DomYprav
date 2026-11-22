'use client';

import { useState } from 'react';
import { CheckCheck, Plus, X } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { formatDateTime } from '@/lib/operations-logic';
import type { BuildingItem, NotificationRecord, UserProfile } from './types';

interface NotificationsViewProps {
  user: UserProfile;
  buildings: BuildingItem[];
  notifications: NotificationRecord[];
  createModalOpen: boolean;
  onSetCreateModalOpen: (open: boolean) => void;
  onRefresh: () => Promise<void>;
}

const NOTIF_TYPE_LABELS: Record<string, string> = {
  emergency: 'Авария',
  ticket: 'Заявка',
  maintenance: 'Плановое ТО',
  inventory: 'Склад',
  system: 'Объявление',
};

export function NotificationsView({
  user,
  buildings,
  notifications,
  createModalOpen,
  onSetCreateModalOpen,
  onRefresh,
}: NotificationsViewProps) {
  const canBroadcast = user.role === 'admin' || user.role === 'dispatcher';
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState<'system' | 'maintenance' | 'emergency'>('system');
  const [targetRole, setTargetRole] = useState<'resident' | 'specialist' | 'all'>('resident');
  const [buildingId, setBuildingId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function markOneRead(id: number) {
    await apiFetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    await onRefresh();
  }

  async function markAllRead() {
    await apiFetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markAll: true }),
    });
    await onRefresh();
  }

  async function handlePublish(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await apiFetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          message,
          type,
          targetRole,
          buildingId: buildingId ? Number(buildingId) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Не удалось отправить оповещение');
        return;
      }
      setTitle('');
      setMessage('');
      setBuildingId('');
      onSetCreateModalOpen(false);
      await onRefresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Уведомления</h1>

        <div className="flex flex-wrap items-center gap-2.5">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => void markAllRead()}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <CheckCheck className="w-4 h-4 text-blue-700" />
              <span>Прочитать все ({unreadCount})</span>
            </button>
          )}
          {canBroadcast && (
            <button
              type="button"
              onClick={() => onSetCreateModalOpen(true)}
              className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Отправить оповещение</span>
            </button>
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-200">
        {notifications.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">Уведомлений пока нет.</p>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              className={`p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4 ${
                n.isRead ? 'bg-white' : 'bg-blue-50/35'
              }`}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span
                    className={`font-semibold ${
                      n.type === 'emergency'
                        ? 'text-red-700'
                        : n.type === 'inventory'
                          ? 'text-amber-700'
                          : 'text-blue-700'
                    }`}
                  >
                    {NOTIF_TYPE_LABELS[n.type] || n.type}
                  </span>
                  {n.buildingAddress && (
                    <>
                      <span className="text-slate-300">·</span>
                      <span className="text-slate-600">{n.buildingAddress}</span>
                    </>
                  )}
                  <span className="text-slate-300">·</span>
                  <span className="font-mono tabular-nums text-slate-500">
                    {formatDateTime(n.createdAt)}
                  </span>
                </div>
                <h2 className="mt-1 text-base font-semibold text-slate-900">{n.title}</h2>
                <p className="mt-1 text-sm text-slate-600 leading-relaxed">{n.message}</p>
              </div>

              {!n.isRead && (
                <button
                  type="button"
                  onClick={() => void markOneRead(n.id)}
                  className="text-xs font-semibold text-blue-700 hover:underline whitespace-nowrap shrink-0 self-start"
                >
                  Прочитано
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {createModalOpen && canBroadcast && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">Новое оповещение</h2>
              <button
                type="button"
                aria-label="Закрыть окно"
                onClick={() => onSetCreateModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="mb-4 px-3.5 py-2.5 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
                {error}
              </div>
            )}

            <form onSubmit={handlePublish} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Кому отправить
                  </label>
                  <select
                    value={targetRole}
                    onChange={(e) =>
                      setTargetRole(e.target.value as 'resident' | 'specialist' | 'all')
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="resident">Жителям</option>
                    <option value="specialist">Специалистам</option>
                    <option value="all">Всем пользователям</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Тип оповещения
                  </label>
                  <select
                    value={type}
                    onChange={(e) =>
                      setType(e.target.value as 'system' | 'maintenance' | 'emergency')
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="system">Объявление</option>
                    <option value="maintenance">Плановые работы</option>
                    <option value="emergency">Аварийное отключение</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Дом (необязательно — если пусто, всем домам)
                </label>
                <select
                  value={buildingId}
                  onChange={(e) => setBuildingId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  <option value="">Все дома</option>
                  {buildings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.address}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Заголовок</label>
                <input
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Например: Плановое отключение ГВС 24 ноября"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Сообщение</label>
                <textarea
                  required
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Укажите время работ, затронутые подъезды и контакты диспетчерской..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => onSetCreateModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-700 border border-slate-300 rounded-lg"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-60 rounded-lg"
                >
                  {submitting ? 'Отправка...' : 'Опубликовать'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
