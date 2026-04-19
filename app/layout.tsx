import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { LayoutShell } from '@/components/LayoutShell'
import { OpeningAnimation } from '@/components/OpeningAnimation'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '인생 플래너',
  description: '10년 계획부터 주간 계획까지 체계적으로 관리하는 플래너',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className={`${inter.className} bg-gray-50 min-h-screen`}>
        <OpeningAnimation />
        <LayoutShell>{children}</LayoutShell>
      </body>
    </html>
  )
}
