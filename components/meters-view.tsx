'use client';

import { useState } from 'react';
import { Droplets, Flame, Plus, Zap } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import {
  formatDateTime,
  METER_TYPE_LABELS,
  METER_UNIT_LABELS,
} from '@/lib/operations-logic';
import type { BuildingItem, MeterReadingRecord, UserProfile } from './types';

interface MetersViewProps {
  user: UserProfile;
  readings: MeterReadingRecord[];
  buildings: BuildingItem[];
  onRefresh: () => Promise<void>;
}

const METER_CARDS: Array<{
  type: 'cold_water' | 'hot_water' | 'electricity';
  label: string;
  unit: string;
  icon: typeof Droplets;
  accent: string;
}> = [
  {
    type: 'cold_water',
    label: 'Холодная вода (ХВС)',
    unit: 'м³',
    icon: Droplets,
    accent: 'text-blue-700 bg-blue-50',
  },
  {
    type: 'hot_water',
    label: 'Горячая вода (ГВС)',
    unit: 'м³',
    icon: Flame,
    accent: 'text-amber-700 bg-amber-50',
  },
  {
    type: 'electricity',
    label: 'Электроэнергия',
    unit: 'кВт·ч',
    icon: Zap,
    accent: 'text-slate-800 bg-slate-100',
  },
];

export function MetersView({ user, readings, buildings, onRefresh }: MetersViewProps) {
  const isResident = user.role === 'resident';
  const [meterType, setMeterType] = useState<'cold_water' | 'hot_water' | 'electricity'>(
    'cold_water'
  );
  const [value, setValue] = useState('');
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const [buildingId, setBuildingId] = useState<string>(
    user.buildingId ? String(user.buildingId) : buildings[0]?.id ? String(buildings[0].id) : ''
  );
  const [apartmentNumber, setApartmentNumber] = useState(user.apartmentNumber || '');
  const [filterBuilding, setFilterBuilding] = useState<string>('all');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setSubmitting(true);
    try {
      const res = await apiFetch('/api/meters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meterType,
          value: Number(value),
          period,
          ...(!isResident
            ? {
                buildingId: Number(buildingId),
                apartmentNumber,
              }
            : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Не удалось передать показания');
        return;
      }
      setValue('');
      setSuccessMsg(`Показания (${METER_TYPE_LABELS[meterType]}) успешно приняты.`);
      await onRefresh();
    } finally {
      setSubmitting(false);
    }
  }

  const visibleReadings = readings.filter((r) =>
    filterBuilding === 'all' ? true : String(r.buildingId) === filterBuilding
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {isResident ? 'Показания счётчиков' : 'Учёт показаний счётчиков'}
        </h1>
        {!isResident && (
          <select
            aria-label="Фильтр по дому"
            value={filterBuilding}
            onChange={(e) => setFilterBuilding(e.target.value)}
            className="px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
          >
            <option value="all">Все дома</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.address}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Latest readings summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {METER_CARDS.map((card) => {
          const Icon = card.icon;
          const latest = visibleReadings.find((r) => r.meterType === card.type);
          return (
            <div
              key={card.type}
              className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-600">{card.label}</span>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${card.accent}`}>
                  <Icon className="w-4 h-4" aria-hidden="true" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                  {latest ? `${latest.value.toLocaleString('ru-RU')} ${card.unit}` : 'Нет данных'}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {latest ? (
                    <>
                      Период <span className="font-mono">{latest.period}</span>
                      {latest.consumption !== null && (
                        <>
                          {' '}
                          · расход{' '}
                          <strong className="font-mono text-slate-700">
                            +{latest.consumption} {card.unit}
                          </strong>
                        </>
                      )}
                    </>
                  ) : (
                    'Передайте первые показания ниже'
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Submission form */}
      <section className="bg-white border border-slate-200 rounded-xl p-5">
        <h2 className="text-base font-semibold text-slate-900 mb-4">Передать новые показания</h2>

        {error && (
          <div className="mb-4 px-4 py-2.5 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="mb-4 px-4 py-2.5 text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg">
            {successMsg}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className={`grid grid-cols-1 sm:grid-cols-2 gap-3 items-end ${
            isResident ? 'lg:grid-cols-4' : 'lg:grid-cols-6'
          }`}
        >
          {!isResident && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Дом</label>
                <select
                  required
                  value={buildingId}
                  onChange={(e) => setBuildingId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  {buildings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.address}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Квартира</label>
                <input
                  required
                  value={apartmentNumber}
                  onChange={(e) => setApartmentNumber(e.target.value)}
                  placeholder="42"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
            </>
          )}

          <div>
            <label htmlFor="meter-type" className="block text-xs font-medium text-slate-700 mb-1">
              Прибор учёта
            </label>
            <select
              id="meter-type"
              value={meterType}
              onChange={(e) =>
                setMeterType(e.target.value as 'cold_water' | 'hot_water' | 'electricity')
              }
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
            >
              <option value="cold_water">Холодная вода (ХВС, м³)</option>
              <option value="hot_water">Горячая вода (ГВС, м³)</option>
              <option value="electricity">Электроэнергия (кВт·ч)</option>
            </select>
          </div>

          <div>
            <label htmlFor="meter-period" className="block text-xs font-medium text-slate-700 mb-1">
              Расчётный месяц
            </label>
            <input
              id="meter-period"
              type="month"
              required
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
            />
          </div>

          <div>
            <label htmlFor="meter-value" className="block text-xs font-medium text-slate-700 mb-1">
              Текущее показание ({METER_UNIT_LABELS[meterType]})
            </label>
            <input
              id="meter-value"
              type="number"
              step="0.01"
              min="0"
              required
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Например: 142.5"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2.5 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-semibold rounded-lg inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>{submitting ? 'Сохранение...' : 'Передать'}</span>
          </button>
        </form>
      </section>

      {/* History Table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900">
            История показаний ({visibleReadings.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                <th className="py-3 px-4">Период</th>
                {!isResident && <th className="py-3 px-4">Объект / Кв.</th>}
                <th className="py-3 px-4">Прибор учёта</th>
                <th className="py-3 px-4 text-right">Показание</th>
                <th className="py-3 px-4 text-right">Расход за период</th>
                <th className="py-3 px-4 text-right">Дата передачи</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {visibleReadings.length === 0 ? (
                <tr>
                  <td colSpan={isResident ? 5 : 6} className="p-8 text-center text-slate-500">
                    Показания счётчиков ещё не передавались.
                  </td>
                </tr>
              ) : (
                visibleReadings.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono tabular-nums text-xs font-semibold text-slate-900">
                      {r.period}
                    </td>
                    {!isResident && (
                      <td className="py-3 px-4 text-xs text-slate-700">
                        {r.buildingAddress}, кв. {r.apartmentNumber}
                      </td>
                    )}
                    <td className="py-3 px-4 text-slate-800">
                      {METER_TYPE_LABELS[r.meterType] || r.meterType}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {r.value.toLocaleString('ru-RU')} {METER_UNIT_LABELS[r.meterType]}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-emerald-700 font-medium">
                      {r.consumption !== null
                        ? `+${r.consumption} ${METER_UNIT_LABELS[r.meterType]}`
                        : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-slate-500">
                      {formatDateTime(r.submittedAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
