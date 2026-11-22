'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { canPerformAction, ROLE_LABELS, type UserRole } from '@/lib/operations-logic';
import type { BrigadeRecord, StaffUserRecord, UserProfile } from './types';

interface StaffViewProps {
  user: UserProfile;
  users: StaffUserRecord[];
  brigades: BrigadeRecord[];
  onRefresh: () => Promise<void>;
}

const SPEC_LABELS: Record<string, string> = {
  plumbing: 'Сантехника и отопление',
  electricity: 'Электроснабжение',
  elevator: 'Лифтовое хозяйство',
  general: 'Общестроительные работы',
  emergency: 'Аварийно-диспетчерская служба',
};

const BRIGADE_STATUS_LABELS: Record<string, string> = {
  available: 'Свободна',
  on_call: 'На дежурстве',
  busy: 'На выезде',
};

export function StaffView({ user, users, brigades, onRefresh }: StaffViewProps) {
  const canManage = canPerformAction(user.role, 'manage_staff');
  const [tab, setTab] = useState<'users' | 'brigades'>('users');
  const [showAddUser, setShowAddUser] = useState(false);
  const [showAddBrigade, setShowAddBrigade] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Add user form
  const [uFullName, setUFullName] = useState('');
  const [uEmail, setUEmail] = useState('');
  const [uPassword, setUPassword] = useState('');
  const [uPhone, setUPhone] = useState('');
  const [uRole, setURole] = useState<UserRole>('specialist');
  const [uPosition, setUPosition] = useState('');
  const [uBrigadeId, setUBrigadeId] = useState('');

  // Add brigade form
  const [bName, setBName] = useState('');
  const [bSpec, setBSpec] = useState('plumbing');
  const [bLeader, setBLeader] = useState('');
  const [bPhone, setBPhone] = useState('');

  async function handleRoleChange(userId: number, role: UserRole) {
    setError(null);
    const res = await apiFetch('/api/staff', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entityType: 'user', id: userId, role }),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error || 'Не удалось обновить роль');
      return;
    }
    await onRefresh();
  }

  async function handleBrigadeAssign(userId: number, brigadeId: string) {
    await apiFetch('/api/staff', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entityType: 'user',
        id: userId,
        brigadeId: brigadeId ? Number(brigadeId) : null,
      }),
    });
    await onRefresh();
  }

  async function handleToggleActive(userId: number, isActive: boolean) {
    setError(null);
    const res = await apiFetch('/api/staff', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entityType: 'user', id: userId, isActive }),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error || 'Не удалось изменить статус');
      return;
    }
    await onRefresh();
  }

  async function handleBrigadeStatus(brigadeId: number, status: string) {
    await apiFetch('/api/staff', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entityType: 'brigade', id: brigadeId, status }),
    });
    await onRefresh();
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await apiFetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType: 'user',
          fullName: uFullName,
          email: uEmail,
          password: uPassword,
          phone: uPhone || undefined,
          role: uRole,
          position: uPosition || undefined,
          brigadeId: uBrigadeId ? Number(uBrigadeId) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Не удалось создать пользователя');
        return;
      }
      setShowAddUser(false);
      setUFullName('');
      setUEmail('');
      setUPassword('');
      setUPosition('');
      await onRefresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateBrigade(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await apiFetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType: 'brigade',
          name: bName,
          specialization: bSpec,
          leaderName: bLeader,
          phone: bPhone,
        }),
      });
      if (res.ok) {
        setShowAddBrigade(false);
        setBName('');
        setBLeader('');
        setBPhone('');
        await onRefresh();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {user.role === 'dispatcher' ? 'Сотрудники и бригады' : 'Сотрудники и роли'}
        </h1>

        {canManage && (
          <div className="flex items-center gap-2">
            {tab === 'users' ? (
              <button
                type="button"
                onClick={() => setShowAddUser(true)}
                className="px-4 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg flex items-center gap-1.5 whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>Добавить пользователя</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowAddBrigade(true)}
                className="px-4 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg flex items-center gap-1.5 whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>Создать бригаду</span>
              </button>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="px-4 py-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg">
          {error}
        </div>
      )}

      <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
        <button
          type="button"
          onClick={() => setTab('users')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
            tab === 'users' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
          }`}
        >
          Пользователи и роли ({users.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('brigades')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
            tab === 'brigades' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
          }`}
        >
          Эксплуатационные бригады ({brigades.length})
        </button>
      </div>

      {tab === 'users' ? (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                  <th className="py-2.5 px-4">ФИО и контакты</th>
                  <th className="py-2.5 px-4">Должность / Объект</th>
                  <th className="py-2.5 px-4">Роль доступа</th>
                  <th className="py-2.5 px-4">Бригада</th>
                  <th className="py-2.5 px-4 text-right">Статус</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{u.fullName}</div>
                      <div className="text-xs text-slate-500 font-mono">
                        {u.email}
                        {u.phone ? ` · ${u.phone}` : ''}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600">
                      <div>{u.position || '—'}</div>
                      {u.buildingAddress && (
                        <div className="text-slate-500">
                          {u.buildingAddress}
                          {u.apartmentNumber ? `, кв. ${u.apartmentNumber}` : ''}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {canManage ? (
                        <select
                          aria-label={`Роль пользователя ${u.fullName}`}
                          value={u.role}
                          disabled={u.id === user.id}
                          onChange={(e) =>
                            void handleRoleChange(u.id, e.target.value as UserRole)
                          }
                          className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md disabled:bg-slate-50"
                        >
                          {Object.entries(ROLE_LABELS).map(([k, label]) => (
                            <option key={k} value={k}>
                              {label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs font-medium text-slate-700">
                          {ROLE_LABELS[u.role]}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {canManage && u.role === 'specialist' ? (
                        <select
                          aria-label={`Бригада сотрудника ${u.fullName}`}
                          value={u.brigadeId ? String(u.brigadeId) : ''}
                          onChange={(e) => void handleBrigadeAssign(u.id, e.target.value)}
                          className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                        >
                          <option value="">Без бригады</option>
                          {brigades.map((br) => (
                            <option key={br.id} value={br.id}>
                              {br.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs text-slate-500">{u.brigadeName || '—'}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      {canManage && u.id !== user.id ? (
                        <button
                          type="button"
                          onClick={() => void handleToggleActive(u.id, !u.isActive)}
                          className={`text-xs font-semibold ${
                            u.isActive
                              ? 'text-emerald-700 hover:text-red-700'
                              : 'text-red-700 hover:text-emerald-700'
                          }`}
                        >
                          {u.isActive ? 'Активен' : 'Заблокирован'}
                        </button>
                      ) : (
                        <span className="text-xs font-semibold text-emerald-700">Активен</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-200">
          {brigades.map((br) => (
            <div
              key={br.id}
              className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div>
                <div className="text-xs text-slate-500">
                  {SPEC_LABELS[br.specialization] || br.specialization} · Специалистов:{' '}
                  <span className="font-mono tabular-nums font-semibold text-slate-700">
                    {br.membersCount}
                  </span>
                </div>
                <div className="text-base font-bold text-slate-900 mt-0.5">{br.name}</div>
                <div className="text-xs text-slate-600 mt-1">
                  Бригадир: {br.leaderName} · <span className="font-mono">{br.phone}</span>
                </div>
              </div>

              <div className="shrink-0">
                {canManage ? (
                  <select
                    aria-label={`Статус бригады ${br.name}`}
                    value={br.status}
                    onChange={(e) => void handleBrigadeStatus(br.id, e.target.value)}
                    className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-lg"
                  >
                    {Object.entries(BRIGADE_STATUS_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-xs font-semibold text-slate-700">
                    {BRIGADE_STATUS_LABELS[br.status] || br.status}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Add User */}
      {showAddUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">Новый пользователь системы</h2>
              <button
                type="button"
                aria-label="Закрыть окно"
                onClick={() => setShowAddUser(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">ФИО</label>
                <input
                  required
                  value={uFullName}
                  onChange={(e) => setUFullName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={uEmail}
                    onChange={(e) => setUEmail(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Пароль</label>
                  <input
                    type="password"
                    minLength={6}
                    required
                    value={uPassword}
                    onChange={(e) => setUPassword(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Роль</label>
                  <select
                    value={uRole}
                    onChange={(e) => setURole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  >
                    {Object.entries(ROLE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Телефон</label>
                  <input
                    value={uPhone}
                    onChange={(e) => setUPhone(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Должность</label>
                <input
                  value={uPosition}
                  onChange={(e) => setUPosition(e.target.value)}
                  placeholder="Например: Техник-смотритель"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              {uRole === 'specialist' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Бригада</label>
                  <select
                    value={uBrigadeId}
                    onChange={(e) => setUBrigadeId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  >
                    <option value="">Без бригады</option>
                    {brigades.map((br) => (
                      <option key={br.id} value={br.id}>
                        {br.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddUser(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg"
                >
                  Создать
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Brigade */}
      {showAddBrigade && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">Новая эксплуатационная бригада</h2>
              <button
                type="button"
                aria-label="Закрыть окно"
                onClick={() => setShowAddBrigade(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateBrigade} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Название бригады
                </label>
                <input
                  required
                  value={bName}
                  onChange={(e) => setBName(e.target.value)}
                  placeholder="Теплотехническая бригада №5"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Специализация
                </label>
                <select
                  value={bSpec}
                  onChange={(e) => setBSpec(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                >
                  {Object.entries(SPEC_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Бригадир (ФИО)
                </label>
                <input
                  required
                  value={bLeader}
                  onChange={(e) => setBLeader(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Контактный телефон
                </label>
                <input
                  required
                  value={bPhone}
                  onChange={(e) => setBPhone(e.target.value)}
                  placeholder="+7 (495) 210-44-05"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddBrigade(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg"
                >
                  Создать
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
