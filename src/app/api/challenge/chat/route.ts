/**
 * 随机挑战 - 对话接口（回合制）
 *
 * POST /api/challenge/chat
 * Body: { messages, scene, language, round, totalRounds }
 * Response: SSE 流式 (dialogue + roundScore + finalScore)
 *
 * 每轮对话后，批改监督Agent给出该轮评分（1-10），
 * 最后一轮（round === totalRounds）额外给出总分和评级。
 *
 * 优化: 评分与批改并行执行 (Promise.all)
 */

import { generatePracticeAgentPrompt, generateCoachAgentPrompt } from "@/data/scenes"
import type { SceneNode } from "@/data/scenes"
import { formatSSE, encoder, callLLM, streamDeepSeekResponse, isApiKeyConfigured } from "@/lib/llm"

// ============================================================
// 类型
// ============================================================

interface ChallengeChatRequest {
  messages: Array<{ role: "user" | "assistant"; content: string }>
  scene: SceneNode
  language: "en" | "ko"
  round: number
  totalRounds: number
}

interface RoundScore {
  round: number
  score: number       // 1-10
  comment: string     // 简短中文点评
}

// ============================================================
// 评分
// ============================================================

function calculateGrade(score: number, maxScore: number): "S" | "A" | "B" | "C" {
  const ratio = score / maxScore
  if (ratio >= 0.9) return "S"
  if (ratio >= 0.75) return "A"
  if (ratio >= 0.6) return "B"
  return "C"
}

const GRADE_COMMENTS: Record<string, Record<string, string>> = {
  S: {
    en: "Outstanding! You're a natural communicator!",
    ko: "대단해요! 타고난 소통가네요!",
  },
  A: {
    en: "Great job! Keep practicing and you'll be perfect.",
    ko: "잘했어요! 조금만 더 연습하면 완벽할 거예요.",
  },
  B: {
    en: "Good effort! Focus on the areas highlighted above.",
    ko: "좋은 노력이에요! 위에서 지적된 부분에 집중해 보세요.",
  },
  C: {
    en: "Keep going! Every conversation makes you better.",
    ko: "계속해요! 모든 대화가 당신을 더 나아지게 해요.",
  },
}

// ============================================================
// POST /api/challenge/chat
// ============================================================

export async function POST(request: Request) {
  if (!isApiKeyConfigured()) {
    return new Response(
      JSON.stringify({ error: "API key not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }

  let body: ChallengeChatRequest
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  const { messages, scene, language, round, totalRounds } = body
  const isLastRound = round >= totalRounds

  if (!scene || !messages?.length) {
    return new Response(JSON.stringify({ error: "Missing scene or messages" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  // 陪练Agent
  const practiceSystemPrompt = generatePracticeAgentPrompt(scene, language)
  const practiceMessages = [
    { role: "system", content: practiceSystemPrompt },
    ...messages.map(m => ({ role: m.role, content: m.content })),
  ]

  // 批改监督Agent（含评分指令）
  const coachSystemPrompt = generateCoachAgentPrompt(language)
  const lastUserMsg = messages.filter(m => m.role === "user").pop()?.content || ""

  // 评分专用 prompt
  const scorePrompt = language === "en"
    ? `Rate this student response on a scale of 1-10.

Criteria:
- Grammar accuracy (3 pts): correct grammar usage
- Vocabulary variety (3 pts): diverse and appropriate word choices
- Fluency (2 pts): natural flow, no awkward phrasing
- Task completion (2 pts): successfully communicated the intended message

Student response: "${lastUserMsg}"
Scene: ${scene.title}

Output ONLY a JSON object:
{"score": number, "comment": "brief Chinese comment"}`
    : `이 학생의 응답을 1-10점으로 평가해 주세요.

기준:
- 문법 정확도 (3점): 올바른 문법 사용
- 어휘 다양성 (3점): 다양하고 적절한 단어 선택
- 유창성 (2점): 자연스러운 흐름
- 과제 완성도 (2점): 의도한 메시지를 성공적으로 전달

학생 응답: "${lastUserMsg}"
장면: ${scene.title}

JSON 객체만 출력하세요:
{"score": number, "comment": "간단한 중국어 코멘트"}`

  // 创建 SSE 流
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // 1. 流式推送陪练Agent回复
        controller.enqueue(encoder.encode(formatSSE("status", { type: "practice_start", round })))

        const practiceStream = await callLLM(
          practiceMessages as Array<{ role: string; content: string }>,
          true,
          1024,
        )

        if (practiceStream instanceof ReadableStream) {
          for await (const chunk of streamDeepSeekResponse(practiceStream)) {
            controller.enqueue(encoder.encode(formatSSE("dialogue", { content: chunk })))
          }
        }

        controller.enqueue(encoder.encode(formatSSE("status", { type: "practice_done", round })))

        // 2. 评分与批改并行执行 (优化: 原串行 → 并行)
        const coachMessages = [
          { role: "system", content: coachSystemPrompt },
          {
            role: "user",
            content: `Analyze this conversation exchange:\n\nScene: ${scene.title}\nStudent said: "${lastUserMsg}"\n\nProvide analysis as JSON only.`,
          },
        ]

        const [scoreResult, coachResult] = await Promise.all([
          callLLM(
            [
              { role: "system", content: "You are a strict but fair language evaluator. Output only valid JSON." },
              { role: "user", content: scorePrompt },
            ],
            false,
            256,
          ),
          callLLM(coachMessages as Array<{ role: string; content: string }>, false, 512),
        ])

        // 处理评分结果
        let roundScore: RoundScore = { round, score: 7, comment: "Good effort!" }
        if (typeof scoreResult === "string") {
          const jsonMatch = scoreResult.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            try {
              const parsed = JSON.parse(jsonMatch[0])
              roundScore = {
                round,
                score: Math.min(10, Math.max(1, parsed.score || 7)),
                comment: parsed.comment || (language === "en" ? "Keep going!" : "계속하세요!"),
              }
            } catch { /* use default */ }
          }
        }

        controller.enqueue(encoder.encode(formatSSE("roundScore", roundScore)))

        // 处理批改结果
        if (typeof coachResult === "string") {
          const jsonMatch = coachResult.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            try {
              const feedback = JSON.parse(jsonMatch[0])
              controller.enqueue(encoder.encode(formatSSE("feedback", feedback)))
            } catch {
              controller.enqueue(encoder.encode(formatSSE("feedback", {
                errors: [],
                newVocabulary: [],
                stats: { accuracy: 100, fluency: 3, nervousness: "low" },
              })))
            }
          }
        }

        // 3. 最后一轮：通知前端
        if (isLastRound) {
          controller.enqueue(encoder.encode(formatSSE("challengeComplete", {
            isLastRound: true,
            finalRound: round,
          })))
        }

        controller.enqueue(encoder.encode(formatSSE("status", { type: "done", round })))
        controller.close()
      } catch (error) {
        console.error("[Challenge Chat API] Error:", error)
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
