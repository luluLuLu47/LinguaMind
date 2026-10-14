import { NextRequest, NextResponse } from "next/server"
import { getVocabularyList } from "@/lib/repository"
import { getUserIdFromRequest } from "@/lib/auth"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const lang = (searchParams.get("lang") || "en") as "en" | "ko"
  const userId = getUserIdFromRequest(request)

  try {
    const words = getVocabularyList(userId, lang)
    return NextResponse.json({ words, total: words.length })
  } catch (err) {
    console.error("[vocabulary/list] Error:", err)
    return NextResponse.json({ words: [], total: 0 })
  }
}
