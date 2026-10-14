import { NextRequest, NextResponse } from "next/server"
import { createSession, endSession, insertMessage, upsertDailyStat } from "@/lib/repository"
import { getUserIdFromRequest } from "@/lib/auth"

export async function POST(request: NextRequest) {
  try {
    const userId = getUserIdFromRequest(request)
    const body = await request.json()
    const { sessionId, sceneId, sceneTitle, language, messages, totalRounds, avgScore } = body

    if (!sessionId || !sceneId || !language) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // 创建会话
    createSession(userId, {
      id: sessionId,
      scene_id: sceneId,
      scene_title: sceneTitle || sceneId,
      language,
      started_at: new Date().toISOString(),
    })

    // 保存消息
    for (const msg of messages || []) {
      insertMessage(userId, {
        session_id: sessionId,
        role: msg.role,
        content: msg.content,
        score: msg.score ?? null,
        feedback: msg.feedback ?? null,
      })
    }

    // 结束会话
    if (totalRounds !== undefined && avgScore !== undefined) {
      endSession(userId, sessionId, totalRounds, avgScore)
    }

    // 更新学习统计（今日数据）
    const todayStr = new Date().toISOString().slice(0, 10)
    const existing = await getExistingStat(userId, todayStr, language)
    const roundCount = totalRounds ?? (messages?.filter((m: any) => m.role === "user").length || 0)

    upsertDailyStat(userId, {
      date: todayStr,
      language,
      dialogue_count: (existing?.dialogue_count || 0) + 1,
      total_rounds: (existing?.total_rounds || 0) + roundCount,
      duration_minutes: existing?.duration_minutes || 0,
      new_vocab_count: existing?.new_vocab_count || 0,
      avg_accuracy: avgScore ?? existing?.avg_accuracy ?? 0,
      scene_distribution: existing?.scene_distribution || "{}",
      error_types: existing?.error_types || "{}",
    })

    return NextResponse.json({ success: true, sessionId })
  } catch (err) {
    console.error("[history/save] Error:", err)
    return NextResponse.json({ error: "Failed to save session" }, { status: 500 })
  }
}

async function getExistingStat(userId: string, date: string, language: string) {
  const { getStatsInRange } = await import("@/lib/repository")
  const stats = getStatsInRange(userId, date, date, language as "en" | "ko")
  return stats[0] || null
}
