'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { ArrowLeft, ClipboardCheck, Plus, Printer, Search, X } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import {
  canPerformAction,
  CONDITION_LABELS,
  EMERGENCY_STATUS_LABELS,
  formatDateTime,
  formatRubles,
  formatShortDate,
  MAINTENANCE_STATUS_LABELS,
  STATUS_LABELS,
  SYSTEM_TYPE_LABELS,
  type TicketStatus,
} from '@/lib/operations-logic';
import { getBuildingImage } from './building-images';
import { BuildingPassportPrintModal } from './print-documents';
import type {
  ApartmentItem,
  BuildingItem,
  EmergencyItem,
  EngineeringSystemItem,
  MaintenancePlanItem,
  UserProfile,
} from './types';

interface BuildingsViewProps {
  user: UserProfile;
  buildings: BuildingItem[];
  onRefresh: () => Promise<void>;
}

interface BuildingCardPayload {
  building: BuildingItem;
  apartments: ApartmentItem[];
  engineeringSystems: EngineeringSystemItem[];
  tickets: Array<{
    id: number;
    ticketNumber: string;
    apartmentNumber: string | null;
    category: string;
    title: string;
    status: TicketStatus;
    priority: string;
    createdAt: string;
  }>;
  maintenancePlans: MaintenancePlanItem[];
  emergencies: EmergencyItem[];
}

const UNIT_TYPE_LABELS: Record<string, string> = {
  residential: 'Жилая квартира',
  commercial: 'Нежилое / коммерческое',
  technical: 'Техническое помещение',
};

export function BuildingsView({ user, buildings, onRefresh }: BuildingsViewProps) {
  const canManage = canPerformAction(user.role, 'manage_buildings');
  const canInspectSystems = user.role === 'admin' || user.role === 'specialist';
  const isResidentHouseView = user.role === 'resident' && Boolean(user.buildingId);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(
    isResidentHouseView ? user.buildingId : null
  );
  const [cardData, setCardData] = useState<BuildingCardPayload | null>(null);
  const [cardLoading, setCardLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'passport' | 'systems' | 'works' | 'emergencies'>(
    isResidentHouseView ? 'systems' : 'passport'
  );

  // Add Building modal state
  const [showAddBuilding, setShowAddBuilding] = useState(false);
  const [bAddress, setBAddress] = useState('');
  const [bDistrict, setBDistrict] = useState('');
  const [bYear, setBYear] = useState('2015');
  const [bFloors, setBFloors] = useState('12');
  const [bEntrances, setBEntrances] = useState('2');
  const [bArea, setBArea] = useState('8400');
  const [bApts, setBApts] = useState('96');
  const [bImageKey, setBImageKey] = useState('building_modern_tower');
  const [bNotes, setBNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Add Apartment / Engineering System inline modal
  const [showAddUnit, setShowAddUnit] = useState(false);
  const [uNumber, setUNumber] = useState('');
  const [uEntrance, setUEntrance] = useState('1');
  const [uFloor, setUFloor] = useState('1');
  const [uArea, setUArea] = useState('62');
  const [uType, setUType] = useState<'residential' | 'commercial' | 'technical'>('residential');
  const [uOwner, setUOwner] = useState('');
  const [uPhone, setUPhone] = useState('');

  const [showAddSystem, setShowAddSystem] = useState(false);
  const [sType, setSType] = useState('heating');
  const [sName, setSName] = useState('');
  const [sCondition, setSCondition] = useState<'normal' | 'wear' | 'critical'>('normal');
  const [sWear, setSWear] = useState('25');
  const [sNextDate, setSNextDate] = useState('2027-03-01');

  // Print Passport & System Inspection modal state
  const [showPrintPassport, setShowPrintPassport] = useState(false);
  const [inspectingSystem, setInspectingSystem] = useState<EngineeringSystemItem | null>(null);
  const [iCondition, setICondition] = useState<'normal' | 'wear' | 'critical'>('normal');
  const [iWear, setIWear] = useState('25');
  const [iNextDate, setINextDate] = useState('2027-06-01');
  const [iNotes, setINotes] = useState('');

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    apiFetch(`/api/buildings/${selectedId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: BuildingCardPayload | null) => {
        if (!cancelled && data) setCardData(data);
      })
      .catch(() => {
        // ignore transient errors
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  async function loadBuildingCard(id: number) {
    setCardLoading(true);
    try {
      const res = await apiFetch(`/api/buildings/${id}`);
      if (res.ok) {
        const data = await res.json();
        setCardData(data);
      }
    } finally {
      setCardLoading(false);
    }
  }

  function handleOpenCard(id: number) {
    setSelectedId(id);
    setCardData(null);
    setActiveTab('passport');
  }

  async function handleCreateBuilding(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const res = await apiFetch('/api/buildings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: bAddress,
          district: bDistrict,
          yearBuilt: Number(bYear),
          floors: Number(bFloors),
          entrances: Number(bEntrances),
          totalAreaSqm: Number(bArea),
          apartmentsCount: Number(bApts),
          conditionScore: 88,
          conditionStatus: 'good',
          managementSince: new Date().toISOString().slice(0, 10),
          imageKey: bImageKey,
          notes: bNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Не удалось добавить дом');
        return;
      }
      setShowAddBuilding(false);
      setBAddress('');
      setBDistrict('');
      setBNotes('');
      await onRefresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddApartment(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    setSubmitting(true);
    try {
      const res = await apiFetch(`/api/buildings/${selectedId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType: 'apartment',
          number: uNumber,
          entrance: Number(uEntrance),
          floor: Number(uFloor),
          areaSqm: Number(uArea),
          unitType: uType,
          ownerName: uOwner,
          ownerPhone: uPhone || undefined,
          residentsCount: uType === 'residential' ? 2 : 0,
        }),
      });
      if (res.ok) {
        setShowAddUnit(false);
        setUNumber('');
        setUOwner('');
        setUPhone('');
        await loadBuildingCard(selectedId);
        await onRefresh();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddSystem(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    setSubmitting(true);
    try {
      const res = await apiFetch(`/api/buildings/${selectedId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType: 'system',
          systemType: sType,
          name: sName,
          condition: sCondition,
          wearPercent: Number(sWear),
          lastInspectionDate: new Date().toISOString().slice(0, 10),
          nextInspectionDate: sNextDate,
        }),
      });
      if (res.ok) {
        setShowAddSystem(false);
        setSName('');
        await loadBuildingCard(selectedId);
        await onRefresh();
      }
    } finally {
      setSubmitting(false);
    }
  }

  function openInspectionModal(sys: EngineeringSystemItem) {
    setInspectingSystem(sys);
    setICondition(sys.condition as 'normal' | 'wear' | 'critical');
    setIWear(String(sys.wearPercent));
    setINextDate(sys.nextInspectionDate || '2027-06-01');
    setINotes(sys.notes || '');
  }

  async function handleSubmitInspection(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId || !inspectingSystem) return;
    setSubmitting(true);
    try {
      const res = await apiFetch(`/api/buildings/${selectedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemUpdate: {
            id: inspectingSystem.id,
            condition: iCondition,
            wearPercent: Number(iWear),
            lastInspectionDate: new Date().toISOString().slice(0, 10),
            nextInspectionDate: iNextDate,
            notes: iNotes,
          },
        }),
      });
      if (res.ok) {
        setInspectingSystem(null);
        await loadBuildingCard(selectedId);
        await onRefresh();
      }
    } finally {
      setSubmitting(false);
    }
  }

  // Electronic Building Card View
  if (selectedId) {
    const b = cardData?.building.id === selectedId ? cardData.building : null;
    return (
      <div className="space-y-6">
        <div className="print-hide-when-modal space-y-6">
        {!isResidentHouseView && (
          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => {
                setSelectedId(null);
                setCardData(null);
                setActiveTab('passport');
              }}
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>К списку домов</span>
            </button>
          </div>
        )}

        {cardLoading || !cardData || !b ? (
          <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
            Загрузка данных дома...
          </div>
        ) : (
          <>
            {/* Building Card Header */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden grid grid-cols-1 lg:grid-cols-3">
              <div className="relative min-h-[220px] lg:min-h-full bg-slate-100">
                <Image
                  src={getBuildingImage(b.imageKey)}
                  alt={b.address}
                  fill
                  sizes="(max-width: 1024px) 100vw, 33vw"
                  referrerPolicy="no-referrer"
                  className="object-cover"
                />
              </div>
              <div className="lg:col-span-2 p-6 flex flex-col justify-between">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div>
                    <div className="text-xs text-slate-500">
                      Район {b.district} · В управлении с{' '}
                      <span className="font-mono tabular-nums">
                        {formatShortDate(b.managementSince)}
                      </span>
                    </div>
                    <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                      {b.address}
                    </h1>
                    {b.notes && <p className="mt-2 text-sm text-slate-600">{b.notes}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPrintPassport(true)}
                    className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 self-start"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Паспорт (PDF)</span>
                  </button>
                </div>

                <div className="mt-6 pt-5 border-t border-slate-200 grid grid-cols-2 sm:grid-cols-5 gap-4">
                  <div>
                    <div className="text-xs text-slate-500">Год постройки</div>
                    <div className="mt-0.5 text-base font-semibold font-mono tabular-nums text-slate-900">
                      {b.yearBuilt}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Этажи / Подъезды</div>
                    <div className="mt-0.5 text-base font-semibold font-mono tabular-nums text-slate-900">
                      {b.floors} / {b.entrances}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Общая площадь</div>
                    <div className="mt-0.5 text-base font-semibold font-mono tabular-nums text-slate-900">
                      {b.totalAreaSqm.toLocaleString('ru-RU')} м²
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Помещений</div>
                    <div className="mt-0.5 text-base font-semibold font-mono tabular-nums text-slate-900">
                      {b.apartmentsCount}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs text-slate-500">Техсостояние</div>
                    <div
                      className={`mt-0.5 text-base font-semibold font-mono tabular-nums ${
                        b.conditionScore >= 80
                          ? 'text-emerald-700'
                          : b.conditionScore >= 65
                            ? 'text-amber-700'
                            : 'text-red-700'
                      }`}
                    >
                      {b.conditionScore}%
                    </div>
                    <div
                      className={`text-xs font-medium leading-tight break-words ${
                        b.conditionScore >= 80
                          ? 'text-emerald-700'
                          : b.conditionScore >= 65
                            ? 'text-amber-700'
                            : 'text-red-700'
                      }`}
                    >
                      {CONDITION_LABELS[b.conditionStatus]}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Card Section Tabs */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div
                className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg"
                role="tablist"
              >
                {[
                  ...(user.role !== 'resident'
                    ? [{ id: 'passport', label: `Помещения (${cardData.apartments.length})` }]
                    : []),
                  {
                    id: 'systems',
                    label: `Инженерные системы (${cardData.engineeringSystems.length})`,
                  },
                  {
                    id: 'works',
                    label: `Заявки и ТО (${cardData.tickets.length + cardData.maintenancePlans.length})`,
                  },
                  { id: 'emergencies', label: `Аварии (${cardData.emergencies.length})` },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === tab.id}
                    onClick={() =>
                      setActiveTab(tab.id as 'passport' | 'systems' | 'works' | 'emergencies')
                    }
                    className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {canManage && activeTab === 'passport' && (
                <button
                  type="button"
                  onClick={() => setShowAddUnit(true)}
                  className="px-3.5 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Добавить помещение</span>
                </button>
              )}

              {canManage && activeTab === 'systems' && (
                <button
                  type="button"
                  onClick={() => setShowAddSystem(true)}
                  className="px-3.5 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Добавить инженерную систему</span>
                </button>
              )}
            </div>

            {/* Tab 1: Apartments & Premises */}
            {activeTab === 'passport' && (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                        <th className="py-2.5 px-4">№ пом.</th>
                        <th className="py-2.5 px-4">Тип</th>
                        <th className="py-2.5 px-4">Подъезд / Этаж</th>
                        <th className="py-2.5 px-4 text-right">Площадь, м²</th>
                        <th className="py-2.5 px-4">Собственник / Ответственный</th>
                        <th className="py-2.5 px-4 text-right">Проживающих</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-sm">
                      {cardData.apartments.map((apt) => (
                        <tr key={apt.id} className="hover:bg-slate-50">
                          <td className="py-3 px-4 font-mono tabular-nums font-semibold text-slate-900">
                            {apt.number}
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-600">
                            {UNIT_TYPE_LABELS[apt.unitType] || apt.unitType}
                          </td>
                          <td className="py-3 px-4 font-mono tabular-nums text-xs text-slate-600">
                            Под. {apt.entrance} · Эт. {apt.floor}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900">
                            {apt.areaSqm.toFixed(1)}
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-slate-900">{apt.ownerName}</div>
                            {apt.ownerPhone && (
                              <div className="text-xs font-mono text-slate-500">
                                {apt.ownerPhone}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                            {apt.residentsCount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tab 2: Engineering Systems */}
            {activeTab === 'systems' && (
              <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-200">
                {cardData.engineeringSystems.map((sys) => (
                  <div
                    key={sys.id}
                    className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <div className="text-xs text-slate-500">
                        {SYSTEM_TYPE_LABELS[sys.systemType] || sys.systemType}
                      </div>
                      <div className="text-base font-semibold text-slate-900 mt-0.5">
                        {sys.name}
                      </div>
                      {sys.notes && <p className="text-xs text-slate-600 mt-1">{sys.notes}</p>}
                    </div>

                    <div className="flex flex-wrap items-center gap-6 shrink-0">
                      <div className="w-36">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-slate-500">Износ</span>
                          <span className="font-mono tabular-nums font-semibold text-slate-900">
                            {sys.wearPercent}%
                          </span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              sys.wearPercent >= 70
                                ? 'bg-red-600'
                                : sys.wearPercent >= 45
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-600'
                            }`}
                            style={{ width: `${sys.wearPercent}%` }}
                          />
                        </div>
                      </div>

                      <div className="text-xs">
                        <div className="text-slate-500">Состояние</div>
                        <div
                          className={`font-semibold mt-0.5 ${
                            sys.condition === 'critical'
                              ? 'text-red-700'
                              : sys.condition === 'wear'
                                ? 'text-amber-700'
                                : 'text-emerald-700'
                          }`}
                        >
                          {CONDITION_LABELS[sys.condition] || sys.condition}
                        </div>
                      </div>

                      <div className="text-xs font-mono tabular-nums">
                        <div className="text-slate-500 font-sans">Следующий осмотр</div>
                        <div className="text-slate-900 mt-0.5">
                          {formatShortDate(sys.nextInspectionDate)}
                        </div>
                      </div>

                      {canInspectSystems && (
                        <button
                          type="button"
                          onClick={() => openInspectionModal(sys)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <ClipboardCheck className="w-3.5 h-3.5" />
                          <span>Провести осмотр</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Tab 3: Works & Maintenance History */}
            {activeTab === 'works' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-slate-200 text-sm font-semibold text-slate-900">
                    Заявки по дому ({cardData.tickets.length})
                  </div>
                  <div className="divide-y divide-slate-200">
                    {cardData.tickets.length === 0 ? (
                      <p className="p-5 text-sm text-slate-500">Заявок по дому нет.</p>
                    ) : (
                      cardData.tickets.map((t) => (
                        <div key={t.id} className="px-5 py-3.5">
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="font-mono font-semibold text-blue-700">
                              {t.ticketNumber}
                            </span>
                            <span className="text-slate-600 font-medium">
                              {STATUS_LABELS[t.status]}
                            </span>
                          </div>
                          <div className="text-sm font-medium text-slate-900 mt-1">{t.title}</div>
                          <div className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
                            {t.apartmentNumber ? `кв. ${t.apartmentNumber} · ` : ''}
                            {formatDateTime(t.createdAt)}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-slate-200 text-sm font-semibold text-slate-900">
                    Плановое ТО ({cardData.maintenancePlans.length})
                  </div>
                  <div className="divide-y divide-slate-200">
                    {cardData.maintenancePlans.length === 0 ? (
                      <p className="p-5 text-sm text-slate-500">График ТО не заполнен.</p>
                    ) : (
                      cardData.maintenancePlans.map((m) => (
                        <div key={m.id} className="px-5 py-3.5">
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="font-mono tabular-nums text-slate-500">
                              {formatShortDate(m.scheduledDate)}
                            </span>
                            <span
                              className={`font-medium ${
                                m.status === 'overdue'
                                  ? 'text-red-700'
                                  : m.status === 'completed'
                                    ? 'text-emerald-700'
                                    : 'text-slate-700'
                              }`}
                            >
                              {MAINTENANCE_STATUS_LABELS[m.status]}
                            </span>
                          </div>
                          <div className="text-sm font-medium text-slate-900 mt-1">{m.title}</div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {m.brigadeName || 'Бригада не назначена'} ·{' '}
                            <span className="font-mono tabular-nums">
                              {formatRubles(m.estimatedCost)}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Tab 4: Emergencies */}
            {activeTab === 'emergencies' && (
              <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-200">
                {cardData.emergencies.length === 0 ? (
                  <p className="p-6 text-sm text-slate-500">
                    Аварийных ситуаций по данному дому не зарегистрировано.
                  </p>
                ) : (
                  cardData.emergencies.map((em) => (
                    <div key={em.id} className="p-5 flex flex-col sm:flex-row justify-between gap-4">
                      <div>
                        <div className="text-xs text-slate-500">
                          {SYSTEM_TYPE_LABELS[em.systemType] || em.systemType} ·{' '}
                          <span
                            className={
                              em.status === 'resolved'
                                ? 'text-emerald-700 font-semibold'
                                : 'text-red-700 font-semibold'
                            }
                          >
                            {EMERGENCY_STATUS_LABELS[em.status]}
                          </span>
                        </div>
                        <div className="text-base font-semibold text-slate-900 mt-0.5">
                          {em.title}
                        </div>
                        <p className="text-sm text-slate-600 mt-1">{em.description}</p>
                        {em.rootCause && (
                          <p className="text-xs text-slate-500 mt-1.5">
                            Причина: {em.rootCause}
                          </p>
                        )}
                      </div>
                      <div className="text-xs sm:text-right shrink-0 space-y-1 font-mono tabular-nums">
                        <div className="text-slate-700">{formatDateTime(em.reportedAt)}</div>
                        <div className="text-slate-500 font-sans">
                          Зона: {em.affectedApartments}
                        </div>
                        <div className="text-slate-900 font-semibold">
                          Ущерб: {formatRubles(em.damageCost)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}

        {/* Modal: Add Apartment */}
        {showAddUnit && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl border border-slate-200 w-full max-w-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-900">Новое помещение</h2>
                <button
                  type="button"
                  aria-label="Закрыть окно"
                  onClick={() => setShowAddUnit(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleAddApartment} className="space-y-3.5">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">№ пом.</label>
                    <input
                      required
                      value={uNumber}
                      onChange={(e) => setUNumber(e.target.value)}
                      placeholder="112"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Подъезд</label>
                    <input
                      type="number"
                      min={1}
                      required
                      value={uEntrance}
                      onChange={(e) => setUEntrance(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Этаж</label>
                    <input
                      type="number"
                      min={0}
                      required
                      value={uFloor}
                      onChange={(e) => setUFloor(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Тип</label>
                    <select
                      value={uType}
                      onChange={(e) =>
                        setUType(e.target.value as 'residential' | 'commercial' | 'technical')
                      }
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    >
                      <option value="residential">Жилая квартира</option>
                      <option value="commercial">Нежилое</option>
                      <option value="technical">Техническое</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Площадь (м²)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={uArea}
                      onChange={(e) => setUArea(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Собственник / Ответственный
                  </label>
                  <input
                    required
                    value={uOwner}
                    onChange={(e) => setUOwner(e.target.value)}
                    placeholder="ФИО или организация"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Телефон</label>
                  <input
                    value={uPhone}
                    onChange={(e) => setUPhone(e.target.value)}
                    placeholder="+7 (999) 123-45-67"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddUnit(false)}
                    className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg"
                  >
                    Сохранить
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Add Engineering System */}
        {showAddSystem && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl border border-slate-200 w-full max-w-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-900">Новая инженерная система</h2>
                <button
                  type="button"
                  aria-label="Закрыть окно"
                  onClick={() => setShowAddSystem(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleAddSystem} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Тип системы
                  </label>
                  <select
                    value={sType}
                    onChange={(e) => setSType(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  >
                    {Object.entries(SYSTEM_TYPE_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Наименование узла / оборудования
                  </label>
                  <input
                    required
                    value={sName}
                    onChange={(e) => setSName(e.target.value)}
                    placeholder="Например: Насосная станция пожаротушения"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Состояние
                    </label>
                    <select
                      value={sCondition}
                      onChange={(e) =>
                        setSCondition(e.target.value as 'normal' | 'wear' | 'critical')
                      }
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    >
                      <option value="normal">Исправно</option>
                      <option value="wear">Повышенный износ</option>
                      <option value="critical">Аварийное</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Износ (%)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      required
                      value={sWear}
                      onChange={(e) => setSWear(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Дата следующего осмотра
                  </label>
                  <input
                    type="date"
                    required
                    value={sNextDate}
                    onChange={(e) => setSNextDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddSystem(false)}
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
        {/* Modal: Inspect Engineering System */}
        {inspectingSystem && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl border border-slate-200 w-full max-w-md p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Акт технического осмотра</h2>
                  <p className="text-xs text-slate-500 mt-0.5">{inspectingSystem.name}</p>
                </div>
                <button
                  type="button"
                  aria-label="Закрыть окно осмотра"
                  onClick={() => setInspectingSystem(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleSubmitInspection} className="space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="inspect-condition"
                      className="block text-xs font-medium text-slate-700 mb-1"
                    >
                      Состояние системы
                    </label>
                    <select
                      id="inspect-condition"
                      value={iCondition}
                      onChange={(e) =>
                        setICondition(e.target.value as 'normal' | 'wear' | 'critical')
                      }
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="normal">Исправно</option>
                      <option value="wear">Повышенный износ</option>
                      <option value="critical">Аварийное</option>
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="inspect-wear"
                      className="block text-xs font-medium text-slate-700 mb-1"
                    >
                      Фактический износ (%)
                    </label>
                    <input
                      id="inspect-wear"
                      type="number"
                      min={0}
                      max={100}
                      required
                      value={iWear}
                      onChange={(e) => setIWear(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="inspect-next-date"
                    className="block text-xs font-medium text-slate-700 mb-1"
                  >
                    Дата следующего осмотра
                  </label>
                  <input
                    id="inspect-next-date"
                    type="date"
                    required
                    value={iNextDate}
                    onChange={(e) => setINextDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label
                    htmlFor="inspect-notes"
                    className="block text-xs font-medium text-slate-700 mb-1"
                  >
                    Заключение инженера
                  </label>
                  <textarea
                    id="inspect-notes"
                    rows={3}
                    value={iNotes}
                    onChange={(e) => setINotes(e.target.value)}
                    placeholder="Результаты замеров, выявленные дефекты, рекомендации..."
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setInspectingSystem(null)}
                    className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg"
                  >
                    {submitting ? 'Сохранение...' : 'Зафиксировать осмотр'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        </div>

        {/* Printable Building Technical Passport Modal */}
        {showPrintPassport && cardData && b && (
          <BuildingPassportPrintModal
            building={b}
            systems={cardData.engineeringSystems}
            maintenancePlans={cardData.maintenancePlans}
            emergencies={cardData.emergencies}
            onClose={() => setShowPrintPassport(false)}
          />
        )}
      </div>
    );
  }

  // Buildings Registry List View
  const filtered = buildings.filter(
    (b) =>
      b.address.toLowerCase().includes(search.toLowerCase()) ||
      b.district.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Многоквартирные дома
        </h1>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по адресу или району..."
              aria-label="Поиск домов по адресу или району"
              className="pl-9 pr-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
            />
          </div>

          {canManage && (
            <button
              type="button"
              onClick={() => setShowAddBuilding(true)}
              className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Добавить дом</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filtered.map((b) => (
          <article
            key={b.id}
            className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col hover:border-slate-300 transition-colors"
          >
            <div className="relative h-48 bg-slate-100">
              <Image
                src={getBuildingImage(b.imageKey)}
                alt={b.address}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                referrerPolicy="no-referrer"
                className="object-cover"
              />
            </div>

            <div className="p-5 flex-1 flex flex-col justify-between">
              <div>
                <div className="text-xs text-slate-500">
                  {b.district} · {b.yearBuilt} г. · {b.floors} эт. · {b.apartmentsCount} кв.
                </div>
                <h2 className="mt-1 text-lg font-bold text-slate-900">{b.address}</h2>
                {b.notes && (
                  <p className="mt-1.5 text-sm text-slate-600 line-clamp-2">{b.notes}</p>
                )}
              </div>

              <div className="mt-5 pt-4 border-t border-slate-200 flex items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                  <span
                    className={`font-semibold font-mono tabular-nums ${
                      b.conditionScore >= 80
                        ? 'text-emerald-700'
                        : b.conditionScore >= 65
                          ? 'text-amber-700'
                          : 'text-red-700'
                    }`}
                  >
                    Состояние {b.conditionScore}%
                  </span>
                  <span className="text-slate-600 font-mono tabular-nums">
                    Заявок в работе: {b.stats.openTickets}
                  </span>
                  {b.stats.activeEmergencies > 0 && (
                    <span className="text-red-700 font-semibold font-mono tabular-nums">
                      Аварий: {b.stats.activeEmergencies}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenCard(b.id)}
                  className="text-xs font-semibold text-blue-700 hover:text-blue-900 whitespace-nowrap shrink-0"
                >
                  Открыть карточку
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* Add Building Modal */}
      {showAddBuilding && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">Новый многоквартирный дом</h2>
              <button
                type="button"
                aria-label="Закрыть окно"
                onClick={() => setShowAddBuilding(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 px-3.5 py-2.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateBuilding} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Адрес МКД</label>
                <input
                  required
                  value={bAddress}
                  onChange={(e) => setBAddress(e.target.value)}
                  placeholder="ул. Профсоюзная, д. 34"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Район</label>
                  <input
                    required
                    value={bDistrict}
                    onChange={(e) => setBDistrict(e.target.value)}
                    placeholder="Черёмушки"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Год постройки
                  </label>
                  <input
                    type="number"
                    required
                    value={bYear}
                    onChange={(e) => setBYear(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Этажей</label>
                  <input
                    type="number"
                    required
                    value={bFloors}
                    onChange={(e) => setBFloors(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Подъездов</label>
                  <input
                    type="number"
                    required
                    value={bEntrances}
                    onChange={(e) => setBEntrances(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Квартир</label>
                  <input
                    type="number"
                    required
                    value={bApts}
                    onChange={(e) => setBApts(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Площадь м²</label>
                  <input
                    type="number"
                    required
                    value={bArea}
                    onChange={(e) => setBArea(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Тип застройки (обложка карточки)
                </label>
                <select
                  value={bImageKey}
                  onChange={(e) => setBImageKey(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                >
                  <option value="building_modern_tower">Современный ЖК (кирпич/монолит)</option>
                  <option value="building_courtyard_block">Многоэтажный квартальный дом</option>
                  <option value="building_brick_classic">Кирпичный исторический фонд</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Примечания по эксплуатации
                </label>
                <textarea
                  rows={2}
                  value={bNotes}
                  onChange={(e) => setBNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddBuilding(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg"
                >
                  {submitting ? 'Сохранение...' : 'Добавить в реестр'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
