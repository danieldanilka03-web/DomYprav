import type { Metadata } from 'next';
import { IBM_Plex_Mono, Manrope } from 'next/font/google';
import './globals.css';

const manrope = Manrope({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-manrope',
  display: 'swap',
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600'],
  variable: '--font-ibm-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ДомоУправ — Управление эксплуатацией МКД',
  description:
    'Информационная система автоматизации процессов управления эксплуатацией многоквартирных домов: реестр МКД, диспетчеризация заявок, техобслуживание, учёт аварий, склад и аналитика.',
  openGraph: {
    title: 'ДомоУправ — Управление эксплуатацией МКД',
    description:
      'Единая цифровая платформа для управляющей организации, диспетчерской службы, технических бригад и жителей.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ДомоУправ — Управление эксплуатацией МКД',
    description:
      'Автоматизация эксплуатации многоквартирного жилого фонда: заявки, инженерные системы, склад и аналитика.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${manrope.variable} ${ibmPlexMono.variable}`}>
      <body
        suppressHydrationWarning
        className="font-sans bg-slate-50 text-slate-900 antialiased selection:bg-blue-100 selection:text-blue-900"
      >
        {children}
      </body>
    </html>
  );
}
