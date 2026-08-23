import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Cairo, Tajawal } from 'next/font/google'
import './globals.css'

const cairo = Cairo({ subsets: ['arabic', 'latin'], weight: ['600', '700', '800', '900'], variable: '--font-cairo' })
const tajawal = Tajawal({ subsets: ['arabic', 'latin'], weight: ['400', '500', '700'], variable: '--font-tajawal' })

export const metadata: Metadata = {
  title: 'RemoteStart-DZ | Build your global remote career',
  description: 'RemoteStart-DZ connects Algerian talent with trusted global remote opportunities through a professional, AI-ready career experience.',
  generator: 'Next.js',
}

export const viewport: Viewport = { themeColor: '#071426' }

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" className={`${cairo.variable} ${tajawal.variable} bg-background`}>
      <body className="font-sans antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
