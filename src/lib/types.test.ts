/**
 * Unit tests for types.ts
 *
 * Validates language configuration structure and values.
 */

import { describe, it, expect } from "vitest"
import { LANGUAGE_CONFIGS, type Language } from "@/lib/types"

describe("Types: Language Configuration", () => {
  it("should have English and Korean configs", () => {
    expect(LANGUAGE_CONFIGS.en).toBeDefined()
    expect(LANGUAGE_CONFIGS.ko).toBeDefined()
  })

  it("should have correct English config", () => {
    const en = LANGUAGE_CONFIGS.en
    expect(en.code).toBe("en")
    expect(en.name).toBe("English")
    expect(en.nativeName).toBe("English")
    expect(en.flag).toBe("🇬🇧")
    expect(en.primaryColor).toMatch(/^#[0-9A-Fa-f]{6}$/)
    expect(en.ttsVoice).toBe("en-US-JennyNeural")
  })

  it("should have correct Korean config", () => {
    const ko = LANGUAGE_CONFIGS.ko
    expect(ko.code).toBe("ko")
    expect(ko.name).toBe("Korean")
    expect(ko.nativeName).toBe("한국어")
    expect(ko.flag).toBe("🇰🇷")
    expect(ko.primaryColor).toMatch(/^#[0-9A-Fa-f]{6}$/)
    expect(ko.ttsVoice).toBe("ko-KR-SunHiNeural")
  })

  it("should have different primary colors for each language", () => {
    expect(LANGUAGE_CONFIGS.en.primaryColor).not.toBe(LANGUAGE_CONFIGS.ko.primaryColor)
  })

  it("should have different TTS voices for each language", () => {
    expect(LANGUAGE_CONFIGS.en.ttsVoice).not.toBe(LANGUAGE_CONFIGS.ko.ttsVoice)
  })

  it("should have valid hex color format for all configs", () => {
    for (const key of Object.keys(LANGUAGE_CONFIGS) as Language[]) {
      const config = LANGUAGE_CONFIGS[key]
      expect(config.primaryColor).toMatch(/^#[0-9A-Fa-f]{6}$/)
      expect(config.secondaryColor).toMatch(/^#[0-9A-Fa-f]{6}$/)
    }
  })
})
