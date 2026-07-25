import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = { title: 'Sentinel · Family care', description: 'You call your parent; Sentinel turns the conversation into gentle wellbeing feedback. It never calls on its own and never replaces hearing their voice.' }
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>
}
