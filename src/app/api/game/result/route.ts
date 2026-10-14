import { NextRequest, NextResponse } from "next/server"
import { saveGameResult, markVocabReviewed } from "@/lib/repository"
import { getUserIdFromRequest } from "@/lib/auth"

export async function POST(request: NextRequest) {
  try {
    const userId = getUserIdFromRequest(request)
    const body = await request.json()
    const { language, pairs, attempts, accuracy, wordsMatched, wordsFailed } = body

    if (!language || pairs === undefined || attempts === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Save game result
    saveGameResult(userId, {
      language: language as "en" | "ko",
      pairs,
      attempts,
      accuracy,
      words_matched: JSON.stringify(wordsMatched || []),
      words_failed: JSON.stringify(wordsFailed || []),
    })

    // Mark matched words as reviewed in vocabulary table
    for (const word of (wordsMatched || [])) {
      markVocabReviewed(userId, word, language as "en" | "ko")
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[game/result] Error:", err)
    return NextResponse.json({ error: "Failed to save game result" }, { status: 500 })
  }
}
