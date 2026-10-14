import { NextRequest, NextResponse } from "next/server";
import { requireAdminFromRequest } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    // 验证管理员权限
    requireAdminFromRequest(req);

    const db = getDb();

    // 1) 用户总数（排除匿名）
    const totalUsers = (
      db.prepare(`SELECT COUNT(*) as cnt FROM users WHERE username != 'admin'`).get() as { cnt: number }
    ).cnt;

    // 2) 今日活跃用户（今天有登录或对话的）
    const todayStr = new Date().toISOString().slice(0, 10);
    const activeToday = (
      db
        .prepare(
          `SELECT COUNT(DISTINCT user_id) as cnt FROM dialogue_sessions
           WHERE user_id NOT IN ('anonymous') AND date(started_at) = ?`
        )
        .get(todayStr) as { cnt: number }
    ).cnt;

    // 3) 最近 7 天每日活跃用户
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    const sinceStr = sevenDaysAgo.toISOString().slice(0, 10);
    const dailyActive = db
      .prepare(
        `SELECT date(started_at) as d, COUNT(DISTINCT user_id) as cnt
         FROM dialogue_sessions
         WHERE user_id NOT IN ('anonymous') AND date(started_at) >= ?
         GROUP BY d ORDER BY d ASC`
      )
      .all(sinceStr) as { d: string; cnt: number }[];

    // 4) 目标语言偏好
    const languagePreference = db
      .prepare(
        `SELECT language, COUNT(*) as cnt FROM (
           SELECT user_id, language FROM dialogue_sessions
           WHERE user_id NOT IN ('anonymous')
           GROUP BY user_id, language
         ) GROUP BY language ORDER BY cnt DESC`
      )
      .all() as { language: string; cnt: number }[];

    // 5) 目标等级偏好（来自 users 表）
    const targetLevelPreference = db
      .prepare(
        `SELECT target_level, COUNT(*) as cnt FROM users WHERE username != 'admin' GROUP BY target_level ORDER BY cnt DESC`
      )
      .all() as { target_level: string; cnt: number }[];

    // 6) 累计对话次数
    const totalSessions = (
      db
        .prepare(
          `SELECT COUNT(*) as cnt FROM dialogue_sessions WHERE user_id NOT IN ('anonymous')`
        )
        .get() as { cnt: number }
    ).cnt;

    // 7) 累计打卡次数
    const totalCheckins = (
      db
        .prepare(
          `SELECT COUNT(*) as cnt FROM daily_checkins WHERE user_id NOT IN ('anonymous')`
        )
        .get() as { cnt: number }
    ).cnt;

    // 8) 累计保存单词数
    const totalVocab = (
      db
        .prepare(
          `SELECT COUNT(*) as cnt FROM vocabulary WHERE user_id NOT IN ('anonymous')`
        )
        .get() as { cnt: number }
    ).cnt;

    // 9) 最近注册的 10 个用户
    const recentUsers = db
      .prepare(
        `SELECT username, email, display_name, avatar_emoji, target_level, created_at, last_login
         FROM users WHERE username != 'admin'
         ORDER BY created_at DESC LIMIT 10`
      )
      .all() as Array<{
        username: string;
        email: string | null;
        display_name: string | null;
        avatar_emoji: string;
        target_level: string;
        created_at: string;
        last_login: string | null;
      }>;

    // 10) 每个用户的学习量（最近 30 天）
    const userActivity = db
      .prepare(
        `SELECT
           u.username,
           u.display_name,
           u.avatar_emoji,
           u.target_level,
           u.created_at,
           u.last_login,
           COUNT(DISTINCT ds.id) as sessions,
           COUNT(DISTINCT dc.id) as checkins,
           COUNT(DISTINCT v.id) as vocab
         FROM users u
         LEFT JOIN dialogue_sessions ds ON ds.user_id = u.id AND ds.started_at >= ?
         LEFT JOIN daily_checkins dc ON dc.user_id = u.id AND dc.date >= ?
         LEFT JOIN vocabulary v ON v.user_id = u.id AND v.saved_at >= ?
         WHERE u.username != 'admin'
         GROUP BY u.id
         ORDER BY sessions DESC, checkins DESC
         LIMIT 20`
      )
      .all(sinceStr, sinceStr, sinceStr) as Array<{
        username: string;
        display_name: string | null;
        avatar_emoji: string;
        target_level: string;
        created_at: string;
        last_login: string | null;
        sessions: number;
        checkins: number;
        vocab: number;
      }>;

    // 11) 场景偏好（最受欢迎的对话场景）
    const scenePreference = db
      .prepare(
        `SELECT scene_id, COUNT(*) as cnt FROM dialogue_sessions
         WHERE user_id NOT IN ('anonymous')
         GROUP BY scene_id ORDER BY cnt DESC LIMIT 10`
      )
      .all() as { scene_id: string; cnt: number }[];

    return NextResponse.json({
      overview: {
        totalUsers,
        activeToday,
        totalSessions,
        totalCheckins,
        totalVocab,
      },
      charts: {
        dailyActive,
        languagePreference,
        targetLevelPreference,
        scenePreference,
      },
      tables: {
        recentUsers,
        userActivity,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load admin stats";
    const status =
      message.includes("Authentication required") || message.includes("Admin permission")
        ? 403
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
