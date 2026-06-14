import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import PostHogProvider from '@/components/providers/PostHogProvider'
import { AnnouncementBanner } from '@/components/admin/AnnouncementBanner'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Wayio — Tu viaje perfecto, planificado con IA',
  description:
    'Dinos a dónde quieres ir y cuánto tienes: la IA arma tu itinerario perfecto con vuelos, hoteles y actividades, más GPS en vivo durante el viaje.',
  keywords: ['viajes', 'IA', 'itinerario', 'planificador', 'GPS', 'turismo'],
  openGraph: {
    title: 'Wayio — Tu viaje perfecto, planificado con IA',
    description:
      'Planificación de viajes con IA y navegación GPS en vivo. Tres paquetes a tu medida en segundos.',
    type: 'website',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f8fa' },
    { media: '(prefers-color-scheme: dark)', color: '#070b14' },
  ],
}

// Sets the theme class before paint to avoid a flash of the wrong theme.
const themeScript = `(function(){try{var t=localStorage.getItem('wayio-theme');var d=t?t==='dark':matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d);}catch(e){}})();`

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-full flex-col bg-bg text-fg">
        <PostHogProvider>
          <AnnouncementBanner />
          {children}
        </PostHogProvider>
      </body>
    </html>
  )
}
