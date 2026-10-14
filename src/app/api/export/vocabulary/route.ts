/**
 * GET /api/export/vocabulary?lang=en|ko&format=csv|json
 *
 * 单词本导出
 * - CSV：适合直接导入 Anki 等间隔重复软件
 *   表头（英）: word, meaning, phonetic, scene_id, saved_at, review_count, last_reviewed
 * - JSON：完整单词表，方便备份
 */

import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { getUserIdFromRequest } from "@/lib/auth"

type Format = "json" | "csv"

function dateStamp() {
  const d = new Date()
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`
}

function csvEscape(v: unknown) {
  if (v === null || v === undefined) return ""
  const s = String(v)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const lang = (searchParams.get("lang") || "en") as "en" | "ko"
  const format = (searchParams.get("format") || "csv") as Format
  const userId = getUserIdFromRequest(request)

  try {
    const db = getDb()
    const rows = db
      .prepare(
        `SELECT word, language, meaning, phonetic, scene_id,
                saved_at, review_count, last_reviewed
         FROM vocabulary
         WHERE user_id = ? AND language = ?
         ORDER BY saved_at DESC`
      )
      .all(userId, lang) as Array<Record<string, unknown>>

    if (format === "csv") {
      const header = ["word", "language", "meaning", "phonetic", "scene_id", "saved_at", "review_count", "last_reviewed"]
      const lines = [header.join(",")]
      for (const r of rows) lines.push(header.map(h => csvEscape(r[h])).join(","))

      // 加 UTF-8 BOM，让 Excel 正确显示中文/韩文
      const csv = "\uFEFF" + lines.join("\n")
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="linguamind_vocab_${lang}_${dateStamp()}.csv"`,
        },
      })
    }

    return new NextResponse(
      JSON.stringify(
        {
          meta: { app: "LinguaMind", exportedAt: new Date().toISOString(), type: "vocabulary", language: lang },
          data: rows,
        },
        null,
        2
      ),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="linguamind_vocab_${lang}_${dateStamp()}.json"`,
        },
      }
    )
  } catch (err) {
    console.error("[export/vocabulary] failed:", err)
    return NextResponse.json(
      { error: "Vocabulary export failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
