/**
 * GET /api/report/advice?lang=en|ko
 *
 * AI 学习建议 API
 * 使用 Qwen 根据本周真实学习数据生成个性化学习建议
 */

import { NextRequest, NextResponse } from "next/server"
import { qwenChat } from "@/lib/dashscope"
import {
  getSessionCountInRange,
  getTotalRoundsInRange,
  getAvgAccuracyInRange,
  getDailyAccuracy,
  getVocabCountInRange,
} from "@/lib/repository"
import { getUserIdFromRequest } from "@/lib/auth"
import { checkRateLimit, getClientIp, LLM_RATE_LIMIT } from "@/lib/rate-limit"

/** 计算本周日期范围（周一～今日） */
function getWeekRange() {
  const today = new Date()
  const dayOfWeek = today.getDay()
  const monday = new Date(today)
  monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
  const from = monday.toISOString().slice(0, 10)
  const to = today.toISOString().slice(0, 10)

  const days: string[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    days.push(d.toISOString().split("T")[0])
  }
  return { from, to, days }
}

/** 从 dialogue_messages 中统计 coach 反馈的错误类型（英文场景反馈是中文，改用中文关键词） */
function getErrorTypeStats(userId: string, from: string, to: string, lang: "en" | "ko"): Array<{ type: string; count: number }> {
  try {
    // 用动态 import 避免循环依赖
    const { getDb } = require("@/lib/db")
    const db = getDb()
    const rows = db.prepare(
      `SELECT dm.feedback FROM dialogue_messages dm
       JOIN dialogue_sessions ds ON dm.session_id = ds.id
       WHERE dm.role = 'coach'
       AND dm.feedback IS NOT NULL
       AND ds.user_id = ?
       AND ds.language = ?
       AND ds.started_at >= ? AND ds.started_at <= ?`
    ).all(userId, lang, from, to) as { feedback: string }[]

    // feedback 内容是中文（coach agent 的中文解释），所以统一用中文关键词匹配
    const errorCounts: Record<string, number> = {
      语法: 0,
      词汇: 0,
      发音: 0,
      时态: 0,
      语序: 0,
    }
    const grammarKw = ["语法", "时态", "冠词", "介词", "조사", "어미", "문법"]
    const vocabKw = ["词汇", "单词", "短语", "表达", "어휘", "단어", "표현"]
    const pronKw = ["发音", "口音", "语调", "발음", "억양"]
    const tenseKw = ["时态", "过去", "现在", "将来", "시제", "과거", "미래"]
    const orderKw = ["语序", "结构", "句法", "어순", "구조"]

    for (const row of rows) {
      const fb = String(row.feedback || "").toLowerCase()
      if (grammarKw.some(kw => fb.includes(kw.toLowerCase()))) errorCounts.语法++
      if (vocabKw.some(kw => fb.includes(kw.toLowerCase()))) errorCounts.词汇++
      if (pronKw.some(kw => fb.includes(kw.toLowerCase()))) errorCounts.发音++
      if (tenseKw.some(kw => fb.includes(kw.toLowerCase()))) errorCounts.时态++
      if (orderKw.some(kw => fb.includes(kw.toLowerCase()))) errorCounts.语序++
    }

    return Object.entries(errorCounts)
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => ({ type, count }))
  } catch {
    return []
  }
}

export async function GET(request: NextRequest) {
  // 速率限制
  const ip = getClientIp(request)
  const rl = checkRateLimit(ip, "report-advice", LLM_RATE_LIMIT)
  if (!rl.success) {
    return NextResponse.json(
      { error: rl.message },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    )
  }

  const { searchParams } = new URL(request.url)
  const lang = (searchParams.get("lang") || "en") as "en" | "ko"
  const langName = lang === "en" ? "English" : "Korean"
  const userId = getUserIdFromRequest(request)

  // 从 SQLite 读取本周真实学习数据
  const { from, to, days } = getWeekRange()
  const totalConversations = getSessionCountInRange(userId, from, to, lang)
  const totalRounds = getTotalRoundsInRange(userId, from, to, lang)
  const newVocab = getVocabCountInRange(userId, from, to, lang)
  const avgAccuracy = getAvgAccuracyInRange(userId, from, to, lang)
  const estimatedMinutes = Math.round(totalRounds * 2)

  // 准确率趋势：最近 7 天
  const accuracyTrendRaw = getDailyAccuracy(userId, from, to, lang)
  const accuracyMap = new Map(accuracyTrendRaw.map(r => [r.date, r.accuracy]))
  const accuracyTrend = days
    .map(date => accuracyMap.get(date) ?? 0)
    .filter(v => v > 0)

  // 错误类型统计
  const errorTypes = getErrorTypeStats(userId, from, to, lang)

  const accuracyTrendText = accuracyTrend.length > 0
    ? accuracyTrend.map(v => `${v}%`).join(" → ")
    : "暂无数据"

  const errorTypesText = errorTypes.length > 0
    ? errorTypes.map(e => `${e.type}(${e.count})`).join("、")
    : "暂无错误统计"

  const hasData = totalConversations > 0

  try {
    const result = await qwenChat(
      [
        {
          role: "system",
          content: `你是一位专业的${langName}语言学习教练。根据学生本周学习数据，用中文给出个性化、可执行的建议。语气鼓励但真诚，总字数控制在 300 字以内。`,
        },
        {
          role: "user",
          content: `以下是学生本周${langName}学习真实数据：

- 对话练习：${totalConversations} 次
- 学习时长估算：${estimatedMinutes} 分钟（${totalRounds} 轮）
- 新增词汇：${newVocab} 个
- 平均准确率：${hasData ? avgAccuracy + "%" : "暂无数据"}
- 准确率趋势（最近7天）：${accuracyTrendText}
- 主要错误类型：${errorTypesText}

请输出：
1. 总体评价（1-2句，鼓励为主）
2. 优点（1-2点，结合数据）
3. 不足（1-2点，结合数据，诚实指出）
4. 具体练习建议（2-3条，可执行、可量化，如"每天练10分钟发音"）
5. 下周重点（1句，简洁）

全部用中文，数据驱动，不要泛泛而谈。`,
        },
      ],
      { temperature: 0.7, maxTokens: 600 }
    )

    return NextResponse.json({ advice: result.content, source: "ai" })
  } catch (error) {
    console.warn("AI advice generation failed:", error)
    // fallback：基于真实数据给出合理的降级文案
    const fallbackAdvice = hasData
      ? `本周共完成 ${totalConversations} 次对话（约 ${estimatedMinutes} 分钟），平均准确率 ${avgAccuracy}%，新增词汇 ${newVocab} 个。${
          avgAccuracy >= 75
            ? "整体表现稳定，准确率良好。"
            : avgAccuracy >= 60
              ? "进步不错，继续保持。"
              : "坚持是最重要的，加油！"
        }建议下周每天保证 15 分钟对话练习，重点复习${
          errorTypes[0]?.type || "语法"
        }薄弱项，配合单词本复习本周新增的 ${newVocab} 个词汇，会进步更快！`
      : "本周还没有学习记录，建议从每日挑战或简单场景开始，完成 3 轮对话打下本周学习的基础。坚持每天练一点，长期进步看得见！"

    return NextResponse.json({
      advice: fallbackAdvice,
      source: "fallback",
    })
  }
}
