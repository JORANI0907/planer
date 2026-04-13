import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Sidebar, BottomNav } from '@/components/sidebar'

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
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 min-w-0 md:ml-64 p-4 md:p-8 pb-20 md:pb-8 overflow-x-hidden">
            {children}
          </main>
        </div>
        <BottomNav />
      </body>
    </html>
  )
}
