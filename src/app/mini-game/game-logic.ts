/**
 * Mini-Game: Word Match — Game Logic
 *
 * Supports:
 * - Dynamic word pairs from vocabulary API (with fallback)
 * - Random pair selection from larger pools
 * - Spaced review queue: relearn > review > new
 * - Track match history for interval review
 */

export interface GameCard {
  id: number
  word: string
  pairId: number
  matched: boolean
  emoji: string
}

export interface WordPair {
  en: string
  zh: string
  emoji: string
}

export interface ReviewItem {
  word: string
  meaning: string
  id?: number
}

export interface ReviewRecord {
  word: string
  matched: boolean
}

export type ReviewStatus = "new" | "review" | "relearn"

export interface ReviewQueueItem extends ReviewItem {
  status: ReviewStatus
}

// ── Fallback word pairs (when API has no data) ───────────────
// 使用 CET-4 核心词汇作为后备，不再使用小学级词汇
const FALLBACK_PAIRS: WordPair[] = [
  { en: "abandon", zh: "放弃；抛弃", emoji: "🚪" },
  { en: "ability", zh: "能力；才能", emoji: "💪" },
  { en: "absolute", zh: "绝对的；完全的", emoji: "🔒" },
  { en: "absorb", zh: "吸收；吸引", emoji: "🧽" },
  { en: "abstract", zh: "抽象的", emoji: "🔷" },
  { en: "abundant", zh: "丰富的；充裕的", emoji: "📦" },
  { en: "accept", zh: "接受；承认", emoji: "✅" },
  { en: "access", zh: "通道；进入权", emoji: "🔑" },
]

const MAX_PAIRS = 8

/**
 * Create game cards from word pairs.
 * Accepts custom pairs or uses fallback. Caps at MAX_PAIRS (8).
 */
export function createCards(pairs?: WordPair[]): GameCard[] {
  const source = pairs && pairs.length > 0
    ? pickRandomPairs(pairs, MAX_PAIRS)
    : FALLBACK_PAIRS

  const cards: GameCard[] = []
  source.forEach((pair, idx) => {
    cards.push({ id: idx * 2, word: pair.en, pairId: idx, matched: false, emoji: pair.emoji })
    cards.push({ id: idx * 2 + 1, word: pair.zh, pairId: idx, matched: false, emoji: pair.emoji })
  })
  return cards
}

/**
 * Shuffle cards using Fisher-Yates algorithm.
 */
export function shuffleCards(cards: GameCard[]): GameCard[] {
  const result = [...cards]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/**
 * Check if two cards form a matching pair.
 */
export function checkMatch(cards: GameCard[], firstIndex: number, secondIndex: number): boolean {
  if (firstIndex === secondIndex) return false
  const first = cards[firstIndex]
  const second = cards[secondIndex]
  if (!first || !second) return false
  if (first.matched || second.matched) return false
  return first.pairId === second.pairId
}

/**
 * Pick N random pairs from a larger pool.
 * Returns all pairs if pool is smaller than N.
 */
export function pickRandomPairs(pool: WordPair[], n: number): WordPair[] {
  if (pool.length === 0) return []
  if (pool.length <= n) return [...pool]

  const indices = new Set<number>()
  while (indices.size < n) {
    indices.add(Math.floor(Math.random() * pool.length))
  }
  return Array.from(indices).map(i => pool[i])
}

/**
 * Build a review queue from word list and match history.
 * - "relearn": previously failed (matched=false) → highest priority
 * - "review": previously matched → medium priority
 * - "new": no history → lowest priority
 *
 * Queue order: relearn → review → new
 */
export function buildReviewQueue(
  words: ReviewItem[],
  history: ReviewRecord[]
): ReviewQueueItem[] {
  const historyMap = new Map<string, boolean>()
  for (const record of history) {
    // If a word was matched at any point, treat as reviewed
    const existing = historyMap.get(record.word)
    if (existing === true) continue // already succeeded
    historyMap.set(record.word, record.matched)
  }

  const queue: ReviewQueueItem[] = words.map(word => {
    const histMatch = historyMap.get(word.word)
    let status: ReviewStatus = "new"
    if (histMatch === true) status = "review"
    else if (histMatch === false) status = "relearn"
    return { ...word, status }
  })

  // Sort: relearn (0) → review (1) → new (2)
  const priority: Record<ReviewStatus, number> = { relearn: 0, review: 1, new: 2 }
  queue.sort((a, b) => priority[a.status] - priority[b.status])

  return queue
}

/**
 * Record the result of a match attempt.
 * Returns the review record for storage.
 */
export function updateReviewStatus(word: string, matched: boolean): ReviewRecord {
  return { word, matched }
}
