import { NextRequest, NextResponse } from "next/server"
import {
  getCheckinStreak,
  getSessionCountInRange,
  getCumulativeVocab,
  getTodayCheckin,
  getStatsInRange,
} from "@/lib/repository"
import { getUserIdFromRequest } from "@/lib/auth"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const lang = (searchParams.get("lang") || "en") as "en" | "ko"
  const userId = getUserIdFromRequest(request)

  try {
    const streak = getCheckinStreak(userId, lang)

    // 总对话数（全部历史）
    const totalDialogues = getSessionCountInRange(userId, "2000-01-01", "2099-12-31", lang)

    // 总词汇数（累积）
    const todayStr = new Date().toISOString().slice(0, 10)
    const totalWords = getCumulativeVocab(userId, todayStr, lang)

    // 今日打卡
    const todayCheckin = getTodayCheckin(userId, lang, todayStr)
    const todayCompleted = todayCheckin?.completed === 1

    // 今日已练场景数
    const todayScenes = getSessionCountInRange(userId, todayStr, todayStr, lang)

    // 热力图：优先使用 learning_stats（对话数据），回退到 daily_checkins
    const heatmapData = buildHeatmap(userId, lang)

    return NextResponse.json({
      streak,
      totalDialogues,
      totalWords,
      todayScenes,
      todayCompleted,
      heatmapData,
    })
  } catch (err) {
    console.error("[home/stats] Error:", err)
    return NextResponse.json({
      streak: 0,
      totalDialogues: 0,
      totalWords: 0,
      todayScenes: 0,
      todayCompleted: false,
      heatmapData: [],
    })
  }
}

function buildHeatmap(userId: string, lang: "en" | "ko") {
  const days = 90
  const since = new Date()
  since.setDate(since.getDate() - days)
  const sinceStr = since.toISOString().slice(0, 10)
  const todayStr = new Date().toISOString().slice(0, 10)

  // 从 learning_stats 读取对话数据
  const stats = getStatsInRange(userId, sinceStr, todayStr, lang)
  const statsMap = new Map(stats.map(s => [s.date, s]))

  // 构建每天的等级（基于 dialogue_count + total_rounds）
  const heatmap: { date: string; level: number }[] = []
  const cursor = new Date(since)
  for (let i = 0; i < days; i++) {
    const dateStr = cursor.toISOString().slice(0, 10)
    const stat = statsMap.get(dateStr)
    if (stat && (stat.dialogue_count > 0 || stat.total_rounds > 0)) {
      const score = stat.dialogue_count * 2 + stat.total_rounds
      const level = score >= 20 ? 4 : score >= 12 ? 3 : score >= 6 ? 2 : 1
      heatmap.push({ date: dateStr, level })
    } else {
      heatmap.push({ date: dateStr, level: 0 })
    }
    cursor.setDate(cursor.getDate() + 1)
  }

  return heatmap
}
