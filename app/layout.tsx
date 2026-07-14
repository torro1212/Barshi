import type { Metadata, Viewport } from 'next'
import { Space_Grotesk, Inter } from 'next/font/google'
import { UserProvider } from '@/components/UserProvider'
import { PostHogProvider } from '@/components/PostHogProvider'
import { DevTools } from '@/components/DevTools'
import './globals.css'

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

export const viewport: Viewport = {
  themeColor: '#06060f',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  title: 'Barshi — Build real things with AI',
  description:
    'The safe AI-native creation platform for ages 11–15. Build games, websites, tools, and interactive stories with AI — publish for everyone to see.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  openGraph: {
    title: 'Barshi — Build real things with AI',
    description: 'Build games, websites, and tools with AI. Publish. Get seen.',
    type: 'website',
  },
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>⚡</text></svg>",
  },
}

// Runs before any other JS. Polyfills Object.is for older iOS Safari —
// without this, Zustand's shallow equality throws
// "undefined is not an object (evaluating 'Object.is')".
const POLYFILL_SCRIPT = `if(typeof Object.is!=="function"){Object.is=function(x,y){if(x===y)return x!==0||1/x===1/y;return x!==x&&y!==y;};}`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full ${spaceGrotesk.variable} ${inter.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: POLYFILL_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <DevTools />
        <PostHogProvider>
          <UserProvider>{children}</UserProvider>
        </PostHogProvider>
      </body>
    </html>
  )
}
