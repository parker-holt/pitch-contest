import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'TruRisk Pitch & Demo Contest',
  description: 'Live sales pitch competition leaderboard',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
