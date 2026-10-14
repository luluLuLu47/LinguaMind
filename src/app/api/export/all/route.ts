/**
 * GET /api/export/all?format=json|csv&lang=en|ko
 *
 * 一键导出用户所有学习数据（完整备份 / 统计）
 * - format=json: 返回所有 6 张表的完整结构化备份（可用于迁移/导入）
 * - format=csv:  返回 learning_stats 每日学习统计（可 Excel 打开分析）
 */

import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { getUserIdFromRequest } from "@/lib/auth"

type Format = "json" | "csv"

function dateStamp() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}${m}${day}`
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return ""
  const s = String(value)
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const format = (searchParams.get("format") || "json") as Format
  const langParam = searchParams.get("lang") as "en" | "ko" | null
  const userId = getUserIdFromRequest(request)

  try {
    const db = getDb()

    if (format === "csv") {
      // 导出每日学习统计（可选按语言过滤），按用户隔离
      const rows = langParam
        ? db
            .prepare(
              `SELECT date, language, dialogue_count, total_rounds, duration_minutes,
                      new_vocab_count, avg_accuracy, scene_distribution, error_types
               FROM learning_stats
               WHERE user_id = ? AND language = ?
               ORDER BY date ASC`
            )
            .all(userId, langParam) as Array<Record<string, unknown>>
        : db
            .prepare(
              `SELECT date, language, dialogue_count, total_rounds, duration_minutes,
                      new_vocab_count, avg_accuracy, scene_distribution, error_types
               FROM learning_stats
               WHERE user_id = ?
               ORDER BY date ASC`
            )
            .all(userId) as Array<Record<string, unknown>>

      const header = [
        "date", "language", "dialogue_count", "total_rounds",
        "duration_minutes", "new_vocab_count", "avg_accuracy",
        "scene_distribution", "error_types",
      ]
      const lines: string[] = [header.join(",")]
      for (const row of rows) {
        lines.push(header.map(h => csvEscape(row[h])).join(","))
      }
      const csv = lines.join("\n")
      const filename = `linguamind_stats_${dateStamp()}.csv`

      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
          // 加 BOM 让 Excel 正确识别 UTF-8
        },
      })
    }

    // JSON：完整数据备份（6 张表），按用户隔离，可按语言过滤
    const filterLang = (table: string) =>
      langParam
        ? db.prepare(`SELECT * FROM ${table} WHERE user_id = ? AND language = ?`).all(userId, langParam)
        : db.prepare(`SELECT * FROM ${table} WHERE user_id = ?`).all(userId)

    const payload = {
      meta: {
        app: "LinguaMind",
        exportedAt: new Date().toISOString(),
        schema: 1,
        filteredByLanguage: langParam || null,
      },
      dialogue_sessions: filterLang("dialogue_sessions"),
      dialogue_messages: (() => {
        if (!langParam) {
          return db
            .prepare(`SELECT dm.* FROM dialogue_messages dm
                      JOIN dialogue_sessions ds ON dm.session_id = ds.id
                      WHERE ds.user_id = ?
                      ORDER BY dm.session_id, dm.id`)
            .all(userId)
        }
        return db
          .prepare(
            `SELECT dm.* FROM dialogue_messages dm
             JOIN dialogue_sessions ds ON dm.session_id = ds.id
             WHERE ds.user_id = ? AND ds.language = ?
             ORDER BY dm.session_id, dm.id`
          )
          .all(userId, langParam)
      })(),
      daily_checkins: filterLang("daily_checkins"),
      learning_stats: filterLang("learning_stats"),
      vocabulary: filterLang("vocabulary"),
      game_history: filterLang("game_history"),
    }

    const filename = `linguamind_backup_${dateStamp()}.json`
    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.error("[export/all] failed:", err)
    return NextResponse.json(
      { error: "Export failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
