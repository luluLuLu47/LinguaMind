/**
 * GET /api/history/session?id=xxx
 *
 * 获取某个会话的完整消息记录
 */

import { NextRequest, NextResponse } from "next/server"
import { getSessionMessages } from "@/lib/repository"
import { getUserIdFromRequest } from "@/lib/auth"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")
  const userId = getUserIdFromRequest(request)

  if (!id) {
    return NextResponse.json({ error: "Missing session id" }, { status: 400 })
  }

  try {
    const messages = getSessionMessages(userId, id)
    return NextResponse.json({ messages })
  } catch (err) {
    console.error("[history/session] Error:", err)
    return NextResponse.json({ messages: [] })
  }
}
