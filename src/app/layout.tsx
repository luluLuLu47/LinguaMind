import type { Metadata } from "next"
import "./globals.css"
import { LanguageProvider } from "@/lib/language-context"
import { AuthProvider } from "@/lib/auth-context"
import { Navbar } from "@/components/navbar"
import { BottomNav } from "@/components/bottom-nav"

export const metadata: Metadata = {
  title: "LinguaMind - AI Language Learning Agent",
  description: "Practice speaking English and Korean with an AI tutor that gives you real-time feedback.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-neutral-50">
        <LanguageProvider>
          <AuthProvider>
            <Navbar />
            <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-6 pb-20 md:pb-6">
              {children}
            </main>
            <BottomNav />
          </AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  )
}
