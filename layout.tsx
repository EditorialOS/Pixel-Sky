import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Editorial OS',
  description: 'AI-first operating system for content and communications. One chat, all tools.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="grain antialiased">
        {children}
      </body>
    </html>
  )
}
