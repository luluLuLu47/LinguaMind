/**
 * POST /api/daily/pronounce-score
 *
 * 发音评分 API
 * 请求体：{ text: string, userTranscript: string, lang: "en" | "ko" }
 * 返回：PronunciationScore
 */

import { NextRequest, NextResponse } from "next/server"
import { scorePronunciation } from "@/lib/dashscope"
import { upsertCheckin } from "@/lib/repository"
import { getUserIdFromRequest } from "@/lib/auth"
import { checkRateLimit, getClientIp, LLM_RATE_LIMIT } from "@/lib/rate-limit"

export async function POST(request: NextRequest) {
  // 速率限制：防刷评分 API
  const ip = getClientIp(request)
  const rl = checkRateLimit(ip, "pronounce-score", LLM_RATE_LIMIT)
  if (!rl.success) {
    return NextResponse.json(
      { error: rl.message },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    )
  }

  try {
    const userId = getUserIdFromRequest(request)
    const body = await request.json()
    const { text, userTranscript, lang } = body as {
      text: string
      userTranscript: string
      lang: "en" | "ko"
    }

    if (!text || !userTranscript || !lang) {
      return NextResponse.json(
        { error: "Missing required fields: text, userTranscript, lang" },
        { status: 400 }
      )
    }

    if (lang !== "en" && lang !== "ko") {
      return NextResponse.json(
        { error: "Invalid language. Use 'en' or 'ko'." },
        { status: 400 }
      )
    }

    const score = await scorePronunciation(text, userTranscript, lang)

    // 同步写入 SQLite
    try {
      const todayStr = new Date().toISOString().slice(0, 10)
      upsertCheckin(userId, {
        date: todayStr,
        language: lang,
        sentence_id: `daily-${todayStr}`,
        sentence_text: text,
        pronounce_score: score.overallScore,
        sentence_score: null,
        completed: 0,
      })
    } catch (dbErr) {
      console.warn("[pronounce-score] Failed to sync to SQLite:", dbErr)
    }

    return NextResponse.json(score)
  } catch (error) {
    console.error("Pronunciation scoring failed:", error)

    // 返回降级评分（标注 degraded，让前端可识别）
    return NextResponse.json({
      overallScore: 75,
      accuracy: 75,
      fluency: 75,
      completeness: 75,
      wordScores: [],
      degraded: true,
      feedback: "AI 评分服务暂不可用，已返回默认分数，请稍后重试。",
    })
  }
}
