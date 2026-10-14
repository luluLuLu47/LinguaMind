/**
 * Unit tests for repository.ts
 *
 * Uses mocked database to avoid native module issues.
 * Tests the SQL construction logic and parameterized query safety.
 * All repository functions are now scoped by userId for data isolation.
 */

import { describe, beforeEach, it, expect, vi } from "vitest"

// Create a mock database that captures SQL and params
interface MockStatement {
  sql: string
  run: (params?: unknown) => { changes: number }
  get: (params?: unknown) => unknown
  all: (params?: unknown) => unknown[]
}

interface MockDb {
  prepare: (sql: string) => MockStatement
  exec: (sql: string) => void
  pragma: (key: string) => void
  _statements: { sql: string; params: unknown[] }[]
  _store: Record<string, unknown[]>
}

function createMockDb(): MockDb {
  const statements: { sql: string; params: unknown[] }[] = []
  const store: Record<string, unknown[]> = {}

  const db: MockDb = {
    _statements: statements,
    _store: store,
    prepare(sql: string): MockStatement {
      return {
        sql,
        run: function(this: MockStatement) {
          const paramArr = Array.from(arguments)
          statements.push({ sql, params: paramArr })
          return { changes: 1 }
        },
        get: function(this: MockStatement) {
          const paramArr = Array.from(arguments)
          statements.push({ sql, params: paramArr })
          if (sql.includes("COUNT")) return { cnt: 1 }
          if (sql.includes("AVG")) return { avg: 80 }
          if (sql.includes("SUM")) return { total: 150, total_sessions: 5, total_rounds: 25, total_minutes: 75, total_vocab: 15, avg_accuracy: 82.5 }
          return undefined
        },
        all: function(this: MockStatement) {
          const paramArr = Array.from(arguments)
          statements.push({ sql, params: paramArr })
          return []
        },
      }
    },
    exec: () => {},
    pragma: () => {},
  }

  return db
}

const mockDb = createMockDb()

vi.mock("@/lib/db", () => ({
  getDb: () => mockDb,
  closeDb: () => {},
}))

// Import after mock
import {
  createSession,
  endSession,
  insertMessage,
  getSessionMessages,
  getRecentSessions,
  getSessionCountInRange,
  getTotalRoundsInRange,
  getAvgAccuracyInRange,
  getSceneDistribution,
  getDailyAccuracy,
  upsertCheckin,
  getRecentCheckins,
  getTodayCheckin,
  getCheckinStreak,
  getTotalCheckinScore,
  getCheckinDates,
  upsertDailyStat,
  getStatsInRange,
  aggregateStats,
  saveVocabulary,
  getVocabCountInRange,
  getCumulativeVocab,
  getDailyVocabCounts,
} from "@/lib/repository"

const UID = "user-1"

describe("Repository: SQL Parameterization Safety", () => {
  beforeEach(() => {
    mockDb._statements.length = 0
  })

  it("should use parameterized query for getSessionCountInRange with language", () => {
    getSessionCountInRange(UID, "2026-08-01", "2026-08-31", "en")

    const stmt = mockDb._statements[mockDb._statements.length - 1]
    expect(stmt.sql).toContain("?")
    expect(stmt.sql).not.toContain("'en'")
    expect(stmt.params).toContain("en")
  })

  it("should use parameterized query for getSessionCountInRange without language", () => {
    getSessionCountInRange(UID, "2026-08-01", "2026-08-31")

    const stmt = mockDb._statements[mockDb._statements.length - 1]
    expect(stmt.sql).not.toContain("'${")
    expect(stmt.params).toEqual([UID, "2026-08-01", "2026-08-31"])
  })

  it("should use parameterized query for getTotalRoundsInRange", () => {
    getTotalRoundsInRange(UID, "2026-08-01", "2026-08-31", "ko")

    const stmt = mockDb._statements[mockDb._statements.length - 1]
    expect(stmt.sql).toContain("?")
    expect(stmt.sql).not.toContain("'ko'")
    expect(stmt.params).toContain("ko")
  })

  it("should use parameterized query for getAvgAccuracyInRange", () => {
    getAvgAccuracyInRange(UID, "2026-08-01", "2026-08-31", "en")

    const stmt = mockDb._statements[mockDb._statements.length - 1]
    expect(stmt.sql).toContain("?")
    expect(stmt.sql).not.toContain("'en'")
  })

  it("should use parameterized query for getSceneDistribution", () => {
    getSceneDistribution(UID, "2026-08-01", "2026-08-31", "ko")

    const stmt = mockDb._statements[mockDb._statements.length - 1]
    expect(stmt.sql).toContain("?")
    expect(stmt.sql).not.toContain("'ko'")
  })

  it("should use parameterized query for getRecentCheckins with language", () => {
    getRecentCheckins(UID, 30, "en")

    const stmt = mockDb._statements[mockDb._statements.length - 1]
    expect(stmt.sql).toContain("?")
    expect(stmt.sql).not.toContain("'en'")
    expect(stmt.params).toContain("en")
  })

  it("should use parameterized query for getCheckinStreak with language", () => {
    getCheckinStreak(UID, "en")

    const stmt = mockDb._statements[mockDb._statements.length - 1]
    expect(stmt.sql).toContain("?")
    expect(stmt.sql).not.toContain("'en'")
  })

  it("should use parameterized query for getTotalCheckinScore", () => {
    getTotalCheckinScore(UID, "ko")

    const stmt = mockDb._statements[mockDb._statements.length - 1]
    expect(stmt.sql).toContain("?")
    expect(stmt.sql).not.toContain("'ko'")
  })

  it("should use parameterized query for getCheckinDates", () => {
    getCheckinDates(UID, 90, "en")

    const stmt = mockDb._statements[mockDb._statements.length - 1]
    expect(stmt.sql).toContain("?")
    expect(stmt.sql).not.toContain("'en'")
  })

  it("should use parameterized query for getStatsInRange", () => {
    getStatsInRange(UID, "2026-08-01", "2026-08-31", "ko")

    const stmt = mockDb._statements[mockDb._statements.length - 1]
    expect(stmt.sql).toContain("?")
    expect(stmt.sql).not.toContain("'ko'")
  })

  it("should use parameterized query for aggregateStats", () => {
    aggregateStats(UID, "2026-08-01", "2026-08-31", "en")

    const stmt = mockDb._statements[mockDb._statements.length - 1]
    expect(stmt.sql).toContain("?")
    expect(stmt.sql).not.toContain("'en'")
  })

  it("should use parameterized query for getVocabCountInRange", () => {
    getVocabCountInRange(UID, "2026-08-01", "2026-08-31", "en")

    const stmt = mockDb._statements[mockDb._statements.length - 1]
    expect(stmt.sql).toContain("?")
    expect(stmt.sql).not.toContain("'en'")
  })

  it("should use parameterized query for getCumulativeVocab", () => {
    getCumulativeVocab(UID, "2026-12-31", "ko")

    const stmt = mockDb._statements[mockDb._statements.length - 1]
    expect(stmt.sql).toContain("?")
    expect(stmt.sql).not.toContain("'ko'")
  })

  it("should use parameterized query for getDailyVocabCounts", () => {
    getDailyVocabCounts(UID, "2026-08-01", "2026-08-31", "en")

    const stmt = mockDb._statements[mockDb._statements.length - 1]
    expect(stmt.sql).toContain("?")
    expect(stmt.sql).not.toContain("'en'")
  })

  it("should use parameterized query for getDailyAccuracy", () => {
    getDailyAccuracy(UID, "2026-08-01", "2026-08-31", "ko")

    const stmt = mockDb._statements[mockDb._statements.length - 1]
    expect(stmt.sql).toContain("?")
    expect(stmt.sql).not.toContain("'ko'")
  })

  it("should scope queries by user_id", () => {
    getSessionCountInRange(UID, "2026-08-01", "2026-08-31", "en")

    const stmt = mockDb._statements[mockDb._statements.length - 1]
    expect(stmt.sql).toContain("user_id")
    expect(stmt.params).toContain(UID)
  })
})

describe("Repository: Session Operations", () => {
  beforeEach(() => {
    mockDb._statements.length = 0
  })

  it("should create a session with named parameters", () => {
    createSession(UID, {
      id: "test-1",
      scene_id: "airport",
      scene_title: "Airport",
      language: "en",
      started_at: "2026-08-09 10:00:00",
    })

    const stmt = mockDb._statements[mockDb._statements.length - 1]
    expect(stmt.sql).toContain("INSERT INTO dialogue_sessions")
    expect(stmt.sql).toContain("@id")
    expect(stmt.sql).toContain("@scene_id")
    expect(stmt.sql).toContain("@userId")
  })

  it("should end a session with named parameters", () => {
    endSession(UID, "test-1", 5, 85)

    const stmt = mockDb._statements[mockDb._statements.length - 1]
    expect(stmt.sql).toContain("UPDATE dialogue_sessions")
    expect(stmt.sql).toContain("@rounds")
    expect(stmt.sql).toContain("@score")
    expect(stmt.sql).toContain("user_id")
  })

  it("should insert a message with named parameters", () => {
    insertMessage(UID, {
      session_id: "test-1",
      role: "user",
      content: "Hello",
      score: null,
      feedback: null,
    })

    const stmt = mockDb._statements[mockDb._statements.length - 1]
    expect(stmt.sql).toContain("INSERT INTO dialogue_messages")
    expect(stmt.sql).toContain("@session_id")
    expect(stmt.sql).toContain("@role")
  })

  it("should query session messages with ? parameter", () => {
    getSessionMessages(UID, "test-1")

    const stmt = mockDb._statements[mockDb._statements.length - 1]
    expect(stmt.sql).toContain("?")
    expect(stmt.params).toContain("test-1")
    expect(stmt.params).toContain(UID)
  })
})

describe("Repository: Vocabulary Deduplication", () => {
  beforeEach(() => {
    mockDb._statements.length = 0
  })

  it("should check for existing word before insert", () => {
    const db = mockDb
    const originalPrepare = db.prepare
    let getCallCount = 0
    db.prepare = (sql: string): MockStatement => ({
      sql,
      run: () => ({ changes: 1 }),
      get: () => { getCallCount++; return undefined },
      all: () => [] as unknown[],
    })

    saveVocabulary(UID, {
      word: "serendipity",
      language: "en",
      meaning: "幸运发现",
      phonetic: null,
      scene_id: null,
    })

    expect(getCallCount).toBeGreaterThan(0)

    db.prepare = originalPrepare
  })
})
