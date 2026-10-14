/**
 * GET /api/daily/sentence?lang=en|ko
 *
 * 获取今日句子。优先使用 Qwen 生成，失败时从预设数据中随机选取。
 * 同一用户同一天返回相同句子（基于日期 + 语言计算种子）。
 */

import { NextRequest, NextResponse } from "next/server"
import { qwenChat } from "@/lib/dashscope"
import { englishSentences, koreanSentences, DailySentence } from "@/data/daily-sentences"
import { getTodayCheckin } from "@/lib/repository"
import { getUserIdFromRequest } from "@/lib/auth"

// 简单的日期种子哈希
function hashCode(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash |= 0
  }
  return Math.abs(hash)
}

function getTodaySeed(lang: string): number {
  const today = new Date()
  const dateStr = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}-${lang}`
  return hashCode(dateStr)
}

function getPresetSentence(lang: string, seed: number): DailySentence {
  const pool = lang === "en" ? englishSentences : koreanSentences
  const index = seed % pool.length
  return pool[index]
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const lang = (searchParams.get("lang") || "en") as "en" | "ko"
  const userId = getUserIdFromRequest(request)

  if (lang !== "en" && lang !== "ko") {
    return NextResponse.json({ error: "Invalid language. Use 'en' or 'ko'." }, { status: 400 })
  }

  // 检查今天是否已有打卡记录（从 SQLite）
  const todayStr = new Date().toISOString().slice(0, 10)
  const existing = getTodayCheckin(userId, lang, todayStr)
  if (existing) {
    return NextResponse.json({
      sentence: {
        id: existing.sentence_id,
        text: existing.sentence_text,
        phonetic: "",
        translation: "",
        example: "",
        exampleTranslation: "",
        tags: [],
        difficulty: 2,
        tip: "",
      },
      source: "cached",
      checkin: {
        pronounceScore: existing.pronounce_score,
        sentenceScore: existing.sentence_score,
        completed: existing.completed === 1,
      },
    })
  }

  const seed = getTodaySeed(lang)

  // 尝试用 Qwen 生成今日句子
  try {
    const langName = lang === "en" ? "English" : "Korean"
    const result = await qwenChat(
      [
        {
          role: "system",
          content: `You are a ${langName} teacher. Generate ONE useful, natural daily expression that a learner should practice today. Respond with JSON only.`,
        },
        {
          role: "user",
          content: `Generate a ${langName} daily sentence for language learners.

Return JSON:
{
  "text": "the sentence in ${langName}",
  "phonetic": "${lang === "en" ? "IPA pronunciation" : "Romanization"}",
  "translation": "Chinese translation",
  "example": "a natural example sentence using this expression",
  "exampleTranslation": "Chinese translation of the example",
  "tags": ["tag1", "tag2"],
  "difficulty": 1 or 2 or 3,
  "tip": "a brief usage tip in Chinese"
}

Requirements:
- The sentence should be a REAL, commonly used expression (not textbook English/Korean)
- For English: prefer idioms, phrasal verbs, or colloquial expressions
- For Korean: prefer 속담(proverbs), 관용구(idioms), or natural daily expressions
- Difficulty 1 = beginner, 2 = intermediate, 3 = advanced
- Today's date is ${new Date().toISOString().split("T")[0]}`,
        },
      ],
      { temperature: 0.8, maxTokens: 800 }
    )

    const parsed = JSON.parse(result.content)
    const sentence: DailySentence = {
      id: `qwen-${lang}-${seed}`,
      text: parsed.text,
      phonetic: parsed.phonetic,
      translation: parsed.translation,
      example: parsed.example,
      exampleTranslation: parsed.exampleTranslation,
      tags: parsed.tags || [],
      difficulty: parsed.difficulty || 2,
      tip: parsed.tip || "今天也要加油练习哦！",
    }

    return NextResponse.json({ sentence, source: "ai" })
  } catch (error) {
    // Qwen 不可用时使用预设数据
    console.warn("Qwen daily sentence generation failed, using preset:", error)
    const sentence = getPresetSentence(lang, seed)
    return NextResponse.json({ sentence, source: "preset" })
  }
}
