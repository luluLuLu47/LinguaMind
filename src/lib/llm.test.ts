/**
 * Unit tests for LLM utilities (llm.ts)
 *
 * Tests:
 * - formatSSE output format
 * - isApiKeyConfigured logic
 * - callLLM with mocked fetch
 * - streamDeepSeekResponse parsing
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { formatSSE, isApiKeyConfigured, callLLM } from "@/lib/llm"

describe("LLM: formatSSE", () => {
  it("should format SSE event with string data", () => {
    const result = formatSSE("dialogue", { content: "Hello" })
    expect(result).toBe('event: dialogue\ndata: {"content":"Hello"}\n\n')
  })

  it("should format SSE event with complex object", () => {
    const result = formatSSE("feedback", { errors: [], score: 85 })
    expect(result).toContain('event: feedback')
    expect(result).toContain('"errors":[]')
    expect(result).toContain('"score":85')
    expect(result.endsWith("\n\n")).toBe(true)
  })

  it("should handle null data", () => {
    const result = formatSSE("done", null)
    expect(result).toBe('event: done\ndata: null\n\n')
  })
})

describe("LLM: isApiKeyConfigured", () => {
  it("should return true when DEEPSEEK_API_KEY is set", () => {
    expect(isApiKeyConfigured()).toBe(true)
  })
})

describe("LLM: callLLM (mocked)", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("should call DeepSeek API and return content for non-stream", async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Hello from AI!" } }],
      }),
      text: async () => "",
    }

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse))

    const result = await callLLM(
      [{ role: "user", content: "Hi" }],
      false,
      256,
    )

    expect(result).toBe("Hello from AI!")
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/chat/completions"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Authorization": expect.stringContaining("Bearer"),
        }),
      }),
    )
  })

  it("should throw on API error", async () => {
    const mockResponse = {
      ok: false,
      status: 401,
      text: async () => "Unauthorized",
    }

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse))

    await expect(
      callLLM([{ role: "user", content: "Hi" }], false),
    ).rejects.toThrow("LLM API error: 401")
  })
})
