'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Download, Star } from 'lucide-react';
import { formatRubles } from '@/lib/operations-logic';
import type { AnalyticsPayload } from './types';

interface AnalyticsViewProps {
  analytics: AnalyticsPayload | null;
  loading: boolean;
}

export function AnalyticsView({ analytics, loading }: AnalyticsViewProps) {
  function handleExportCsv() {
    if (!analytics) return;
    const header = [
      'Адрес МКД',
      'Индекс риска (0-100)',
      'Всего заявок',
      'Открытых заявок',
      'Аварий',
      'Просрочено ТО',
      'Эксплуатационные затраты (руб)',
    ];
    const rows = analytics.buildingRanking.map((b) => [
      `"${b.address}"`,
      b.riskIndex,
      b.ticketsCount,
      b.openTicketsCount,
      b.emergenciesCount,
      b.overdueMaintenanceCount,
      b.totalCost,
    ]);
    const csv = '\uFEFF' + [header.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `svodny-otchet-mkd-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  if (loading || !analytics) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
        Формирование аналитического отчёта...
      </div>
    );
  }

  const { kpis } = analytics;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Аналитика и отчёты</h1>

        <button
          type="button"
          onClick={handleExportCsv}
          className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg inline-flex items-center gap-2 whitespace-nowrap shrink-0 self-start sm:self-auto"
        >
          <Download className="w-4 h-4" />
          <span>Выгрузить отчёт (CSV)</span>
        </button>
      </div>

      {/* Executive KPI Strip */}
      <div className="bg-white border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">Соблюдение сроков SLA</div>
          <div
            className={`mt-2 text-3xl font-bold font-mono tabular-nums ${
              kpis.slaCompliancePercent >= 85
                ? 'text-emerald-700'
                : kpis.slaCompliancePercent >= 70
                  ? 'text-amber-700'
                  : 'text-red-700'
            }`}
          >
            {kpis.slaCompliancePercent}%
          </div>
          <div className="mt-1.5 text-xs text-slate-500">
            Среднее время:{' '}
            <span className="font-mono tabular-nums font-medium text-slate-700">
              {kpis.avgResolutionHours} ч
            </span>
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">Оценка качества жителями</div>
          <div className="mt-2 flex items-center gap-1.5">
            <Star className="w-6 h-6 text-amber-500 fill-amber-500 shrink-0" aria-hidden="true" />
            <span className="text-3xl font-bold font-mono tabular-nums text-slate-900">
              {kpis.avgResidentRating !== null ? kpis.avgResidentRating.toFixed(1) : '—'}
            </span>
            {kpis.avgResidentRating !== null && (
              <span className="text-xs font-mono text-slate-500">/ 5</span>
            )}
          </div>
          <div className="mt-1.5 text-xs text-slate-500">
            Оценено заявок:{' '}
            <span className="font-mono tabular-nums font-medium text-slate-700">
              {kpis.ratedTicketsCount}
            </span>
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">Эксплуатационные затраты</div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900">
            {formatRubles(kpis.totalOperationalExpenses)}
          </div>
          <div className="mt-1.5 text-xs text-slate-500">
            Ремонты, ТО, материалы и аварии
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">Аварийность фонда</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono tabular-nums text-slate-900">
              {kpis.totalEmergencies}
            </span>
            <span className="text-xs text-red-700 font-semibold">
              активных: {kpis.activeEmergencies}
            </span>
          </div>
          <div className="mt-1.5 text-xs text-slate-500">
            Реагирование:{' '}
            <span className="font-mono tabular-nums font-medium text-slate-700">
              {kpis.avgEmergencyResponseMinutes} мин
            </span>
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">Складские резервы</div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900">
            {formatRubles(kpis.warehouseTotalValue)}
          </div>
          <div className="mt-1.5 text-xs text-slate-500">
            В дефиците:{' '}
            <span
              className={`font-mono tabular-nums font-semibold ${
                kpis.lowStockItemsCount > 0 ? 'text-red-700' : 'text-emerald-700'
              }`}
            >
              {kpis.lowStockItemsCount}
            </span>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="text-base font-semibold text-slate-900">
            Заявки по категориям неисправностей
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 mb-4">
            Распределение обращений жителей по типам инженерных проблем
          </p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={analytics.ticketsByCategory}
                layout="vertical"
                margin={{ top: 4, right: 20, left: 10, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fontSize: 12, fill: '#64748B' }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={150}
                  tick={{ fontSize: 11, fill: '#334155' }}
                />
                <Tooltip
                  formatter={(val: unknown) => [`${val} заявок`, 'Количество']}
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #E2E8F0',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="count" fill="#1D4ED8" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="text-base font-semibold text-slate-900">
            Структура эксплуатационных затрат (₽)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 mb-4">
            Сопоставление расходов на аварии, плановое ТО, работы и материалы
          </p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={analytics.expensesBreakdown}
                margin={{ top: 4, right: 16, left: 10, bottom: 16 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12, fill: '#334155' }}
                  interval={0}
                  tickFormatter={(v: string) => {
                    if (v.startsWith('Аварийно')) return 'Аварии';
                    if (v.startsWith('Плановое')) return 'Плановое ТО';
                    if (v.startsWith('Текущий')) return 'Ремонт (труд)';
                    if (v.startsWith('Списанные')) return 'Материалы';
                    return v;
                  }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
                />
                <Tooltip
                  formatter={(val: unknown) => [formatRubles(Number(val)), 'Сумма']}
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #E2E8F0',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="value" fill="#0F172A" radius={[4, 4, 0, 0]} barSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* Problem Buildings & Problem Engineering Systems Tables */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <section className="xl:col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h2 className="text-base font-semibold text-slate-900">
              Рейтинг проблемных домов (индекс эксплуатационного риска)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Учитывает физический износ, число аварий, открытые заявки и просроченное ТО
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                  <th className="py-2.5 px-4">Адрес дома</th>
                  <th className="py-2.5 px-4 text-right whitespace-nowrap">Индекс риска</th>
                  <th className="py-2.5 px-4 text-right whitespace-nowrap">Заявки (откр.)</th>
                  <th className="py-2.5 px-4 text-right whitespace-nowrap">Аварии</th>
                  <th className="py-2.5 px-4 text-right whitespace-nowrap">Затраты</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {analytics.buildingRanking.map((b) => (
                  <tr key={b.buildingId} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-medium text-slate-900">{b.address}</td>
                    <td
                      className={`py-3 px-4 text-right font-mono tabular-nums font-bold ${
                        b.riskIndex >= 50
                          ? 'text-red-700'
                          : b.riskIndex >= 25
                            ? 'text-amber-700'
                            : 'text-emerald-700'
                      }`}
                    >
                      {b.riskIndex} / 100
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-slate-700">
                      {b.ticketsCount} ({b.openTicketsCount})
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-slate-700">
                      {b.emergenciesCount}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-xs font-semibold text-slate-900">
                      {formatRubles(b.totalCost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h2 className="text-base font-semibold text-slate-900">
              Проблемные инженерные системы
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Средний износ и число аварий по типам</p>
          </div>
          <div className="divide-y divide-slate-200">
            {analytics.problemSystems.map((sys) => (
              <div key={sys.systemType} className="px-5 py-3.5">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-medium text-slate-900">{sys.name}</span>
                  <span
                    className={`font-mono tabular-nums text-xs font-semibold ${
                      sys.avgWearPercent >= 60
                        ? 'text-red-700'
                        : sys.avgWearPercent >= 40
                          ? 'text-amber-700'
                          : 'text-emerald-700'
                    }`}
                  >
                    {sys.avgWearPercent}% износ
                  </span>
                </div>
                <div className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
                  Критических узлов: {sys.criticalCount} · Аварий: {sys.emergencyCount}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Brigade Performance & Quality Rating Leaderboard */}
      {analytics.brigadeRatings && analytics.brigadeRatings.length > 0 && (
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h2 className="text-base font-semibold text-slate-900">
              Рейтинг эксплуатационных бригад по оценкам жителей
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                  <th className="py-2.5 px-4">Бригада</th>
                  <th className="py-2.5 px-4 text-right whitespace-nowrap">Выполнено заявок</th>
                  <th className="py-2.5 px-4 text-right whitespace-nowrap">Получено оценок</th>
                  <th className="py-2.5 px-4 text-right whitespace-nowrap">Средняя оценка</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {analytics.brigadeRatings.map((br) => (
                  <tr key={br.brigadeId} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-medium text-slate-900">{br.brigadeName}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                      {br.completedCount}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                      {br.ratedCount}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">
                      {br.ratedCount > 0 && br.avgRating !== null ? (
                        <span className="inline-flex items-center justify-end gap-1 text-slate-900">
                          <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                          <span>{br.avgRating.toFixed(2)}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 font-sans font-normal">Нет оценок</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
