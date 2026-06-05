import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Resumos Med',
  description: 'Plataforma de resumos médicos',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  )
}
