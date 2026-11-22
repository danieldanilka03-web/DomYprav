'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ArrowRight, Building2, Eye, EyeOff, Lock, Mail, Phone, User } from 'lucide-react';
import { apiFetch, setClientSessionToken } from '@/lib/api-client';
import { getBuildingImage } from './building-images';
import type { BuildingShort, UserProfile } from './types';

interface AuthPortalProps {
  buildings: BuildingShort[];
  onAuthenticated: (user: UserProfile) => void;
}

const DEMO_ACCOUNTS = [
  {
    role: 'Администратор',
    email: 'admin@domouprav.ru',
    note: 'Управление фондом, аналитика, роли, склад и отчёты',
  },
  {
    role: 'Диспетчер',
    email: 'dispatcher@domouprav.ru',
    note: 'Приём и распределение заявок, аварии, оповещения',
  },
  {
    role: 'Специалист',
    email: 'spec.plumbing@domouprav.ru',
    note: 'Наряды, склад, фото ремонта и осмотр систем',
  },
  {
    role: 'Житель',
    email: 'resident@domouprav.ru',
    note: 'Подача заявок с фото, оценка работ, показания счётчиков',
  },
];

export function AuthPortal({ buildings, onAuthenticated }: AuthPortalProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [buildingId, setBuildingId] = useState<string>(
    buildings[0]?.id ? String(buildings[0].id) : ''
  );
  const [apartmentNumber, setApartmentNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitLogin(loginEmail: string, loginPassword: string) {
    setError(null);
    setLoading(true);
    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Неверный email или пароль');
        return;
      }
      if (data.token) {
        setClientSessionToken(data.token);
      }
      onAuthenticated(data.user);
    } catch {
      setError('Ошибка соединения с сервером');
    } finally {
      setLoading(false);
    }
  }

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === 'login') {
      await submitLogin(email, password);
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const res = await apiFetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          email,
          password,
          phone: phone || undefined,
          buildingId: buildingId ? Number(buildingId) : null,
          apartmentNumber: apartmentNumber || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Не удалось завершить регистрацию');
        return;
      }
      if (data.token) {
        setClientSessionToken(data.token);
      }
      onAuthenticated(data.user);
    } catch {
      setError('Ошибка соединения с сервером');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col lg:flex-row">
      {/* Left Architectural Photo Column */}
      <div className="relative lg:w-[50%] bg-slate-900 text-white flex flex-col justify-between p-8 lg:p-14 overflow-hidden min-h-[240px] lg:min-h-screen">
        <Image
          src={getBuildingImage('building_modern_tower')}
          alt="Жилой комплекс ДомоУправ"
          fill
          sizes="(max-width: 1024px) 100vw, 50vw"
          priority
          referrerPolicy="no-referrer"
          className="object-cover opacity-55"
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-900/45 to-slate-900/35"
          aria-hidden="true"
        />

        <div className="relative z-10 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5 text-white" aria-hidden="true" />
          </div>
          <span className="text-xl font-bold tracking-tight text-white">ДомоУправ</span>
        </div>

        <div className="relative z-10 max-w-md pt-12 lg:pt-0">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-[1.15] text-white text-balance">
            Личный кабинет жителя и управляющей компании
          </h1>
        </div>
      </div>

      {/* Right Authentication Form Column */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 lg:p-14 bg-white">
        <div className="w-full max-w-[420px]">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 mb-6">
            {mode === 'login' ? 'Вход' : 'Регистрация'}
          </h2>

          {/* Mode Tabs */}
          <div
            className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg mb-6"
            role="tablist"
            aria-label="Выбор режима"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`py-2 px-3 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                mode === 'login'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Войти
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'register'}
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={`py-2 px-3 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                mode === 'register'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Регистрация
            </button>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-5 px-4 py-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleFormSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label
                  htmlFor="auth-fullname"
                  className="block text-sm font-medium text-slate-700 mb-1.5"
                >
                  ФИО
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="auth-fullname"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Иванов Пётр Сергеевич"
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                  />
                </div>
              </div>
            )}

            <div>
              <label
                htmlFor="auth-email"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Электронная почта
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="auth-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.ru"
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="auth-password"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Пароль
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  required
                  minLength={mode === 'register' ? 6 : 1}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'register' ? 'Не менее 6 символов' : 'Введите пароль'}
                  className="w-full pl-10 pr-10 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-0.5"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {mode === 'register' && (
              <>
                <div>
                  <label
                    htmlFor="auth-phone"
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                  >
                    Телефон
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="auth-phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+7 (999) 000-00-00"
                      className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label
                      htmlFor="auth-building"
                      className="block text-sm font-medium text-slate-700 mb-1.5"
                    >
                      Ваш дом
                    </label>
                    <select
                      id="auth-building"
                      value={buildingId}
                      onChange={(e) => setBuildingId(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                    >
                      <option value="">Выберите дом</option>
                      {buildings.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.address}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="auth-apt"
                      className="block text-sm font-medium text-slate-700 mb-1.5"
                    >
                      Квартира
                    </label>
                    <input
                      id="auth-apt"
                      type="text"
                      value={apartmentNumber}
                      onChange={(e) => setApartmentNumber(e.target.value)}
                      placeholder="42"
                      className="w-full px-3 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                    />
                  </div>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 whitespace-nowrap mt-2"
            >
              <span>
                {loading
                  ? 'Выполняется...'
                  : mode === 'login'
                    ? 'Войти'
                    : 'Зарегистрироваться'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Role Demo Access */}
          {mode === 'login' && (
            <div className="mt-7 pt-6 border-t border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-700">
                  Быстрый вход по ролям
                </span>
                <span className="text-xs font-mono text-slate-500">Demo1234!</span>
              </div>
              <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg overflow-hidden bg-slate-50/50">
                {DEMO_ACCOUNTS.map((acc) => (
                  <button
                    key={acc.email}
                    type="button"
                    disabled={loading}
                    onClick={() => {
                      setEmail(acc.email);
                      setPassword('Demo1234!');
                      void submitLogin(acc.email, 'Demo1234!');
                    }}
                    className="w-full text-left px-3.5 py-2.5 hover:bg-white transition-colors flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900">{acc.role}</div>
                      <div className="text-xs text-slate-500 truncate">{acc.note}</div>
                    </div>
                    <span className="text-xs font-medium text-blue-700 shrink-0">Войти</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
