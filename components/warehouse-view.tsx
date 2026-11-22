'use client';

import { useState } from 'react';
import { Minus, Plus, Search, X } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { canPerformAction, formatRubles } from '@/lib/operations-logic';
import type { UserProfile, WarehouseItemRecord } from './types';

interface WarehouseViewProps {
  user: UserProfile;
  items: WarehouseItemRecord[];
  onRefresh: () => Promise<void>;
}

const WAREHOUSE_CAT_LABELS: Record<string, string> = {
  plumbing: 'Сантехника и арматура',
  electricity: 'Электротехника',
  heating: 'Отопление и ИТП',
  construction: 'Строительные материалы',
  fasteners: 'Крепёж',
  consumables: 'Расходные материалы',
};

export function WarehouseView({ user, items, onRefresh }: WarehouseViewProps) {
  const canManage = canPerformAction(user.role, 'manage_warehouse');
  const [search, setSearch] = useState('');
  const [onlyLowStock, setOnlyLowStock] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('plumbing');
  const [unit, setUnit] = useState('шт');
  const [quantity, setQuantity] = useState('10');
  const [minQuantity, setMinQuantity] = useState('5');
  const [unitPrice, setUnitPrice] = useState('850');
  const [location, setLocation] = useState('Стеллаж А-1');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleAdjustStock(id: number, delta: number) {
    await apiFetch('/api/warehouse', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, deltaQuantity: delta }),
    });
    await onRefresh();
  }

  async function handleCreateItem(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await apiFetch('/api/warehouse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku,
          name,
          category,
          unit,
          quantity: Number(quantity),
          minQuantity: Number(minQuantity),
          unitPrice: Number(unitPrice),
          location,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Не удалось добавить позицию');
        return;
      }
      setShowCreate(false);
      setSku('');
      setName('');
      await onRefresh();
    } finally {
      setSubmitting(false);
    }
  }

  const totalInventoryValue = items.reduce((s, i) => s + i.totalValue, 0);
  const lowStockCount = items.filter((i) => i.isLowStock).length;

  const filtered = items.filter((i) => {
    if (onlyLowStock && !i.isLowStock) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Склад материалов</h1>

        {canManage && (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="px-4 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Новая позиция</span>
          </button>
        )}
      </div>

      {/* Summary Strip */}
      <div className="bg-white border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
        <div className="p-4">
          <div className="text-xs text-slate-500">Всего номенклатур</div>
          <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900">
            {items.length}
          </div>
        </div>
        <div className="p-4">
          <div className="text-xs text-slate-500">Стоимость складских остатков</div>
          <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900">
            {formatRubles(totalInventoryValue)}
          </div>
        </div>
        <div className="p-4">
          <div className="text-xs text-slate-500">Позиции ниже минимума</div>
          <div
            className={`mt-1 text-2xl font-bold font-mono tabular-nums ${
              lowStockCount > 0 ? 'text-red-700' : 'text-emerald-700'
            }`}
          >
            {lowStockCount}
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
          <button
            type="button"
            onClick={() => setOnlyLowStock(false)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              !onlyLowStock ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            Все позиции
          </button>
          <button
            type="button"
            onClick={() => setOnlyLowStock(true)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              onlyLowStock ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            Дефицит ({lowStockCount})
          </button>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Артикул или название..."
            aria-label="Поиск по складу"
            className="pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-lg w-60"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                <th className="py-2.5 px-4 whitespace-nowrap">Артикул</th>
                <th className="py-2.5 px-4">Наименование и место хранения</th>
                <th className="py-2.5 px-4 text-right whitespace-nowrap">Остаток</th>
                <th className="py-2.5 px-4 text-right whitespace-nowrap">Минимум</th>
                <th className="py-2.5 px-4 text-right whitespace-nowrap">Цена / ед.</th>
                <th className="py-2.5 px-4 text-right whitespace-nowrap">Сумма</th>
                {canManage && (
                  <th className="py-2.5 px-4 text-right whitespace-nowrap">Движение</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-700 whitespace-nowrap">
                    {item.sku}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-900">{item.name}</div>
                    <div className="text-xs text-slate-500">
                      {WAREHOUSE_CAT_LABELS[item.category] || item.category} · {item.location}
                    </div>
                  </td>
                  <td
                    className={`py-3 px-4 text-right font-mono tabular-nums font-semibold whitespace-nowrap ${
                      item.isLowStock ? 'text-red-700' : 'text-slate-900'
                    }`}
                  >
                    {item.quantity} {item.unit}
                    {item.isLowStock ? ' · Дефицит' : ''}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-slate-500 whitespace-nowrap">
                    {item.minQuantity} {item.unit}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-slate-700 whitespace-nowrap">
                    {formatRubles(item.unitPrice)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-xs font-semibold text-slate-900 whitespace-nowrap">
                    {formatRubles(item.totalValue)}
                  </td>
                  {canManage && (
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          aria-label={`Списать 1 ${item.name}`}
                          onClick={() => void handleAdjustStock(item.id, -1)}
                          className="p-1.5 border border-slate-200 hover:bg-slate-100 rounded text-slate-700"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Пополнить на 5 ${item.name}`}
                          onClick={() => void handleAdjustStock(item.id, 5)}
                          className="px-2 py-1 border border-slate-200 hover:bg-slate-100 rounded text-xs font-mono font-medium text-blue-700"
                        >
                          +5
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">Новая складская позиция</h2>
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
            <form onSubmit={handleCreateItem} className="space-y-3.5">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Артикул</label>
                  <input
                    required
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    placeholder="СНТ-055"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">Категория</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  >
                    {Object.entries(WAREHOUSE_CAT_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Наименование материала
                </label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Муфта переходная DN25"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Ед. изм.</label>
                  <input
                    required
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Остаток</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Минимум</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={minQuantity}
                    onChange={(e) => setMinQuantity(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Цена за ед. (₽)
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Место хранения
                  </label>
                  <input
                    required
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
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
                  className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg"
                >
                  Добавить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
