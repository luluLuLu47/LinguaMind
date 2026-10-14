/**
 * GET /api/export/sessions?lang=en|ko&format=json|txt
 *
 * 对话历史批量导出
 * - format=json: 结构化（session 嵌套 messages），可备份/迁移
 * - format=txt:  纯文本对话剧本，方便用户离线复习
 *
 * 可选 ?id=xxx 只导出单个会话（与 history/session 保持一致的参数）
 */

import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { getUserIdFromRequest } from "@/lib/auth"

type Format = "json" | "txt"

function dateStamp() {
  const d = new Date()
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`
}

function formatRoleTxt(role: string, content: string, score?: number | null, feedback?: string | null) {
  const prefix =
    role === "user" ? "[用户]" :
    role === "assistant" ? "[AI 外教]" :
    role === "coach" ? "[教练点评]" : `[${role}]`
  const scorePart = score != null ? `  （得分：${score}）` : ""
  const fbPart = feedback ? `\n       点评：${feedback.replace(/\n/g, "\n             ")}` : ""
  return `${prefix}${scorePart}\n${content}${fbPart}\n`
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const lang = searchParams.get("lang") as "en" | "ko" | null
  const format = (searchParams.get("format") || "json") as Format
  const sessionId = searchParams.get("id")
  const userId = getUserIdFromRequest(request)

  try {
    const db = getDb()

    // 1) 取会话列表（按用户隔离）
    let sessions: Array<{ id: string; scene_id: string; scene_title: string; language: string; started_at: string | null; ended_at: string | null; total_rounds: number | null; avg_score: number | null }>
    if (sessionId) {
      sessions = db
        .prepare("SELECT * FROM dialogue_sessions WHERE id = ? AND user_id = ?")
        .all(sessionId, userId) as typeof sessions
    } else if (lang) {
      sessions = db
        .prepare("SELECT * FROM dialogue_sessions WHERE user_id = ? AND language = ? ORDER BY started_at DESC")
        .all(userId, lang) as typeof sessions
    } else {
      sessions = db
        .prepare("SELECT * FROM dialogue_sessions WHERE user_id = ? ORDER BY started_at DESC")
        .all(userId) as typeof sessions
    }

    if (sessions.length === 0) {
      return NextResponse.json(
        { error: "No sessions found", count: 0 },
        { status: 404 }
      )
    }

    // 2) 取每个会话的 messages
    const sessionIds = sessions.map(s => s.id)
    const placeholders = sessionIds.map(() => "?").join(",")
    const allMessages = db
      .prepare(
        `SELECT session_id, role, content, score, feedback, created_at
         FROM dialogue_messages
         WHERE session_id IN (${placeholders})
         ORDER BY session_id, id ASC`
      )
      .all(...sessionIds) as Array<{
        session_id: string; role: string; content: string; score: number | null;
        feedback: string | null; created_at: string
      }>

    const msgBySession = new Map<string, typeof allMessages>()
    for (const m of allMessages) {
      if (!msgBySession.has(m.session_id)) msgBySession.set(m.session_id, [])
      msgBySession.get(m.session_id)!.push(m)
    }

    if (format === "txt") {
      const chunks: string[] = [`LinguaMind 对话历史导出\n导出时间：${new Date().toLocaleString()}\n共 ${sessions.length} 个会话\n${"=".repeat(56)}\n`]
      for (const s of sessions) {
        chunks.push(
          `\n【会话 ${s.id}】\n` +
          `场景：${s.scene_title} (${s.scene_id})  语言：${s.language.toUpperCase()}\n` +
          `开始：${s.started_at ?? "-"}  结束：${s.ended_at ?? "-"}\n` +
          `轮次：${s.total_rounds ?? 0}  平均得分：${s.avg_score ?? "-"}\n` +
          `${"-".repeat(56)}\n`
        )
        const msgs = msgBySession.get(s.id) || []
        for (const m of msgs) chunks.push(formatRoleTxt(m.role, m.content, m.score, m.feedback) + "\n")
        chunks.push("=".repeat(56) + "\n")
      }
      const txt = "\uFEFF" + chunks.join("")
      const filename = sessionId
        ? `linguamind_session_${sessionId.slice(0, 8)}_${dateStamp()}.txt`
        : `linguamind_sessions_${lang ?? "all"}_${dateStamp()}.txt`
      return new NextResponse(txt, {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      })
    }

    // JSON：结构化嵌套
    const data = sessions.map(s => ({
      id: s.id,
      scene_id: s.scene_id,
      scene_title: s.scene_title,
      language: s.language,
      started_at: s.started_at,
      ended_at: s.ended_at,
      total_rounds: s.total_rounds,
      avg_score: s.avg_score,
      messages: (msgBySession.get(s.id) || []).map(m => ({
        role: m.role,
        content: m.content,
        score: m.score,
        feedback: m.feedback,
        created_at: m.created_at,
      })),
    }))

    const payload = {
      meta: {
        app: "LinguaMind",
        exportedAt: new Date().toISOString(),
        type: "sessions",
        filteredByLanguage: lang || null,
        filteredById: sessionId || null,
        count: data.length,
      },
      data,
    }

    const filename = sessionId
      ? `linguamind_session_${sessionId.slice(0, 8)}_${dateStamp()}.json`
      : `linguamind_sessions_${lang ?? "all"}_${dateStamp()}.json`

    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.error("[export/sessions] failed:", err)
    return NextResponse.json(
      { error: "Sessions export failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
