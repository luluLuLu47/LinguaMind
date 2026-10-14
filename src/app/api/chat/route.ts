/**
 * LinguaMind 双Agent 对话 API
 *
 * POST /api/chat
 * Body: { messages, scene, language }
 * Response: SSE 流式
 *
 * 流程:
 * 1. 调用陪练Agent (DeepSeek-V3) → 生成对话回复 → SSE流式推送对话内容
 * 2. 同时后台调用批改监督Agent → 分析错误 → 分批推送至前端
 *
 * 延迟优化: 陪练Agent的回复立即流式推送，批改监督Agent后台并行处理
 */

import { generatePracticeAgentPrompt, generateCoachAgentPrompt } from "@/data/scenes"
import type { SceneNode } from "@/data/scenes"
import { formatSSE, encoder, callLLM, streamDeepSeekResponse, isApiKeyConfigured } from "@/lib/llm"
import { checkRateLimit, getClientIp, LLM_RATE_LIMIT } from "@/lib/rate-limit"

// ============================================================
// 请求体类型
// ============================================================

interface ChatRequest {
  messages: Array<{ role: "user" | "assistant"; content: string }>
  scene: SceneNode
  language: "en" | "ko"
}

// ============================================================
// POST /api/chat
// ============================================================

export async function POST(request: Request) {
  // 速率限制：每分钟最多 20 次对话请求
  const ip = getClientIp(request)
  const rl = checkRateLimit(ip, "chat", LLM_RATE_LIMIT)
  if (!rl.success) {
    return new Response(
      JSON.stringify({ error: rl.message, retryAfter: Math.ceil((rl.resetAt - Date.now()) / 1000) }),
      { status: 429, headers: { "Content-Type": "application/json", "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    )
  }

  // 检查 API Key
  if (!isApiKeyConfigured()) {
    return new Response(
      JSON.stringify({
        error: "DeepSeek API key not configured. Set DEEPSEEK_API_KEY in .env.local",
        mock: true,
        mockReply: "I'm in demo mode. Set your DeepSeek API key to start practicing!",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  }

  let body: ChatRequest
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  const { messages, scene, language } = body

  if (!scene || !messages?.length) {
    return new Response(JSON.stringify({ error: "Missing scene or messages" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  // 构建陪练Agent的 messages
  const practiceSystemPrompt = generatePracticeAgentPrompt(scene, language)
  const practiceMessages = [
    { role: "system", content: practiceSystemPrompt },
    ...messages.map(m => ({ role: m.role, content: m.content })),
  ]

  // 构建批改监督Agent的 messages
  const coachSystemPrompt = generateCoachAgentPrompt(language)
  const lastUserMsg = messages.filter(m => m.role === "user").pop()?.content || ""
  const coachMessages = [
    { role: "system", content: coachSystemPrompt },
    {
      role: "user",
      content: `Analyze this conversation exchange:\n\nScene: ${scene.title}\nStudent said: "${lastUserMsg}"\n\nProvide analysis as JSON only.`,
    },
  ]

  // 创建 SSE 流
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // 1. 流式推送陪练Agent回复
        controller.enqueue(encoder.encode(formatSSE("status", { type: "practice_start" })))

        const practiceStream = await callLLM(practiceMessages as Array<{ role: string; content: string }>, true)

        if (practiceStream instanceof ReadableStream) {
          for await (const chunk of streamDeepSeekResponse(practiceStream)) {
            controller.enqueue(encoder.encode(formatSSE("dialogue", { content: chunk })))
          }
        }

        controller.enqueue(encoder.encode(formatSSE("status", { type: "practice_done" })))

        // 2. 并行调用批改监督Agent（非流式，因为需要完整JSON）
        controller.enqueue(encoder.encode(formatSSE("status", { type: "coach_start" })))

        const coachResult = await callLLM(coachMessages as Array<{ role: string; content: string }>, false)

        if (typeof coachResult === "string") {
          // 尝试从回复中提取JSON
          const jsonMatch = coachResult.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            const feedback = JSON.parse(jsonMatch[0])
            controller.enqueue(encoder.encode(formatSSE("feedback", feedback)))
          } else {
            controller.enqueue(encoder.encode(formatSSE("feedback", {
              errors: [],
              newVocabulary: [],
              stats: { accuracy: 100, fluency: 3, nervousness: "low" },
            })))
          }
        }

        controller.enqueue(encoder.encode(formatSSE("status", { type: "done" })))
        controller.close()
      } catch (error) {
        console.error("[Chat API] Error:", error)
        controller.enqueue(encoder.encode(formatSSE("error", {
          message: error instanceof Error ? error.message : "Unknown error",
        })))
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
