import { describe, it, expect } from "vitest"
import {
  createCards,
  shuffleCards,
  checkMatch,
  pickRandomPairs,
  buildReviewQueue,
  updateReviewStatus,
  type GameCard,
  type WordPair,
  type ReviewItem,
} from "./game-logic"

// ── 默认 fallback 单词（当 API 无数据时使用）─────────────────
const FALLBACK_PAIRS: WordPair[] = [
  { en: "apple", zh: "苹果", emoji: "🍎" },
  { en: "book", zh: "书", emoji: "📖" },
  { en: "cat", zh: "猫", emoji: "🐱" },
  { en: "dog", zh: "狗", emoji: "🐶" },
  { en: "sun", zh: "太阳", emoji: "☀️" },
  { en: "moon", zh: "月亮", emoji: "🌙" },
  { en: "star", zh: "星星", emoji: "⭐" },
  { en: "fish", zh: "鱼", emoji: "🐟" },
]

describe("mini-game: game-logic", () => {
  describe("createCards", () => {
    it("creates 16 cards from 8 word pairs (fallback)", () => {
      const cards = createCards()
      expect(cards).toHaveLength(16)
    })

    it("creates exactly 8 unique pairIds (fallback)", () => {
      const cards = createCards()
      const pairIds = new Set(cards.map(c => c.pairId))
      expect(pairIds.size).toBe(8)
    })

    it("creates 2 cards per pairId (fallback)", () => {
      const cards = createCards()
      const countByPair = new Map<number, number>()
      for (const c of cards) {
        countByPair.set(c.pairId, (countByPair.get(c.pairId) || 0) + 1)
      }
      for (const [, count] of countByPair) {
        expect(count).toBe(2)
      }
    })

    it("each card has emoji and word", () => {
      const cards = createCards()
      for (const c of cards) {
        expect(c.emoji).toBeTruthy()
        expect(c.word).toBeTruthy()
        expect(c.matched).toBe(false)
      }
    })

    it("accepts custom word pairs", () => {
      const custom: WordPair[] = [
        { en: "hello", zh: "你好", emoji: "👋" },
        { en: "water", zh: "水", emoji: "💧" },
      ]
      const cards = createCards(custom)
      expect(cards).toHaveLength(4)
      expect(cards[0].word).toBe("hello")
      expect(cards[1].word).toBe("你好")
    })

    it("caps at 8 pairs when more than 8 provided", () => {
      const many: WordPair[] = Array.from({ length: 20 }, (_, i) => ({
        en: `word${i}`,
        zh: `词${i}`,
        emoji: "📝",
      }))
      const cards = createCards(many)
      expect(cards).toHaveLength(16) // 8 pairs × 2
    })
  })

  describe("shuffleCards", () => {
    it("returns the same number of cards", () => {
      const cards = createCards()
      const shuffled = shuffleCards([...cards])
      expect(shuffled).toHaveLength(16)
    })

    it("preserves all original pairIds", () => {
      const cards = createCards()
      const shuffled = shuffleCards([...cards])
      const originalIds = new Set(cards.map(c => c.pairId))
      const shuffledIds = new Set(shuffled.map(c => c.pairId))
      expect(shuffledIds).toEqual(originalIds)
    })

    it("produces a different order (with high probability)", () => {
      const cards = createCards()
      const shuffled = shuffleCards([...cards])
      const sameOrder = cards.every((c, i) => c.id === shuffled[i].id)
      expect(sameOrder).toBe(false)
    })
  })

  describe("checkMatch", () => {
    it("returns true when pairIds match and neither is matched", () => {
      const cards: GameCard[] = [
        { id: 0, word: "apple", pairId: 0, matched: false, emoji: "🍎" },
        { id: 1, word: "苹果", pairId: 0, matched: false, emoji: "🍎" },
      ]
      expect(checkMatch(cards, 0, 1)).toBe(true)
    })

    it("returns false when pairIds differ", () => {
      const cards: GameCard[] = [
        { id: 0, word: "apple", pairId: 0, matched: false, emoji: "🍎" },
        { id: 1, word: "book", pairId: 1, matched: false, emoji: "📖" },
      ]
      expect(checkMatch(cards, 0, 1)).toBe(false)
    })

    it("returns false when first card is already matched", () => {
      const cards: GameCard[] = [
        { id: 0, word: "apple", pairId: 0, matched: true, emoji: "🍎" },
        { id: 1, word: "苹果", pairId: 0, matched: false, emoji: "🍎" },
      ]
      expect(checkMatch(cards, 0, 1)).toBe(false)
    })

    it("returns false when second card is already matched", () => {
      const cards: GameCard[] = [
        { id: 0, word: "apple", pairId: 0, matched: false, emoji: "🍎" },
        { id: 1, word: "苹果", pairId: 0, matched: true, emoji: "🍎" },
      ]
      expect(checkMatch(cards, 0, 1)).toBe(false)
    })

    it("returns false when same index", () => {
      const cards: GameCard[] = [
        { id: 0, word: "apple", pairId: 0, matched: false, emoji: "🍎" },
      ]
      expect(checkMatch(cards, 0, 0)).toBe(false)
    })
  })

  describe("pickRandomPairs", () => {
    it("returns exactly N pairs from a larger pool", () => {
      const pool: WordPair[] = Array.from({ length: 20 }, (_, i) => ({
        en: `word${i}`,
        zh: `词${i}`,
        emoji: "📝",
      }))
      const picked = pickRandomPairs(pool, 8)
      expect(picked).toHaveLength(8)
    })

    it("returns all pairs when pool is smaller than N", () => {
      const pool: WordPair[] = [
        { en: "hello", zh: "你好", emoji: "👋" },
        { en: "water", zh: "水", emoji: "💧" },
      ]
      const picked = pickRandomPairs(pool, 8)
      expect(picked).toHaveLength(2)
    })

    it("returns empty array for empty pool", () => {
      const picked = pickRandomPairs([], 8)
      expect(picked).toHaveLength(0)
    })

    it("picks different pairs on subsequent calls (with high probability)", () => {
      const pool: WordPair[] = Array.from({ length: 20 }, (_, i) => ({
        en: `word${i}`,
        zh: `词${i}`,
        emoji: "📝",
      }))
      const picked1 = pickRandomPairs(pool, 8)
      const picked2 = pickRandomPairs(pool, 8)
      const same = picked1.every((p, i) => p.en === picked2[i]?.en)
      expect(same).toBe(false)
    })
  })

  // ── 间隔复习逻辑 ────────────────────────────────────────────
  describe("buildReviewQueue", () => {
    it("marks all items as 'new' when no history", () => {
      const words: ReviewItem[] = [
        { word: "apple", meaning: "苹果", id: 1 },
        { word: "book", meaning: "书", id: 2 },
      ]
      const queue = buildReviewQueue(words, [])
      expect(queue).toHaveLength(2)
      expect(queue[0].status).toBe("new")
      expect(queue[1].status).toBe("new")
    })

    it("marks items as 'review' when previously matched", () => {
      const words: ReviewItem[] = [
        { word: "apple", meaning: "苹果", id: 1 },
        { word: "book", meaning: "书", id: 2 },
      ]
      const history = [
        { word: "apple", matched: true },
      ]
      const queue = buildReviewQueue(words, history)
      expect(queue[0].status).toBe("review")
      expect(queue[1].status).toBe("new")
    })

    it("marks items as 'relearn' when previously failed", () => {
      const words: ReviewItem[] = [
        { word: "apple", meaning: "苹果", id: 1 },
      ]
      const history = [
        { word: "apple", matched: false },
      ]
      const queue = buildReviewQueue(words, history)
      expect(queue[0].status).toBe("relearn")
    })

    it("prioritizes relearn > review > new in queue order", () => {
      const words: ReviewItem[] = [
        { word: "alpha", meaning: "α", id: 1 }, // new
        { word: "beta", meaning: "β", id: 2 },  // relearn
        { word: "gamma", meaning: "γ", id: 3 }, // review
      ]
      const history = [
        { word: "beta", matched: false },
        { word: "gamma", matched: true },
      ]
      const queue = buildReviewQueue(words, history)
      expect(queue[0].word).toBe("beta")   // relearn first
      expect(queue[1].word).toBe("gamma") // review second
      expect(queue[2].word).toBe("alpha") // new last
    })
  })

  describe("updateReviewStatus", () => {
    it("returns matched=true for correct pair", () => {
      const result = updateReviewStatus("apple", true)
      expect(result).toEqual({ word: "apple", matched: true })
    })

    it("returns matched=false for incorrect pair", () => {
      const result = updateReviewStatus("apple", false)
      expect(result).toEqual({ word: "apple", matched: false })
    })
  })
})
