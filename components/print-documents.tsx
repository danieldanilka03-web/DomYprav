'use client';

import { Printer, X } from 'lucide-react';
import {
  CATEGORY_LABELS,
  CONDITION_LABELS,
  EMERGENCY_STATUS_LABELS,
  formatDateTime,
  formatRubles,
  formatShortDate,
  MAINTENANCE_STATUS_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
  SYSTEM_TYPE_LABELS,
} from '@/lib/operations-logic';
import type {
  BuildingItem,
  EmergencyItem,
  EngineeringSystemItem,
  MaintenancePlanItem,
  TicketItem,
  TicketMaterialUsage,
} from './types';

interface TicketActPrintModalProps {
  ticket: TicketItem;
  materials: TicketMaterialUsage[];
  onClose: () => void;
}

export function TicketActPrintModal({
  ticket,
  materials,
  onClose,
}: TicketActPrintModalProps) {
  const materialsCost = materials.reduce((s, m) => s + m.lineTotal, 0);
  const totalCost = ticket.laborCost + materialsCost;

  return (
    <div className="print-sheet-wrapper fixed inset-0 z-50 bg-slate-900/60 flex items-start justify-center p-4 sm:p-8 overflow-y-auto">
      <div className="print-sheet bg-white rounded-xl border border-slate-200 w-full max-w-3xl p-6 sm:p-10 shadow-xl my-auto">
        {/* Screen-only toolbar */}
        <div className="no-print flex items-center justify-between gap-4 pb-5 mb-6 border-b border-slate-200">
          <div className="text-sm font-semibold text-slate-900">
            Предпросмотр документа для печати / PDF
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" />
              <span>Печать / Сохранить PDF</span>
            </button>
            <button
              type="button"
              aria-label="Закрыть предпросмотр"
              onClick={onClose}
              className="p-2 text-slate-500 hover:text-slate-900 rounded-lg border border-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable A4 Act Body */}
        <div className="text-slate-900 space-y-6">
          <div className="flex items-start justify-between gap-4 border-b-2 border-slate-900 pb-4">
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-500">
                Управляющая организация «ДомоУправ»
              </div>
              <h1 className="text-xl font-bold mt-1">
                АКТ ВЫПОЛНЕННЫХ РАБОТ № {ticket.ticketNumber}
              </h1>
            </div>
            <div className="text-right text-xs font-mono tabular-nums text-slate-700">
              <div>Дата формирования: {formatShortDate(new Date())}</div>
              <div>Статус: {STATUS_LABELS[ticket.status]}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="space-y-1.5">
              <div>
                <span className="text-slate-500">Объект (МКД):</span>{' '}
                <strong>{ticket.buildingAddress}</strong>
              </div>
              <div>
                <span className="text-slate-500">Квартира / помещение:</span>{' '}
                <strong>{ticket.apartmentNumber || 'Общедомовое имущество'}</strong>
              </div>
              <div>
                <span className="text-slate-500">Заявитель:</span>{' '}
                <strong>{ticket.authorName}</strong>
              </div>
              <div>
                <span className="text-slate-500">Категория:</span>{' '}
                {CATEGORY_LABELS[ticket.category] || ticket.category}
              </div>
            </div>
            <div className="space-y-1.5">
              <div>
                <span className="text-slate-500">Дата обращения:</span>{' '}
                <span className="font-mono tabular-nums">{formatDateTime(ticket.createdAt)}</span>
              </div>
              <div>
                <span className="text-slate-500">Завершение работ:</span>{' '}
                <span className="font-mono tabular-nums">
                  {ticket.completedAt ? formatDateTime(ticket.completedAt) : 'В процессе'}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Исполнитель:</span>{' '}
                <strong>{ticket.assigneeName || 'Не назначен'}</strong>
              </div>
              <div>
                <span className="text-slate-500">Бригада:</span>{' '}
                {ticket.brigadeName || '—'} (приоритет: {PRIORITY_LABELS[ticket.priority]})
              </div>
            </div>
          </div>

          <div className="border border-slate-300 rounded-lg p-4 space-y-2 text-sm">
            <div className="font-semibold">Суть обращения: {ticket.title}</div>
            <p className="text-slate-700">{ticket.description}</p>
            {ticket.resolutionNotes && (
              <div className="pt-2 mt-2 border-t border-slate-200">
                <div className="font-semibold">Выполненные работы и заключение мастера:</div>
                <p className="text-slate-700 mt-0.5">{ticket.resolutionNotes}</p>
              </div>
            )}
          </div>

          <div>
            <h2 className="text-sm font-bold mb-2">
              Использованные материалы и расчёт стоимости
            </h2>
            <table className="w-full text-left border-collapse text-xs border border-slate-300">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300">
                  <th className="py-2 px-3 border-r border-slate-300">Наименование</th>
                  <th className="py-2 px-3 border-r border-slate-300 text-right">Кол-во</th>
                  <th className="py-2 px-3 border-r border-slate-300 text-right">Цена</th>
                  <th className="py-2 px-3 text-right">Сумма</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {materials.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-2.5 px-3 text-slate-500">
                      Расходные материалы со склада не списывались
                    </td>
                  </tr>
                ) : (
                  materials.map((m) => (
                    <tr key={m.id}>
                      <td className="py-2 px-3 border-r border-slate-300">{m.itemName}</td>
                      <td className="py-2 px-3 border-r border-slate-300 text-right font-mono tabular-nums">
                        {m.quantityUsed} {m.unit}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-300 text-right font-mono tabular-nums">
                        {formatRubles(m.unitPriceAtUse)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold">
                        {formatRubles(m.lineTotal)}
                      </td>
                    </tr>
                  ))
                )}
                <tr className="bg-slate-50">
                  <td colSpan={3} className="py-2 px-3 border-r border-slate-300 font-medium">
                    Стоимость эксплуатационных работ (труд)
                  </td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold">
                    {formatRubles(ticket.laborCost)}
                  </td>
                </tr>
                <tr className="bg-slate-100 font-bold text-sm">
                  <td colSpan={3} className="py-2.5 px-3 border-r border-slate-300">
                    ИТОГО ПО АКТУ
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                    {formatRubles(totalCost)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {ticket.residentRating && (
            <div className="text-xs border border-slate-300 rounded-lg p-3">
              <span className="font-semibold">
                Оценка качества жителем: {ticket.residentRating} из 5
              </span>
              {ticket.residentFeedback && (
                <span className="text-slate-700"> — «{ticket.residentFeedback}»</span>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-8 pt-8 text-xs">
            <div>
              <div className="text-slate-500 mb-6">Работы выполнил (представитель УК):</div>
              <div className="border-b border-slate-900 pb-1 flex justify-between">
                <span>_________________</span>
                <span>{ticket.assigneeName || '________________'}</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-1">подпись / расшифровка</div>
            </div>
            <div>
              <div className="text-slate-500 mb-6">Претензий не имею (заявитель / житель):</div>
              <div className="border-b border-slate-900 pb-1 flex justify-between">
                <span>_________________</span>
                <span>{ticket.authorName}</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-1">подпись / расшифровка</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface BuildingPassportPrintModalProps {
  building: BuildingItem;
  systems: EngineeringSystemItem[];
  maintenancePlans: MaintenancePlanItem[];
  emergencies: EmergencyItem[];
  onClose: () => void;
}

export function BuildingPassportPrintModal({
  building,
  systems,
  maintenancePlans,
  emergencies,
  onClose,
}: BuildingPassportPrintModalProps) {
  return (
    <div className="print-sheet-wrapper fixed inset-0 z-50 bg-slate-900/60 flex items-start justify-center p-4 sm:p-8 overflow-y-auto">
      <div className="print-sheet bg-white rounded-xl border border-slate-200 w-full max-w-3xl p-6 sm:p-10 shadow-xl my-auto">
        <div className="no-print flex items-center justify-between gap-4 pb-5 mb-6 border-b border-slate-200">
          <div className="text-sm font-semibold text-slate-900">
            Предпросмотр технического паспорта для печати / PDF
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" />
              <span>Печать / Сохранить PDF</span>
            </button>
            <button
              type="button"
              aria-label="Закрыть предпросмотр"
              onClick={onClose}
              className="p-2 text-slate-500 hover:text-slate-900 rounded-lg border border-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="text-slate-900 space-y-6">
          <div className="flex items-start justify-between gap-4 border-b-2 border-slate-900 pb-4">
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-500">
                Управляющая организация «ДомоУправ»
              </div>
              <h1 className="text-xl font-bold mt-1">
                ТЕХНИЧЕСКИЙ ПАСПОРТ МНОГОКВАРТИРНОГО ДОМА
              </h1>
              <div className="text-sm font-semibold mt-1">{building.address}</div>
            </div>
            <div className="text-right text-xs font-mono tabular-nums text-slate-700">
              <div>Дата выписки: {formatShortDate(new Date())}</div>
              <div>Район: {building.district}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs border border-slate-300 rounded-lg p-4">
            <div>
              <span className="text-slate-500 block">Год постройки</span>
              <strong className="font-mono text-sm">{building.yearBuilt}</strong>
            </div>
            <div>
              <span className="text-slate-500 block">Этажность / Подъезды</span>
              <strong className="font-mono text-sm">
                {building.floors} эт. / {building.entrances} под.
              </strong>
            </div>
            <div>
              <span className="text-slate-500 block">Общая площадь</span>
              <strong className="font-mono text-sm">
                {building.totalAreaSqm.toLocaleString('ru-RU')} м²
              </strong>
            </div>
            <div>
              <span className="text-slate-500 block">Помещений</span>
              <strong className="font-mono text-sm">{building.apartmentsCount}</strong>
            </div>
            <div>
              <span className="text-slate-500 block">В управлении с</span>
              <strong className="font-mono text-sm">
                {formatShortDate(building.managementSince)}
              </strong>
            </div>
            <div>
              <span className="text-slate-500 block">Индекс состояния</span>
              <strong className="font-mono text-sm">
                {building.conditionScore}% ({CONDITION_LABELS[building.conditionStatus]})
              </strong>
            </div>
          </div>

          <div>
            <h2 className="text-sm font-bold mb-2">
              1. Состояние инженерных систем ({systems.length})
            </h2>
            <table className="w-full text-left border-collapse text-xs border border-slate-300">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300">
                  <th className="py-2 px-3 border-r border-slate-300">Система</th>
                  <th className="py-2 px-3 border-r border-slate-300">Состояние</th>
                  <th className="py-2 px-3 border-r border-slate-300 text-right">Износ</th>
                  <th className="py-2 px-3 text-right">След. осмотр</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {systems.map((s) => (
                  <tr key={s.id}>
                    <td className="py-2 px-3 border-r border-slate-300">
                      <div className="font-medium">{s.name}</div>
                      <div className="text-[11px] text-slate-500">
                        {SYSTEM_TYPE_LABELS[s.systemType] || s.systemType}
                      </div>
                    </td>
                    <td className="py-2 px-3 border-r border-slate-300">
                      {CONDITION_LABELS[s.condition] || s.condition}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-300 text-right font-mono tabular-nums">
                      {s.wearPercent}%
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">
                      {formatShortDate(s.nextInspectionDate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="border border-slate-300 rounded-lg p-3.5">
              <div className="font-bold mb-2">2. Плановое ТО ({maintenancePlans.length})</div>
              {maintenancePlans.length === 0 ? (
                <p className="text-slate-500">Запланированных работ нет</p>
              ) : (
                <ul className="space-y-1.5">
                  {maintenancePlans.slice(0, 5).map((m) => (
                    <li key={m.id}>
                      <span className="font-mono">{formatShortDate(m.scheduledDate)}</span> —{' '}
                      {m.title} ({MAINTENANCE_STATUS_LABELS[m.status]})
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="border border-slate-300 rounded-lg p-3.5">
              <div className="font-bold mb-2">3. Аварийные инциденты ({emergencies.length})</div>
              {emergencies.length === 0 ? (
                <p className="text-slate-500">Аварий не зафиксировано</p>
              ) : (
                <ul className="space-y-1.5">
                  {emergencies.slice(0, 5).map((em) => (
                    <li key={em.id}>
                      <span className="font-mono">{formatShortDate(em.reportedAt)}</span> —{' '}
                      {em.title} ({EMERGENCY_STATUS_LABELS[em.status]})
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="pt-6 text-xs flex justify-between items-end border-t border-slate-300">
            <div>Ответственный инженер УК «ДомоУправ»</div>
            <div>_______________________ / М.П.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
