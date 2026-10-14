import { NextRequest, NextResponse } from "next/server"
import { saveVocabulary } from "@/lib/repository"
import { getUserIdFromRequest } from "@/lib/auth"

export async function POST(request: NextRequest) {
  try {
    const userId = getUserIdFromRequest(request)
    const body = await request.json()
    const { word, language, meaning, phonetic, sceneId } = body

    if (!word || !language) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    saveVocabulary(userId, {
      word,
      language,
      meaning: meaning || "",
      phonetic: phonetic || null,
      scene_id: sceneId || null,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[vocabulary/save] Error:", err)
    return NextResponse.json({ error: "Failed to save word" }, { status: 500 })
  }
}
