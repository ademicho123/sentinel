import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = { title: 'Sentinel · Family care', description: 'A calmer view of everyday wellbeing.' }
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>
}
