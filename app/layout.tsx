import type { Metadata } from "next"
import { Geist_Mono, Plus_Jakarta_Sans } from "next/font/google"

import "./globals.css"
import "./md.css"
import { THEME_SCRIPT } from "@/components/md/theme"
import { ToastProvider } from "@/components/md/toast"

// Plus Jakarta Sans: the approved free look-alike of the reference's font.
const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"] })
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] })

export const metadata: Metadata = {
  title: { default: "MasterDB", template: "%s · MasterDB" },
  description: "Norden Capital contact database",
  robots: { index: false, follow: false },
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // data-theme is set before paint by THEME_SCRIPT (light only for now).
    <html lang="en" className={`${jakarta.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  )
}
