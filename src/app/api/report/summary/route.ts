/**
 * GET /api/report/summary?lang=en|ko
 *
 * 学习报告数据聚合 API — 从 SQLite 数据库读取真实数据
 */

import { NextRequest, NextResponse } from "next/server"
import {
  getSessionCountInRange,
  getTotalRoundsInRange,
  getAvgAccuracyInRange,
  getSceneDistribution,
  getDailyAccuracy,
  getVocabCountInRange,
  getDailyVocabCounts,
  aggregateStats,
} from "@/lib/repository"
import { getUserIdFromRequest } from "@/lib/auth"

interface ReportSummary {
  weeklyStats: {
    totalConversations: number
    totalStudyMinutes: number
    newVocabulary: number
    averageAccuracy: number
  }
  accuracyTrend: Array<{ date: string; accuracy: number }>
  vocabularyGrowth: Array<{ date: string; count: number }>
  sceneDistribution: Array<{ scene: string; count: number }>
  errorTypes: Array<{ type: string; count: number }>
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const lang = (searchParams.get("lang") || "en") as "en" | "ko"
  const userId = getUserIdFromRequest(request)

  // ── 日期范围：本周（周一～周日） ──
  const today = new Date()
  const dayOfWeek = today.getDay()
  const monday = new Date(today)
  monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
  const from = monday.toISOString().slice(0, 10)
  const to = today.toISOString().slice(0, 10)

  // 生成7天日期数组
  const days: string[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    days.push(d.toISOString().split("T")[0])
  }

  try {
    // ── 从 SQLite 读取真实数据 ──
    const totalConversations = getSessionCountInRange(userId, from, to, lang)
    const totalRounds = getTotalRoundsInRange(userId, from, to, lang)
    const avgAccuracy = getAvgAccuracyInRange(userId, from, to, lang)
    const newVocab = getVocabCountInRange(userId, from, to, lang)

    // 学习时长估算：每轮对话约2分钟
    const estimatedMinutes = Math.round(totalRounds * 2)

    // 准确率趋势（每日）
    const accuracyTrendRaw = getDailyAccuracy(userId, from, to, lang)
    const accuracyMap = new Map(accuracyTrendRaw.map(r => [r.date, r.accuracy]))
    const accuracyTrend = days.map(date => ({
      date,
      accuracy: accuracyMap.get(date) ?? 0,
    }))

    // 词汇增长（累计）
    const vocabDailyRaw = getDailyVocabCounts(userId, from, to, lang)
    const vocabMap = new Map(vocabDailyRaw.map(r => [r.date, r.count]))
    let cumulative = 0
    const vocabularyGrowth = days.map(date => {
      cumulative += vocabMap.get(date) ?? 0
      return { date, count: cumulative }
    })

    // 场景分布
    const sceneDist = getSceneDistribution(userId, from, to, lang)
    const sceneDistribution = Object.entries(sceneDist)
      .map(([scene, count]) => ({ scene, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)

    // 错误类型（目前从对话消息中统计 coach 的 feedback）
    const errorTypes = getErrorTypeStats(userId, from, to, lang)

    // ── 如果数据太少，补充合理默认值 ──
    const hasData = totalConversations > 0

    const summary: ReportSummary = {
      weeklyStats: {
        totalConversations,
        totalStudyMinutes: hasData ? estimatedMinutes : 0,
        newVocabulary: newVocab,
        averageAccuracy: hasData ? avgAccuracy : 0,
      },
      accuracyTrend,
      vocabularyGrowth,
      sceneDistribution: sceneDistribution.length > 0
        ? sceneDistribution
        : getDefaultSceneDistribution(lang),
      errorTypes: errorTypes.length > 0
        ? errorTypes
        : getDefaultErrorTypes(lang),
    }

    return NextResponse.json(summary)
  } catch (err) {
    console.error("[report/summary] DB error:", err)
    // 降级：返回空数据结构
    const summary: ReportSummary = {
      weeklyStats: { totalConversations: 0, totalStudyMinutes: 0, newVocabulary: 0, averageAccuracy: 0 },
      accuracyTrend: days.map(date => ({ date, accuracy: 0 })),
      vocabularyGrowth: days.map(date => ({ date, count: 0 })),
      sceneDistribution: getDefaultSceneDistribution(lang),
      errorTypes: getDefaultErrorTypes(lang),
    }
    return NextResponse.json(summary)
  }
}

// ── Helpers ────────────────────────────────────────────────────

function getErrorTypeStats(userId: string, from: string, to: string, lang: "en" | "ko"): Array<{ type: string; count: number }> {
  // 从 dialogue_messages 中统计 coach 角色包含的错误类型
  try {
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

    // 简单关键词统计
    const errorCounts: Record<string, number> = {
      [lang === "en" ? "Grammar" : "문법"]: 0,
      [lang === "en" ? "Vocabulary" : "어휘"]: 0,
      [lang === "en" ? "Pronunciation" : "발음"]: 0,
      [lang === "en" ? "Word Order" : "어순"]: 0,
      [lang === "en" ? "Tense" : "시제"]: 0,
    }

    const grammarKw = lang === "en" ? ["grammar", "tense", "article", "preposition"] : ["문법", "조사", "어미"]
    const vocabKw = lang === "en" ? ["vocabulary", "word", "phrase", "expression"] : ["어휘", "단어", "표현"]
    const pronKw = lang === "en" ? ["pronunciation", "accent", "intonation"] : ["발음", "억양"]
    const orderKw = lang === "en" ? ["word order", "structure", "syntax"] : ["어순", "구조"]
    const tenseKw = lang === "en" ? ["tense", "past", "future", "present"] : ["시제", "과거", "미래"]

    for (const row of rows) {
      const fb = (row.feedback || "").toLowerCase()
      if (grammarKw.some(kw => fb.includes(kw))) errorCounts[lang === "en" ? "Grammar" : "문법"]++
      if (vocabKw.some(kw => fb.includes(kw))) errorCounts[lang === "en" ? "Vocabulary" : "어휘"]++
      if (pronKw.some(kw => fb.includes(kw))) errorCounts[lang === "en" ? "Pronunciation" : "발음"]++
      if (orderKw.some(kw => fb.includes(kw))) errorCounts[lang === "en" ? "Word Order" : "어순"]++
      if (tenseKw.some(kw => fb.includes(kw))) errorCounts[lang === "en" ? "Tense" : "시제"]++
    }

    return Object.entries(errorCounts)
      .filter(([, count]) => count > 0)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
  } catch {
    return []
  }
}

function getDefaultSceneDistribution(lang: "en" | "ko"): Array<{ scene: string; count: number }> {
  if (lang === "en") {
    return [
      { scene: "Daily Life", count: 0 },
      { scene: "Travel", count: 0 },
      { scene: "Food & Dining", count: 0 },
      { scene: "Work & Study", count: 0 },
      { scene: "Social", count: 0 },
    ]
  }
  return [
    { scene: "일상 생활", count: 0 },
    { scene: "여행", count: 0 },
    { scene: "음식", count: 0 },
    { scene: "직장/학교", count: 0 },
    { scene: "사교", count: 0 },
  ]
}

function getDefaultErrorTypes(lang: "en" | "ko"): Array<{ type: string; count: number }> {
  if (lang === "en") {
    return [
      { type: "Grammar", count: 0 },
      { type: "Vocabulary", count: 0 },
      { type: "Pronunciation", count: 0 },
      { type: "Word Order", count: 0 },
    ]
  }
  return [
    { type: "문법", count: 0 },
    { type: "어휘", count: 0 },
    { type: "발음", count: 0 },
    { type: "어순", count: 0 },
  ]
}
