/**
 * SQLite Database Layer — LinguaMind
 *
 * Tables:
 *   dialogue_sessions  — 对话练习记录
 *   dialogue_messages  — 每条对话消息
 *   daily_checkins     — 每日打卡记录
 *   learning_stats     — 每日学习统计汇总
 *   vocabulary         — 生词收藏
 */

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

// ── DB singleton ──────────────────────────────────────────────
const DB_PATH = path.join(process.cwd(), "data", "linguamind.db");
const BACKUP_DIR = path.join(process.cwd(), "data", "backups");
const BACKUP_INTERVAL_MS = 6 * 60 * 60 * 1000; // 每 6 小时备份一次
const MAX_BACKUPS = 8; // 最多保留 8 个备份（约 2 天）

let _db: Database.Database | null = null;
let _backupTimer: NodeJS.Timeout | null = null;

/**
 * 备份数据库到 data/backups/ 目录。
 * 使用 SQLite 的 .backup API，在线热备份，不阻塞读写。
 */
export function backupDatabase(): boolean {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = path.join(BACKUP_DIR, `linguamind-${timestamp}.db`);
    const db = getDb();
    db.backup(backupPath);
    console.log(`[backup] 数据库已备份到 ${backupPath}`);

    // 清理旧备份，只保留最新的 MAX_BACKUPS 个
    const backups = fs
      .readdirSync(BACKUP_DIR)
      .filter((f) => f.startsWith("linguamind-") && f.endsWith(".db"))
      .sort()
      .reverse();
    for (const old of backups.slice(MAX_BACKUPS)) {
      fs.unlinkSync(path.join(BACKUP_DIR, old));
    }
    return true;
  } catch (err) {
    console.error("[backup] 备份失败:", err);
    return false;
  }
}

/**
 * 启动定时备份任务。
 * 服务启动时立即备份一次，之后每 6 小时备份一次。
 */
function startBackupScheduler() {
  // 启动时延迟 10 秒备份，避免影响冷启动
  setTimeout(() => backupDatabase(), 10_000);
  // 定时备份
  _backupTimer = setInterval(() => backupDatabase(), BACKUP_INTERVAL_MS);
}

/**
 * 停止定时备份（服务关闭时调用）。
 */
export function stopBackupScheduler() {
  if (_backupTimer) {
    clearInterval(_backupTimer);
    _backupTimer = null;
  }
}

export function getDb(): Database.Database {
  if (_db) return _db;

  // Ensure data dir exists
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  _db = new Database(DB_PATH);
  // WAL 模式：读写并发性能更好
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  // busy_timeout：写锁竞争时等待 5 秒而非立即报 "database is locked"
  _db.pragma("busy_timeout = 5000");
  // 同步模式：NORMAL 比 FULL 快，断电时 WAL 最后一帧可能丢但不损坏数据库
  _db.pragma("synchronous = NORMAL");
  // WAL 自动检查点：每 1000 页自动合并 WAL 到主库
  _db.pragma("wal_autocheckpoint = 1000");
  initSchema(_db);
  // 启动定时备份（仅首次初始化时）
  startBackupScheduler();
  return _db;
}

// ── Schema ────────────────────────────────────────────────────
function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS dialogue_sessions (
      id            TEXT PRIMARY KEY,
      user_id       TEXT,
      scene_id      TEXT NOT NULL,
      scene_title   TEXT NOT NULL,
      language      TEXT NOT NULL CHECK(language IN ('en','ko')),
      started_at    TEXT NOT NULL DEFAULT (datetime('now')),
      ended_at      TEXT,
      total_rounds  INTEGER DEFAULT 0,
      avg_score     REAL
    );

    CREATE TABLE IF NOT EXISTS dialogue_messages (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id    TEXT NOT NULL REFERENCES dialogue_sessions(id) ON DELETE CASCADE,
      user_id       TEXT,
      role          TEXT NOT NULL CHECK(role IN ('user','assistant','coach')),
      content       TEXT NOT NULL,
      score         INTEGER,
      feedback      TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS daily_checkins (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       TEXT,
      date          TEXT NOT NULL,
      language      TEXT NOT NULL CHECK(language IN ('en','ko')),
      sentence_id   TEXT NOT NULL,
      sentence_text TEXT NOT NULL,
      pronounce_score INTEGER,
      sentence_score  INTEGER,
      completed     INTEGER NOT NULL DEFAULT 0,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, date, language)
    );

    CREATE TABLE IF NOT EXISTS learning_stats (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       TEXT,
      date          TEXT NOT NULL,
      language      TEXT NOT NULL CHECK(language IN ('en','ko')),
      dialogue_count   INTEGER DEFAULT 0,
      total_rounds     INTEGER DEFAULT 0,
      duration_minutes INTEGER DEFAULT 0,
      new_vocab_count  INTEGER DEFAULT 0,
      avg_accuracy     REAL DEFAULT 0,
      scene_distribution TEXT DEFAULT '{}',
      error_types        TEXT DEFAULT '{}',
      UNIQUE(user_id, date, language)
    );

    CREATE TABLE IF NOT EXISTS vocabulary (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       TEXT,
      word          TEXT NOT NULL,
      language      TEXT NOT NULL CHECK(language IN ('en','ko')),
      meaning       TEXT NOT NULL,
      phonetic      TEXT,
      scene_id      TEXT,
      saved_at      TEXT NOT NULL DEFAULT (datetime('now')),
      review_count  INTEGER DEFAULT 0,
      last_reviewed TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_dialogue_messages_session ON dialogue_messages(session_id);
    CREATE INDEX IF NOT EXISTS idx_vocabulary_word ON vocabulary(word, language);

    CREATE TABLE IF NOT EXISTS game_history (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       TEXT,
      language      TEXT NOT NULL CHECK(language IN ('en','ko')),
      pairs         INTEGER NOT NULL,
      attempts      INTEGER NOT NULL,
      accuracy      REAL NOT NULL,
      words_matched TEXT NOT NULL DEFAULT '[]',
      words_failed  TEXT NOT NULL DEFAULT '[]',
      played_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_game_history_lang ON game_history(language);

    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      username      TEXT NOT NULL UNIQUE,
      email         TEXT,
      password_hash TEXT NOT NULL,
      display_name  TEXT,
      avatar_emoji  TEXT DEFAULT '🎓',
      target_level  TEXT DEFAULT 'cet4',
      daily_goal    INTEGER DEFAULT 20,
      role          TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user','admin')),
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      last_login    TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
  `);

  // 迁移已有数据库：给旧表添加 user_id 列，重建带旧 UNIQUE 约束的表
  migrateExistingTables(db);

  // 迁移 users 表添加 role 字段（兼容已有数据库）
  const usersCols = db.prepare(`PRAGMA table_info(users)`).all() as { name: string }[];
  if (!usersCols.some((c) => c.name === "role")) {
    db.exec(`ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'`);
  }

  // user_id 相关索引（迁移后所有表都有 user_id 列，可安全创建）
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_dialogue_sessions_user ON dialogue_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_daily_checkins_user ON daily_checkins(user_id, date);
    CREATE INDEX IF NOT EXISTS idx_learning_stats_user ON learning_stats(user_id, date);
    CREATE INDEX IF NOT EXISTS idx_vocabulary_user ON vocabulary(user_id, language);
    CREATE INDEX IF NOT EXISTS idx_game_history_user ON game_history(user_id);
  `);

  // 自动初始化默认管理员（首次启动时，密码从环境变量读取）
  ensureDefaultAdmin(db);
}

/** 首次启动时创建默认管理员账号（如不存在） */
function ensureDefaultAdmin(db: Database.Database) {
  const admin = db.prepare(`SELECT id FROM users WHERE username = 'admin'`).get() as { id: string } | undefined;
  if (admin) return;

  // 安全：管理员密码必须由环境变量提供，未设置则跳过创建并打印警告
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword || adminPassword.length < 8) {
    console.warn(
      "[init] 未设置 ADMIN_PASSWORD 环境变量（或长度不足 8 位），跳过管理员创建。\n" +
      "请设置 ADMIN_PASSWORD 后重启，或手动执行脚本创建管理员。"
    );
    return;
  }

  const bcrypt = require("bcryptjs") as typeof import("bcryptjs");
  const crypto = require("crypto") as typeof import("crypto");
  const id = crypto.randomUUID();
  const hash = bcrypt.hashSync(adminPassword, 10);

  db.prepare(
    `INSERT INTO users (id, username, email, password_hash, display_name, avatar_emoji, role)
     VALUES (?, ?, ?, ?, ?, ?, 'admin')`
  ).run(id, "admin", "admin@linguamind.local", hash, "Administrator", "👑");

  console.log("[init] 管理员账号已创建: admin（密码来自 ADMIN_PASSWORD 环境变量）");
}

// ── Migration: add user_id to legacy tables ───────────────────
function migrateExistingTables(db: Database.Database) {
  const ANON = "anonymous";

  // 给缺少 user_id 列的表添加列
  const tablesNeedingUserId = [
    "dialogue_sessions",
    "dialogue_messages",
    "vocabulary",
    "game_history",
  ];
  for (const table of tablesNeedingUserId) {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    if (!cols.some((c) => c.name === "user_id")) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN user_id TEXT`);
      db.exec(`UPDATE ${table} SET user_id = '${ANON}' WHERE user_id IS NULL`);
    }
  }

  // 重建 daily_checkins（旧版 UNIQUE(date) → 新版 UNIQUE(user_id, date, language)）
  const checkinSchema = db
    .prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='daily_checkins'`)
    .get() as { sql: string } | undefined;
  if (checkinSchema?.sql && !checkinSchema.sql.includes("user_id")) {
    db.exec(`
      CREATE TABLE daily_checkins_new (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id       TEXT,
        date          TEXT NOT NULL,
        language      TEXT NOT NULL CHECK(language IN ('en','ko')),
        sentence_id   TEXT NOT NULL,
        sentence_text TEXT NOT NULL,
        pronounce_score INTEGER,
        sentence_score  INTEGER,
        completed     INTEGER NOT NULL DEFAULT 0,
        created_at    TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(user_id, date, language)
      );
      INSERT INTO daily_checkins_new (id, user_id, date, language, sentence_id, sentence_text, pronounce_score, sentence_score, completed, created_at)
        SELECT id, '${ANON}', date, language, sentence_id, sentence_text, pronounce_score, sentence_score, completed, created_at FROM daily_checkins;
      DROP TABLE daily_checkins;
      ALTER TABLE daily_checkins_new RENAME TO daily_checkins;
      CREATE INDEX IF NOT EXISTS idx_daily_checkins_user ON daily_checkins(user_id, date);
    `);
  }

  // 重建 learning_stats（同上）
  const statsSchema = db
    .prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='learning_stats'`)
    .get() as { sql: string } | undefined;
  if (statsSchema?.sql && !statsSchema.sql.includes("user_id")) {
    db.exec(`
      CREATE TABLE learning_stats_new (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id       TEXT,
        date          TEXT NOT NULL,
        language      TEXT NOT NULL CHECK(language IN ('en','ko')),
        dialogue_count   INTEGER DEFAULT 0,
        total_rounds     INTEGER DEFAULT 0,
        duration_minutes INTEGER DEFAULT 0,
        new_vocab_count  INTEGER DEFAULT 0,
        avg_accuracy     REAL DEFAULT 0,
        scene_distribution TEXT DEFAULT '{}',
        error_types        TEXT DEFAULT '{}',
        UNIQUE(user_id, date, language)
      );
      INSERT INTO learning_stats_new (id, user_id, date, language, dialogue_count, total_rounds, duration_minutes, new_vocab_count, avg_accuracy, scene_distribution, error_types)
        SELECT id, '${ANON}', date, language, dialogue_count, total_rounds, duration_minutes, new_vocab_count, avg_accuracy, scene_distribution, error_types FROM learning_stats;
      DROP TABLE learning_stats;
      ALTER TABLE learning_stats_new RENAME TO learning_stats;
      CREATE INDEX IF NOT EXISTS idx_learning_stats_user ON learning_stats(user_id, date);
    `);
  }
}

// ── Helper: close DB (for tests / graceful shutdown) ──────────
export function closeDb() {
  if (_db) {
    _db.close();
    _db = null;
  }
}
