/**
 * Data repository helpers — LinguaMind
 *
 * All queries are scoped by userId for data isolation.
 * Anonymous (not-logged-in) users share the 'anonymous' user id.
 */

import { getDb } from "./db";

// ── Dialogue Sessions ─────────────────────────────────────────

export interface DialogueSession {
  id: string;
  user_id: string | null;
  scene_id: string;
  scene_title: string;
  language: "en" | "ko";
  started_at: string;
  ended_at: string | null;
  total_rounds: number;
  avg_score: number | null;
}

export interface DialogueMessage {
  id: number;
  session_id: string;
  user_id: string | null;
  role: "user" | "assistant" | "coach";
  content: string;
  score: number | null;
  feedback: string | null;
  created_at: string;
}

/** Start a new dialogue session */
export function createSession(
  userId: string,
  session: Omit<DialogueSession, "ended_at" | "total_rounds" | "avg_score" | "user_id">
) {
  const db = getDb();
  db.prepare(
    `INSERT INTO dialogue_sessions (id, user_id, scene_id, scene_title, language, started_at)
     VALUES (@id, @userId, @scene_id, @scene_title, @language, @started_at)`
  ).run({ ...session, userId });
}

/** End a session with final stats */
export function endSession(userId: string, id: string, totalRounds: number, avgScore: number) {
  const db = getDb();
  db.prepare(
    `UPDATE dialogue_sessions
     SET ended_at = datetime('now'), total_rounds = @rounds, avg_score = @score
     WHERE id = @id AND user_id = @userId`
  ).run({ id, userId, rounds: totalRounds, score: avgScore });
}

/** Insert a dialogue message */
export function insertMessage(
  userId: string,
  msg: Omit<DialogueMessage, "id" | "created_at" | "user_id">
) {
  const db = getDb();
  return db.prepare(
    `INSERT INTO dialogue_messages (session_id, user_id, role, content, score, feedback)
     VALUES (@session_id, @userId, @role, @content, @score, @feedback)`
  ).run({ ...msg, userId });
}

/** Get messages for a session (scoped to user) */
export function getSessionMessages(userId: string, sessionId: string): DialogueMessage[] {
  const db = getDb();
  return db.prepare(
    `SELECT dm.* FROM dialogue_messages dm
     JOIN dialogue_sessions ds ON dm.session_id = ds.id
     WHERE dm.session_id = ? AND ds.user_id = ?
     ORDER BY dm.id ASC`
  ).all(sessionId, userId) as DialogueMessage[];
}

/** Verify a session belongs to the user */
export function sessionBelongsToUser(userId: string, sessionId: string): boolean {
  const db = getDb();
  const row = db.prepare(
    `SELECT 1 FROM dialogue_sessions WHERE id = ? AND user_id = ?`
  ).get(sessionId, userId);
  return !!row;
}

/** Get recent sessions */
export function getRecentSessions(userId: string, limit = 20, language?: "en" | "ko"): DialogueSession[] {
  const db = getDb();
  if (language) {
    return db.prepare(
      `SELECT * FROM dialogue_sessions WHERE user_id = ? AND language = ? ORDER BY started_at DESC LIMIT ?`
    ).all(userId, language, limit) as DialogueSession[];
  }
  return db.prepare(
    `SELECT * FROM dialogue_sessions WHERE user_id = ? ORDER BY started_at DESC LIMIT ?`
  ).all(userId, limit) as DialogueSession[];
}

/** Get session count for a date range */
export function getSessionCountInRange(userId: string, from: string, to: string, language?: "en" | "ko"): number {
  const db = getDb();
  const row = language
    ? db.prepare(`SELECT COUNT(*) as cnt FROM dialogue_sessions WHERE user_id = ? AND started_at >= ? AND started_at <= ? AND language = ?`).get(userId, from, to, language) as { cnt: number }
    : db.prepare(`SELECT COUNT(*) as cnt FROM dialogue_sessions WHERE user_id = ? AND started_at >= ? AND started_at <= ?`).get(userId, from, to) as { cnt: number };
  return row.cnt;
}

/** Get total rounds for a date range */
export function getTotalRoundsInRange(userId: string, from: string, to: string, language?: "en" | "ko"): number {
  const db = getDb();
  const row = language
    ? db.prepare(`SELECT COALESCE(SUM(total_rounds), 0) as cnt FROM dialogue_sessions WHERE user_id = ? AND started_at >= ? AND started_at <= ? AND language = ?`).get(userId, from, to, language) as { cnt: number }
    : db.prepare(`SELECT COALESCE(SUM(total_rounds), 0) as cnt FROM dialogue_sessions WHERE user_id = ? AND started_at >= ? AND started_at <= ?`).get(userId, from, to) as { cnt: number };
  return row.cnt;
}

/** Get average accuracy for a date range */
export function getAvgAccuracyInRange(userId: string, from: string, to: string, language?: "en" | "ko"): number {
  const db = getDb();
  const row = language
    ? db.prepare(`SELECT COALESCE(AVG(avg_score), 0) as avg FROM dialogue_sessions WHERE user_id = ? AND started_at >= ? AND started_at <= ? AND avg_score IS NOT NULL AND language = ?`).get(userId, from, to, language) as { avg: number }
    : db.prepare(`SELECT COALESCE(AVG(avg_score), 0) as avg FROM dialogue_sessions WHERE user_id = ? AND started_at >= ? AND started_at <= ? AND avg_score IS NOT NULL`).get(userId, from, to) as { avg: number };
  return Math.round(row.avg * 10) / 10;
}

/** Get scene distribution for a date range */
export function getSceneDistribution(userId: string, from: string, to: string, language?: "en" | "ko"): Record<string, number> {
  const db = getDb();
  const rows = language
    ? db.prepare(`SELECT scene_id, COUNT(*) as cnt FROM dialogue_sessions WHERE user_id = ? AND started_at >= ? AND started_at <= ? AND language = ? GROUP BY scene_id ORDER BY cnt DESC`).all(userId, from, to, language) as { scene_id: string; cnt: number }[]
    : db.prepare(`SELECT scene_id, COUNT(*) as cnt FROM dialogue_sessions WHERE user_id = ? AND started_at >= ? AND started_at <= ? GROUP BY scene_id ORDER BY cnt DESC`).all(userId, from, to) as { scene_id: string; cnt: number }[];

  const dist: Record<string, number> = {};
  for (const r of rows) dist[r.scene_id] = r.cnt;
  return dist;
}

/** Get daily accuracy for a date range (for trend chart) */
export function getDailyAccuracy(userId: string, from: string, to: string, language?: "en" | "ko"): { date: string; accuracy: number }[] {
  const db = getDb();
  const rows = language
    ? db.prepare(`SELECT date(started_at) as d, COALESCE(AVG(avg_score), 0) as acc FROM dialogue_sessions WHERE user_id = ? AND started_at >= ? AND started_at <= ? AND avg_score IS NOT NULL AND language = ? GROUP BY d ORDER BY d ASC`).all(userId, from, to, language) as { d: string; acc: number }[]
    : db.prepare(`SELECT date(started_at) as d, COALESCE(AVG(avg_score), 0) as acc FROM dialogue_sessions WHERE user_id = ? AND started_at >= ? AND started_at <= ? AND avg_score IS NOT NULL GROUP BY d ORDER BY d ASC`).all(userId, from, to) as { d: string; acc: number }[];

  return rows.map(r => ({ date: r.d, accuracy: Math.round(r.acc * 10) / 10 }));
}

// ── Daily Checkins ────────────────────────────────────────────

export interface DailyCheckin {
  id: number;
  user_id: string | null;
  date: string;
  language: "en" | "ko";
  sentence_id: string;
  sentence_text: string;
  pronounce_score: number | null;
  sentence_score: number | null;
  completed: number;
  created_at: string;
}

/** Upsert a daily checkin (scoped to user) */
export function upsertCheckin(userId: string, checkin: Omit<DailyCheckin, "id" | "created_at" | "user_id">) {
  const db = getDb();
  db.prepare(
    `INSERT INTO daily_checkins (user_id, date, language, sentence_id, sentence_text, pronounce_score, sentence_score, completed)
     VALUES (@userId, @date, @language, @sentence_id, @sentence_text, @pronounce_score, @sentence_score, @completed)
     ON CONFLICT(user_id, date, language) DO UPDATE SET
       pronounce_score = COALESCE(excluded.pronounce_score, daily_checkins.pronounce_score),
       sentence_score  = COALESCE(excluded.sentence_score, daily_checkins.sentence_score),
       completed       = MAX(daily_checkins.completed, excluded.completed)`
  ).run({ ...checkin, userId });
}

/** Get recent checkins */
export function getRecentCheckins(userId: string, limit = 30, language?: "en" | "ko"): DailyCheckin[] {
  const db = getDb();
  return language
    ? db.prepare(`SELECT * FROM daily_checkins WHERE user_id = ? AND language = ? ORDER BY date DESC LIMIT ?`).all(userId, language, limit) as DailyCheckin[]
    : db.prepare(`SELECT * FROM daily_checkins WHERE user_id = ? ORDER BY date DESC LIMIT ?`).all(userId, limit) as DailyCheckin[];
}

/** Get today's checkin */
export function getTodayCheckin(userId: string, language: "en" | "ko", date: string): DailyCheckin | undefined {
  const db = getDb();
  return db.prepare(
    `SELECT * FROM daily_checkins WHERE user_id = ? AND date = ? AND language = ?`
  ).get(userId, date, language) as DailyCheckin | undefined;
}

/** Get checkin streak (consecutive days before today) */
export function getCheckinStreak(userId: string, language?: "en" | "ko"): number {
  const db = getDb();
  const rows = language
    ? db.prepare(`SELECT date FROM daily_checkins WHERE user_id = ? AND language = ? ORDER BY date DESC`).all(userId, language) as { date: string }[]
    : db.prepare(`SELECT date FROM daily_checkins WHERE user_id = ? ORDER BY date DESC`).all(userId) as { date: string }[];

  if (rows.length === 0) return 0;

  let streak = 0;
  let referenceDate = new Date();
  referenceDate.setHours(0, 0, 0, 0);

  for (let i = 0; i < rows.length; i++) {
    const expected = new Date(referenceDate);
    expected.setDate(expected.getDate() - i);
    const expectedStr = expected.toISOString().slice(0, 10);

    if (rows[i].date === expectedStr) {
      streak++;
    } else if (i === 0) {
      const yesterday = new Date(referenceDate);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().slice(0, 10);
      if (rows[i].date === yesterdayStr) {
        streak++;
        referenceDate = yesterday;
      } else {
        break;
      }
    } else {
      break;
    }
  }

  return streak;
}

/** Get total checkin score */
export function getTotalCheckinScore(userId: string, language?: "en" | "ko"): number {
  const db = getDb();
  const row = language
    ? db.prepare(`SELECT COALESCE(SUM(COALESCE(pronounce_score, 0) + COALESCE(sentence_score, 0)), 0) as total FROM daily_checkins WHERE user_id = ? AND language = ?`).get(userId, language) as { total: number }
    : db.prepare(`SELECT COALESCE(SUM(COALESCE(pronounce_score, 0) + COALESCE(sentence_score, 0)), 0) as total FROM daily_checkins WHERE user_id = ?`).get(userId) as { total: number };
  return row.total;
}

/** Get checkin dates for heatmap (last N days) */
export function getCheckinDates(userId: string, days: number, language?: "en" | "ko"): { date: string; score: number }[] {
  const db = getDb();
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString().slice(0, 10);

  const rows = language
    ? db.prepare(`SELECT date, COALESCE(pronounce_score, 0) + COALESCE(sentence_score, 0) as score FROM daily_checkins WHERE user_id = ? AND date >= ? AND language = ? ORDER BY date ASC`).all(userId, sinceStr, language) as { date: string; score: number }[]
    : db.prepare(`SELECT date, COALESCE(pronounce_score, 0) + COALESCE(sentence_score, 0) as score FROM daily_checkins WHERE user_id = ? AND date >= ? ORDER BY date ASC`).all(userId, sinceStr) as { date: string; score: number }[];

  return rows;
}

// ── Learning Stats ────────────────────────────────────────────

export interface LearningStat {
  id: number;
  user_id: string | null;
  date: string;
  language: "en" | "ko";
  dialogue_count: number;
  total_rounds: number;
  duration_minutes: number;
  new_vocab_count: number;
  avg_accuracy: number;
  scene_distribution: string;
  error_types: string;
}

/** Upsert daily stats (scoped to user) */
export function upsertDailyStat(userId: string, stat: Omit<LearningStat, "id" | "user_id">) {
  const db = getDb();
  db.prepare(
    `INSERT INTO learning_stats (user_id, date, language, dialogue_count, total_rounds, duration_minutes, new_vocab_count, avg_accuracy, scene_distribution, error_types)
     VALUES (@userId, @date, @language, @dialogue_count, @total_rounds, @duration_minutes, @new_vocab_count, @avg_accuracy, @scene_distribution, @error_types)
     ON CONFLICT(user_id, date, language) DO UPDATE SET
       dialogue_count    = excluded.dialogue_count,
       total_rounds      = excluded.total_rounds,
       duration_minutes  = excluded.duration_minutes,
       new_vocab_count   = excluded.new_vocab_count,
       avg_accuracy      = excluded.avg_accuracy,
       scene_distribution = excluded.scene_distribution,
       error_types        = excluded.error_types`
  ).run({ ...stat, userId });
}

/** Get stats for a date range */
export function getStatsInRange(userId: string, from: string, to: string, language?: "en" | "ko"): LearningStat[] {
  const db = getDb();
  return language
    ? db.prepare(`SELECT * FROM learning_stats WHERE user_id = ? AND date >= ? AND date <= ? AND language = ? ORDER BY date ASC`).all(userId, from, to, language) as LearningStat[]
    : db.prepare(`SELECT * FROM learning_stats WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date ASC`).all(userId, from, to) as LearningStat[];
}

/** Aggregate stats for a date range */
export function aggregateStats(userId: string, from: string, to: string, language?: "en" | "ko") {
  const db = getDb();
  const row = language
    ? db.prepare(`SELECT
       COALESCE(SUM(dialogue_count), 0) as total_sessions,
       COALESCE(SUM(total_rounds), 0)   as total_rounds,
       COALESCE(SUM(duration_minutes), 0) as total_minutes,
       COALESCE(SUM(new_vocab_count), 0) as total_vocab,
       COALESCE(AVG(avg_accuracy), 0)   as avg_accuracy
     FROM learning_stats WHERE user_id = ? AND date >= ? AND date <= ? AND language = ?`).get(userId, from, to, language) as { total_sessions: number; total_rounds: number; total_minutes: number; total_vocab: number; avg_accuracy: number }
    : db.prepare(`SELECT
       COALESCE(SUM(dialogue_count), 0) as total_sessions,
       COALESCE(SUM(total_rounds), 0)   as total_rounds,
       COALESCE(SUM(duration_minutes), 0) as total_minutes,
       COALESCE(SUM(new_vocab_count), 0) as total_vocab,
       COALESCE(AVG(avg_accuracy), 0)   as avg_accuracy
     FROM learning_stats WHERE user_id = ? AND date >= ? AND date <= ?`).get(userId, from, to) as { total_sessions: number; total_rounds: number; total_minutes: number; total_vocab: number; avg_accuracy: number };
  return row;
}

// ── Vocabulary ────────────────────────────────────────────────

export interface VocabEntry {
  id: number;
  user_id: string | null;
  word: string;
  language: "en" | "ko";
  meaning: string;
  phonetic: string | null;
  scene_id: string | null;
  saved_at: string;
  review_count: number;
  last_reviewed: string | null;
}

/** Save a new vocabulary word (ignore duplicates, scoped to user) */
export function saveVocabulary(
  userId: string,
  word: Omit<VocabEntry, "id" | "saved_at" | "review_count" | "last_reviewed" | "user_id">
) {
  const db = getDb();
  const existing = db.prepare(
    `SELECT id FROM vocabulary WHERE user_id = ? AND word = ? AND language = ?`
  ).get(userId, word.word, word.language);
  if (existing) return;

  db.prepare(
    `INSERT INTO vocabulary (user_id, word, language, meaning, phonetic, scene_id)
     VALUES (@userId, @word, @language, @meaning, @phonetic, @scene_id)`
  ).run({ ...word, userId });
}

/** Get vocabulary list */
export function getVocabularyList(userId: string, language?: "en" | "ko"): VocabEntry[] {
  const db = getDb();
  return language
    ? db.prepare(`SELECT * FROM vocabulary WHERE user_id = ? AND language = ? ORDER BY saved_at DESC`).all(userId, language) as VocabEntry[]
    : db.prepare(`SELECT * FROM vocabulary WHERE user_id = ? ORDER BY saved_at DESC`).all(userId) as VocabEntry[];
}

/** Get vocabulary count for date range */
export function getVocabCountInRange(userId: string, from: string, to: string, language?: "en" | "ko"): number {
  const db = getDb();
  const row = language
    ? db.prepare(`SELECT COUNT(*) as cnt FROM vocabulary WHERE user_id = ? AND saved_at >= ? AND saved_at <= ? AND language = ?`).get(userId, from, to, language) as { cnt: number }
    : db.prepare(`SELECT COUNT(*) as cnt FROM vocabulary WHERE user_id = ? AND saved_at >= ? AND saved_at <= ?`).get(userId, from, to) as { cnt: number };
  return row.cnt;
}

/** Get cumulative vocab count up to date */
export function getCumulativeVocab(userId: string, upTo: string, language?: "en" | "ko"): number {
  const db = getDb();
  const row = language
    ? db.prepare(`SELECT COUNT(*) as cnt FROM vocabulary WHERE user_id = ? AND saved_at <= ? AND language = ?`).get(userId, upTo, language) as { cnt: number }
    : db.prepare(`SELECT COUNT(*) as cnt FROM vocabulary WHERE user_id = ? AND saved_at <= ?`).get(userId, upTo) as { cnt: number };
  return row.cnt;
}

/** Get daily new vocab counts for range */
export function getDailyVocabCounts(userId: string, from: string, to: string, language?: "en" | "ko"): { date: string; count: number }[] {
  const db = getDb();
  const rows = language
    ? db.prepare(`SELECT date(saved_at) as d, COUNT(*) as cnt FROM vocabulary WHERE user_id = ? AND saved_at >= ? AND saved_at <= ? AND language = ? GROUP BY d ORDER BY d ASC`).all(userId, from, to, language) as { d: string; cnt: number }[]
    : db.prepare(`SELECT date(saved_at) as d, COUNT(*) as cnt FROM vocabulary WHERE user_id = ? AND saved_at >= ? AND saved_at <= ? GROUP BY d ORDER BY d ASC`).all(userId, from, to) as { d: string; cnt: number }[];

  return rows.map(r => ({ date: r.d, count: r.cnt }));
}

/** Mark a vocabulary word as reviewed (increment review_count, update last_reviewed) */
export function markVocabReviewed(userId: string, word: string, language: "en" | "ko") {
  const db = getDb();
  db.prepare(
    `UPDATE vocabulary SET review_count = review_count + 1, last_reviewed = datetime('now')
     WHERE user_id = ? AND word = ? AND language = ?`
  ).run(userId, word, language);
}

/** Get all vocabulary words for a language, with meaning for game matching */
export function getVocabularyForGame(userId: string, language: "en" | "ko"): VocabEntry[] {
  const db = getDb();
  return db.prepare(
    `SELECT * FROM vocabulary WHERE user_id = ? AND language = ? ORDER BY last_reviewed IS NULL DESC, last_reviewed ASC, saved_at ASC LIMIT 40`
  ).all(userId, language) as VocabEntry[];
}

// ── Game History ──────────────────────────────────────────────

export interface GameRecord {
  id: number;
  user_id: string | null;
  language: "en" | "ko";
  pairs: number;
  attempts: number;
  accuracy: number;
  words_matched: string;
  words_failed: string;
  played_at: string;
}

/** Save a game session result */
export function saveGameResult(userId: string, result: Omit<GameRecord, "id" | "played_at" | "user_id">) {
  const db = getDb();
  db.prepare(
    `INSERT INTO game_history (user_id, language, pairs, attempts, accuracy, words_matched, words_failed)
     VALUES (@userId, @language, @pairs, @attempts, @accuracy, @words_matched, @words_failed)`
  ).run({ ...result, userId });
}

/** Get the last game's failed words for review queue */
export function getLastGameFailedWords(userId: string, language: "en" | "ko"): string[] {
  const db = getDb();
  const row = db.prepare(
    `SELECT words_failed FROM game_history WHERE user_id = ? AND language = ? ORDER BY played_at DESC LIMIT 1`
  ).get(userId, language) as { words_failed: string } | undefined;
  if (!row || !row.words_failed) return [];
  try {
    return JSON.parse(row.words_failed);
  } catch {
    return [];
  }
}
