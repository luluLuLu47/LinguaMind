export type Language = "en" | "ko"

export interface LanguageConfig {
  code: Language
  name: string
  nativeName: string
  flag: string
  primaryColor: string
  secondaryColor: string
  ttsVoice: string
}

export const LANGUAGE_CONFIGS: Record<Language, LanguageConfig> = {
  en: {
    code: "en",
    name: "English",
    nativeName: "English",
    flag: "🇬🇧",
    primaryColor: "#2563EB",
    secondaryColor: "#DBEAFE",
    ttsVoice: "en-US-JennyNeural",
  },
  ko: {
    code: "ko",
    name: "Korean",
    nativeName: "한국어",
    flag: "🇰🇷",
    primaryColor: "#7C3AED",
    secondaryColor: "#EDE9FE",
    ttsVoice: "ko-KR-SunHiNeural",
  },
}
