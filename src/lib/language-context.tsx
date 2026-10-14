"use client"

import * as React from "react"
import { Language, LanguageConfig, LANGUAGE_CONFIGS } from "./types"

interface LanguageContextValue {
  language: Language
  config: LanguageConfig
  setLanguage: (lang: Language) => void
}

const LanguageContext = React.createContext<LanguageContextValue | undefined>(undefined)

const STORAGE_KEY = "linguamind_lang"

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = React.useState<Language>("en")

  // Initialize from localStorage on mount (client-side only)
  React.useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null
    if (stored === "en" || stored === "ko") {
      setLanguageState(stored)
    }
  }, [])

  // Sync data-lang attribute on <html> for CSS variable switching
  React.useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-lang", language)
    }
  }, [language])

  const setLanguage = React.useCallback((lang: Language) => {
    setLanguageState(lang)
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, lang)
    }
  }, [])

  const value: LanguageContextValue = {
    language,
    config: LANGUAGE_CONFIGS[language],
    setLanguage,
  }

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = React.useContext(LanguageContext)
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider")
  }
  return context
}
