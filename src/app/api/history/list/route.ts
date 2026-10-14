/**
 * GET /api/history/list?lang=en|ko&limit=20
 *
 * 获取最近的对话会话列表
 * - lang: 可选，按语言过滤（en/ko），不传则返回全部
 * - limit: 默认 20
 */

import { NextRequest, NextResponse } from "next/server"
import { getRecentSessions } from "@/lib/repository"
import { getUserIdFromRequest } from "@/lib/auth"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const limit = parseInt(searchParams.get("limit") || "20")
  const langParam = searchParams.get("lang") as "en" | "ko" | null
  const lang = langParam === "en" || langParam === "ko" ? langParam : undefined
  const userId = getUserIdFromRequest(request)

  try {
    const sessions = getRecentSessions(userId, limit, lang)
    return NextResponse.json({ sessions })
  } catch (err) {
    console.error("[history/list] Error:", err)
    return NextResponse.json({ sessions: [] })
  }
}
