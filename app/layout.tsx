import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Cairo, Tajawal } from 'next/font/google'
import './globals.css'

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  weight: ['600', '700', '800', '900'],
  variable: '--font-cairo',
})

const tajawal = Tajawal({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '700'],
  variable: '--font-tajawal',
})

export const metadata: Metadata = {
  title: 'RemoteStart-DZ | فرص عمل عن بعد للكفاءات الجزائرية',
  description:
    'اكتشف فرص عمل عالمية موثوقة وأنت في الجزائر. سجّل في قائمة الانتظار لتجربة تقنية المطابقة بالذكاء الاصطناعي.',
  generator: 'v0.app',
}

export const viewport: Viewport = {
  themeColor: '#0b1f3a',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${cairo.variable} ${tajawal.variable} bg-background`}
    >
      <body className="font-sans antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
