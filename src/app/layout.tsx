import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { Geist_Mono, Instrument_Sans, Newsreader } from 'next/font/google'
import PostHogProvider from '@/components/providers/PostHogProvider'
import { MotionProvider } from '@/components/providers/MotionProvider'
import { ToastProvider } from '@/components/ui/Toast'
import { AnnouncementBanner } from '@/components/admin/AnnouncementBanner'
import { SkipLink } from '@/components/layout/SkipLink'
import OfflineRegister from '@/components/OfflineRegister'
import { getBaseUrl } from '@/lib/utils/baseUrl'
import './globals.css'

// Display: titulares ≥20 px, palabra de acento del hero, destinos. Normal +
// itálica en una sola declaración, ambas precargadas (la itálica está en el H1,
// que es el LCP). docs/DISENO.md §3.
const newsreader = Newsreader({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  axes: ['opsz'],
  variable: '--font-newsreader',
  display: 'swap',
})

// UI y texto: cuerpo, botones, formularios, tablas, números (tnum).
const instrument = Instrument_Sans({
  subsets: ['latin'],
  axes: ['wdth'], // overlines semicondensadas (font-stretch: 85%)
  variable: '--font-instrument',
  display: 'swap',
})

// Datos: coordenadas, IATA, IDs y claves del admin. Sin preload: se descarga
// solo si se usa.
const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  display: 'swap',
  preload: false,
})

const DESCRIPCION =
  'Cuéntanos qué imaginas. Wayio arma tres versiones de tu itinerario, con horarios, mapa y presupuesto en USD, EUR o DOP. Tú eliges.'

export const metadata: Metadata = {
  metadataBase: new URL(getBaseUrl()),
  title: {
    default: 'Wayio · Tu próximo viaje, trazado día a día',
    template: '%s | Wayio',
  },
  description: DESCRIPCION,
  applicationName: 'Wayio',
  keywords: [
    'viajes',
    'planificador de viajes',
    'itinerario',
    'IA',
    'República Dominicana',
    'turismo',
  ],
  manifest: '/manifest.webmanifest',
  formatDetection: { telephone: false, address: false, email: false },
  appleWebApp: { capable: true, title: 'Wayio', statusBarStyle: 'default' },
  openGraph: {
    type: 'website',
    siteName: 'Wayio',
    locale: 'es_DO',
    title: 'Wayio · Tu próximo viaje, trazado día a día',
    description: DESCRIPCION,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Wayio · Tu próximo viaje, trazado día a día',
    description: DESCRIPCION,
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F7F4EE' },
    { media: '(prefers-color-scheme: dark)', color: '#0B1622' },
  ],
}

/*
 * Script del <head> (docs/DISENO.md §9.4). Corre antes del primer paint:
 * 1. Tema: 'light' | 'dark' | 'system' en localStorage['wayio-theme'].
 * 2. Intro: decide si se reproduce (solo en / sin query, una vez por sesión,
 *    sin movimiento reducido, sin ahorro de datos, sin bots) y conecta el
 *    salto con un listener global pasivo. La intro la monta la landing.
 */
const bootScript = `(function(){var d=document.documentElement;
try{var t=localStorage.getItem('wayio-theme');d.classList.toggle('dark',t&&t!=='system'?t==='dark':matchMedia('(prefers-color-scheme: dark)').matches);}catch(e){}
try{var n=navigator,c=n.connection||{};
var ok=location.pathname==='/'&&!location.search&&!sessionStorage.getItem('wayio-intro-v1')
&&!matchMedia('(prefers-reduced-motion: reduce)').matches&&!c.saveData&&!/2g$/.test(c.effectiveType||'')
&&!n.webdriver&&!/bot|crawl|spider|slurp|lighthouse|headless|preview/i.test(n.userAgent)
&&document.visibilityState!=='hidden';
if(!ok)return;
sessionStorage.setItem('wayio-intro-v1','1');d.dataset.intro='play';
var ev=['pointerdown','keydown','wheel','touchstart'];
function off(){ev.forEach(function(x){removeEventListener(x,skip,true)})}
function done(){d.dataset.intro='done';off()}
function skip(){if(d.dataset.intro!=='play')return;d.dataset.intro='skip';off();setTimeout(done,220)}
ev.forEach(function(x){addEventListener(x,skip,{capture:true,passive:true})});
document.addEventListener('visibilitychange',function(){if(document.hidden)skip()});
window.__wyIntroDone=done;setTimeout(function(){if(d.dataset.intro!=='done')done()},3200);
}catch(e){}})();`

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode
}>) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${newsreader.variable} ${instrument.variable} ${geistMono.variable} h-full`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body className="flex min-h-full flex-col bg-bg text-fg">
        {/* Primer elemento enfocable de toda la app (antes del banner de
            anuncios y del header). Va a #contenido o, si no existe, al <main>. */}
        <SkipLink />
        <PostHogProvider>
          <MotionProvider>
            <ToastProvider>
              <AnnouncementBanner />
              {children}
              <OfflineRegister />
            </ToastProvider>
          </MotionProvider>
        </PostHogProvider>
      </body>
    </html>
  )
}
