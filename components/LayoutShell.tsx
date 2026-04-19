'use client'

import { Suspense } from 'react'
import { useSearchParams, usePathname } from 'next/navigation'
import { Sidebar, BottomNav } from './sidebar'
import { UndoProvider } from '@/lib/undo-stack'
import { UndoToast } from './UndoToast'

function ShellInner({ children }: { children: React.ReactNode }) {
  const params = useSearchParams()
  const pathname = usePathname()
  const embed = params.get('embed') === '1'
  const isSplit = pathname === '/split'

  if (embed) {
    return (
      <UndoProvider>
        <main className="min-h-screen bg-gray-50">{children}</main>
        <UndoToast />
      </UndoProvider>
    )
  }

  if (isSplit) {
    return (
      <UndoProvider>
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 min-w-0 md:ml-64 overflow-hidden">{children}</main>
        </div>
        <BottomNav />
        <UndoToast />
      </UndoProvider>
    )
  }

  return (
    <UndoProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 min-w-0 md:ml-64 p-4 md:p-8 pb-20 md:pb-8 overflow-x-hidden">
          {children}
        </main>
      </div>
      <BottomNav />
      <UndoToast />
    </UndoProvider>
  )
}

export function LayoutShell({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<main className="min-h-screen bg-gray-50">{children}</main>}>
      <ShellInner>{children}</ShellInner>
    </Suspense>
  )
}
