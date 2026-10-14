/**
 * Shared LLM utilities — LinguaMind
 *
 * Extracted from chat/route.ts and challenge/chat/route.ts
 * to eliminate code duplication.
 */

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || ""
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1"

export { DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL }

// ============================================================
// SSE 格式化工具
// ============================================================

export function formatSSE(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

export const encoder = new TextEncoder()

// ============================================================
// 调用 LLM (DeepSeek / OpenAI 兼容)
// ============================================================

export async function callLLM(
  messages: Array<{ role: string; content: string }>,
  stream: boolean = false,
  maxTokens: number = 1024,
): Promise<string | ReadableStream<Uint8Array>> {
  const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages,
      temperature: 0.7,
      max_tokens: maxTokens,
      stream,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`LLM API error: ${response.status} ${errorText}`)
  }

  if (stream) {
    return response.body as ReadableStream<Uint8Array>
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content || ""
}

// ============================================================
// 流式处理 DeepSeek SSE 响应
// ============================================================

export async function* streamDeepSeekResponse(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<string> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() || ""

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6).trim()
          if (data === "[DONE]") return

          try {
            const parsed = JSON.parse(data)
            const content = parsed.choices?.[0]?.delta?.content
            if (content) yield content
          } catch {
            // skip non-JSON lines
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

// ============================================================
// 检查 API Key 是否已配置
// ============================================================

export function isApiKeyConfigured(): boolean {
  return !!DEEPSEEK_API_KEY && DEEPSEEK_API_KEY !== "your-deepseek-api-key-here"
}
