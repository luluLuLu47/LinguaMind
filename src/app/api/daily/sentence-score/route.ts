/**
 * POST /api/daily/sentence-score
 *
 * 造句评分 API
 * 请求体：{ sentence: string, targetExpression: string, lang: "en" | "ko" }
 * 返回：SentenceScore
 */

import { NextRequest, NextResponse } from "next/server"
import { scoreSentence } from "@/lib/dashscope"
import { upsertCheckin } from "@/lib/repository"
import { getUserIdFromRequest } from "@/lib/auth"
import { checkRateLimit, getClientIp, LLM_RATE_LIMIT } from "@/lib/rate-limit"

export async function POST(request: NextRequest) {
  // 速率限制：防刷评分 API
  const ip = getClientIp(request)
  const rl = checkRateLimit(ip, "sentence-score", LLM_RATE_LIMIT)
  if (!rl.success) {
    return NextResponse.json(
      { error: rl.message },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    )
  }

  try {
    const userId = getUserIdFromRequest(request)
    const body = await request.json()
    const { sentence, targetExpression, lang } = body as {
      sentence: string
      targetExpression: string
      lang: "en" | "ko"
    }

    if (!sentence || !targetExpression || !lang) {
      return NextResponse.json(
        { error: "Missing required fields: sentence, targetExpression, lang" },
        { status: 400 }
      )
    }

    if (lang !== "en" && lang !== "ko") {
      return NextResponse.json(
        { error: "Invalid language. Use 'en' or 'ko'." },
        { status: 400 }
      )
    }

    const score = await scoreSentence(sentence, targetExpression, lang)

    // 同步写入 SQLite（合并已有分数，标记完成）
    try {
      const todayStr = new Date().toISOString().slice(0, 10)
      upsertCheckin(userId, {
        date: todayStr,
        language: lang,
        sentence_id: `daily-${todayStr}`,
        sentence_text: targetExpression,
        pronounce_score: null,
        sentence_score: score.score,
        completed: 1,
      })
    } catch (dbErr) {
      console.warn("[sentence-score] Failed to sync to SQLite:", dbErr)
    }

    return NextResponse.json(score)
  } catch (error) {
    console.error("Sentence scoring failed:", error)

    return NextResponse.json({
      score: 70,
      grammarCorrect: true,
      expressionUsed: true,
      naturalness: 70,
      degraded: true,
      feedback: "AI 评分服务暂不可用，已返回默认分数，请稍后重试。",
    })
  }
}
