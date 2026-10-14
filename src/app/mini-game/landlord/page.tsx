"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useLanguage } from "@/lib/language-context"
import {
  ChevronLeft, RotateCcw, Trophy, Loader2, Check, X,
  AlertCircle, Volume2, Spade, Crown, Users,
} from "lucide-react"
import { getWordsByLevel, type VocabWord } from "@/data/unified-vocab"

// ============================================================
// 类型定义
// ============================================================

type Suit = "♠" | "♥" | "♦" | "♣" | "🃏"
// 牌面点数：3-10 数字牌，11=J, 12=Q, 13=K, 14=A, 15=2, 16=小王, 17=大王
type Rank = 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17

interface Card {
  id: string
  suit: Suit
  rank: Rank
}

// 牌型种类
type CardType =
  | "single"          // 单张
  | "pair"             // 对子
  | "triple"           // 三张
  | "triple_single"    // 三带一
  | "triple_pair"      // 三带二
  | "straight"         // 顺子 (5+连张)
  | "pair_straight"    // 连对 (3对+)
  | "plane"            // 飞机 (纯, 2组三连+)
  | "plane_single"     // 飞机带单
  | "plane_pair"       // 飞机带对
  | "bomb"             // 炸弹 (4张相同)
  | "rocket"           // 火箭 (双王)

interface PlayResult {
  type: CardType
  size: number   // 主牌点数，用于比较大小
  cards: Card[]
}

type Phase = "dealing" | "bidding" | "playing" | "ended"
type Player = 0 | 1 | 2  // 0=人类玩家, 1=AI左, 2=AI右

interface WordQuestion {
  word: string
  meaning: string
  emoji: string
  options: string[]
  answerIndex: number
}

// ============================================================
// 牌面工具函数
// ============================================================

/** 点数转显示文本 */
function rankLabel(r: Rank): string {
  if (r === 16) return "JOKER"
  if (r === 17) return "JOKER"
  if (r === 11) return "J"
  if (r === 12) return "Q"
  if (r === 13) return "K"
  if (r === 14) return "A"
  if (r === 15) return "2"
  return String(r)
}

/** 牌面颜色：红心/方块/大王 红色；黑桃/梅花/小王 黑色 */
function cardColor(card: Card): string {
  if (card.rank === 17) return "#dc2626" // 大王红
  if (card.rank === 16) return "#1f2937" // 小王黑
  if (card.suit === "♥" || card.suit === "♦") return "#dc2626"
  return "#1f2937"
}

/** 构建 54 张牌（52 标准 + 大小王） */
function buildDeck(): Card[] {
  const deck: Card[] = []
  const suits: Suit[] = ["♠", "♥", "♦", "♣"]
  for (const suit of suits) {
    for (let r = 3; r <= 15; r++) {
      deck.push({ id: `${suit}-${r}`, suit, rank: r as Rank })
    }
  }
  deck.push({ id: "joker-small", suit: "🃏", rank: 16 })
  deck.push({ id: "joker-big", suit: "🃏", rank: 17 })
  return deck
}

/** Fisher-Yates 洗牌 */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** 手牌升序排序（小→大），便于展示与出牌 */
function sortHand(hand: Card[]): Card[] {
  return [...hand].sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank
    return a.suit.localeCompare(b.suit)
  })
}

// ============================================================
// 牌型判定
// ============================================================

/** 统计各点数出现次数 */
function getRankCount(cards: Card[]): Map<number, number> {
  const m = new Map<number, number>()
  for (const c of cards) {
    m.set(c.rank, (m.get(c.rank) || 0) + 1)
  }
  return m
}

/**
 * 判定牌型合法性
 * @returns 合法返回 {type, size, cards}，非法返回 null
 */
function validateCardType(cards: Card[]): PlayResult | null {
  if (cards.length === 0) return null
  const n = cards.length
  const counts = getRankCount(cards)
  const ranks = cards.map(c => c.rank).sort((a, b) => a - b)

  // 火箭：双王
  if (n === 2 && counts.get(16) === 1 && counts.get(17) === 1) {
    return { type: "rocket", size: 100, cards }
  }

  // 炸弹：4 张相同点数
  if (n === 4) {
    for (const [rank, count] of counts) {
      if (count === 4) return { type: "bomb", size: rank, cards }
    }
  }

  // 单张
  if (n === 1) return { type: "single", size: ranks[0], cards }

  // 对子（不能用王凑对子，王只能组火箭）
  if (n === 2 && ranks[0] === ranks[1] && ranks[0] < 16) {
    return { type: "pair", size: ranks[0], cards }
  }

  // 三张
  if (n === 3 && counts.size === 1 && ranks[0] < 16) {
    return { type: "triple", size: ranks[0], cards }
  }

  // 三带一：3+1
  if (n === 4 && counts.size === 2) {
    const entries = Array.from(counts.entries())
    const triple = entries.find(([, c]) => c === 3)
    const single = entries.find(([, c]) => c === 1)
    if (triple && single) {
      return { type: "triple_single", size: triple[0], cards }
    }
  }

  // 三带二：3+2（对子不能用王）
  if (n === 5 && counts.size === 2) {
    const entries = Array.from(counts.entries())
    const triple = entries.find(([, c]) => c === 3)
    const pair = entries.find(([, c]) => c === 2)
    if (triple && pair && pair[0] < 16) {
      return { type: "triple_pair", size: triple[0], cards }
    }
  }

  // 顺子：5+ 连张，不含 2 和王
  if (n >= 5 && counts.size === n) {
    const sorted = ranks.slice()
    let isStraight = true
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] !== sorted[i - 1] + 1) { isStraight = false; break }
    }
    if (isStraight && sorted[sorted.length - 1] <= 14) {
      return { type: "straight", size: sorted[0], cards }
    }
  }

  // 连对：3+ 连续对子，不含 2 和王
  if (n >= 6 && n % 2 === 0) {
    const allPairs = Array.from(counts.values()).every(c => c === 2)
    if (allPairs && counts.size === n / 2) {
      const pairRanks = Array.from(counts.keys()).sort((a, b) => a - b)
      let isConsecutive = true
      for (let i = 1; i < pairRanks.length; i++) {
        if (pairRanks[i] !== pairRanks[i - 1] + 1) { isConsecutive = false; break }
      }
      if (isConsecutive && pairRanks[pairRanks.length - 1] <= 14) {
        return { type: "pair_straight", size: pairRanks[0], cards }
      }
    }
  }

  // 飞机（纯）：2+ 连续三张，不含 2 和王
  if (n >= 6 && n % 3 === 0) {
    const allTriples = Array.from(counts.values()).every(c => c === 3)
    if (allTriples && counts.size === n / 3) {
      const tripleRanks = Array.from(counts.keys()).sort((a, b) => a - b)
      let isConsecutive = true
      for (let i = 1; i < tripleRanks.length; i++) {
        if (tripleRanks[i] !== tripleRanks[i - 1] + 1) { isConsecutive = false; break }
      }
      if (isConsecutive && tripleRanks[tripleRanks.length - 1] <= 14) {
        return { type: "plane", size: tripleRanks[0], cards }
      }
    }
  }

  // 飞机带单：n 组三连 + n 个单张（4n 张，n>=2）
  if (n >= 8 && n % 4 === 0) {
    const groupCount = n / 4
    const tripleEntries = Array.from(counts.entries()).filter(([, c]) => c === 3)
    const singleEntries = Array.from(counts.entries()).filter(([, c]) => c === 1)
    if (tripleEntries.length === groupCount && singleEntries.length === groupCount) {
      const tripleRanks = tripleEntries.map(([r]) => r).sort((a, b) => a - b)
      let isConsecutive = true
      for (let i = 1; i < tripleRanks.length; i++) {
        if (tripleRanks[i] !== tripleRanks[i - 1] + 1) { isConsecutive = false; break }
      }
      if (isConsecutive && tripleRanks[tripleRanks.length - 1] <= 14) {
        return { type: "plane_single", size: tripleRanks[0], cards }
      }
    }
  }

  // 飞机带对：n 组三连 + n 个对子（5n 张，n>=2）
  if (n >= 10 && n % 5 === 0) {
    const groupCount = n / 5
    const tripleEntries = Array.from(counts.entries()).filter(([, c]) => c === 3)
    const pairEntries = Array.from(counts.entries()).filter(([, c]) => c === 2)
    if (tripleEntries.length === groupCount && pairEntries.length === groupCount) {
      const tripleRanks = tripleEntries.map(([r]) => r).sort((a, b) => a - b)
      let isConsecutive = true
      for (let i = 1; i < tripleRanks.length; i++) {
        if (tripleRanks[i] !== tripleRanks[i - 1] + 1) { isConsecutive = false; break }
      }
      if (isConsecutive && tripleRanks[tripleRanks.length - 1] <= 14) {
        // 带的对子不能用王
        if (pairEntries.every(([r]) => r < 16)) {
          return { type: "plane_pair", size: tripleRanks[0], cards }
        }
      }
    }
  }

  return null
}

/**
 * 判定 current 是否能压过 last
 * - 火箭最大
 * - 炸弹大于任何非炸弹牌型
 * - 同类型同张数比主牌大小
 */
function canBeat(current: PlayResult, last: PlayResult | null): boolean {
  if (!last) return true
  if (current.type === "rocket") return true
  if (last.type === "rocket") return false
  if (current.type === "bomb" && last.type !== "bomb") return true
  if (last.type === "bomb" && current.type !== "bomb") return false
  if (current.type !== last.type) return false
  // 变长牌型（顺子、连对、飞机等）必须张数相同
  const variableTypes: CardType[] = ["straight", "pair_straight", "plane", "plane_single", "plane_pair"]
  if (variableTypes.includes(current.type)) {
    if (current.cards.length !== last.cards.length) return false
  }
  return current.size > last.size
}

// ============================================================
// AI 出牌辅助查找函数
// ============================================================

/** 找最小的比 minRank 大的单张 */
function findSingle(hand: Card[], minRank: number): PlayResult | null {
  const sorted = sortHand(hand)
  for (const c of sorted) {
    if (c.rank > minRank) {
      return { type: "single", size: c.rank, cards: [c] }
    }
  }
  return null
}

/** 找最小的比 minRank 大的对子 */
function findPair(hand: Card[], minRank: number): PlayResult | null {
  const counts = getRankCount(hand)
  const candidates = Array.from(counts.entries())
    .filter(([r, c]) => c >= 2 && r > minRank && r < 16)
    .map(([r]) => r)
    .sort((a, b) => a - b)
  if (candidates.length === 0) return null
  const rank = candidates[0]
  const cards = hand.filter(c => c.rank === rank).slice(0, 2)
  return { type: "pair", size: rank, cards }
}

/** 找最小的比 minRank 大的三张 */
function findTriple(hand: Card[], minRank: number): PlayResult | null {
  const counts = getRankCount(hand)
  const candidates = Array.from(counts.entries())
    .filter(([r, c]) => c >= 3 && r > minRank && r < 16)
    .map(([r]) => r)
    .sort((a, b) => a - b)
  if (candidates.length === 0) return null
  const rank = candidates[0]
  const cards = hand.filter(c => c.rank === rank).slice(0, 3)
  return { type: "triple", size: rank, cards }
}

/** 找最小的比 minRank 大的三带一 */
function findTripleSingle(hand: Card[], minRank: number): PlayResult | null {
  const triple = findTriple(hand, minRank)
  if (!triple) return null
  const remaining = hand.filter(c => !triple.cards.includes(c))
  if (remaining.length === 0) return null
  const sorted = sortHand(remaining)
  return {
    type: "triple_single",
    size: triple.size,
    cards: [...triple.cards, sorted[0]],
  }
}

/** 找最小的比 minRank 大的三带二 */
function findTriplePair(hand: Card[], minRank: number): PlayResult | null {
  const triple = findTriple(hand, minRank)
  if (!triple) return null
  const remaining = hand.filter(c => !triple.cards.includes(c))
  const counts = getRankCount(remaining)
  const candidates = Array.from(counts.entries())
    .filter(([r, c]) => c >= 2 && r < 16)
    .map(([r]) => r)
    .sort((a, b) => a - b)
  if (candidates.length === 0) return null
  const rank = candidates[0]
  const pair = remaining.filter(c => c.rank === rank).slice(0, 2)
  return {
    type: "triple_pair",
    size: triple.size,
    cards: [...triple.cards, ...pair],
  }
}

/** 找一个长度为 length、起始 > minStart 的顺子 */
function findStraight(hand: Card[], minStart: number, length: number): PlayResult | null {
  const counts = getRankCount(hand)
  const availableRanks = Array.from(counts.entries())
    .filter(([r]) => r <= 14)
    .map(([r]) => r)
    .sort((a, b) => a - b)
  for (let start = minStart + 1; start <= 14 - length + 1; start++) {
    let valid = true
    for (let i = 0; i < length; i++) {
      if (!availableRanks.includes(start + i)) { valid = false; break }
    }
    if (valid) {
      const cards: Card[] = []
      for (let i = 0; i < length; i++) {
        const c = hand.find(card => card.rank === start + i && !cards.includes(card))
        if (c) cards.push(c)
      }
      if (cards.length === length) {
        return { type: "straight", size: start, cards }
      }
    }
  }
  return null
}

/** 找最小的比 minRank 大的炸弹 */
function findBomb(hand: Card[], minRank: number): PlayResult | null {
  const counts = getRankCount(hand)
  const candidates = Array.from(counts.entries())
    .filter(([r, c]) => c === 4 && r > minRank)
    .map(([r]) => r)
    .sort((a, b) => a - b)
  if (candidates.length === 0) return null
  const rank = candidates[0]
  const cards = hand.filter(c => c.rank === rank).slice(0, 4)
  return { type: "bomb", size: rank, cards }
}

/** 找火箭（双王） */
function findRocket(hand: Card[]): PlayResult | null {
  const hasSmall = hand.some(c => c.rank === 16)
  const hasBig = hand.some(c => c.rank === 17)
  if (hasSmall && hasBig) {
    return {
      type: "rocket",
      size: 100,
      cards: hand.filter(c => c.rank >= 16),
    }
  }
  return null
}

/** 在 lastPlay 牌型中找同类型的压制牌 */
function findSameType(hand: Card[], lastPlay: PlayResult): PlayResult | null {
  switch (lastPlay.type) {
    case "single": return findSingle(hand, lastPlay.size)
    case "pair": return findPair(hand, lastPlay.size)
    case "triple": return findTriple(hand, lastPlay.size)
    case "triple_single": return findTripleSingle(hand, lastPlay.size)
    case "triple_pair": return findTriplePair(hand, lastPlay.size)
    case "straight": return findStraight(hand, lastPlay.size, lastPlay.cards.length)
    // 连对、飞机等复杂牌型 AI 暂不主动压制
    default: return null
  }
}

/**
 * AI 跟牌策略：找能压过 lastPlay 的最小牌型
 * 优先同类型压制，其次炸弹/火箭
 */
function findBeatingPlay(hand: Card[], lastPlay: PlayResult): PlayResult | null {
  if (lastPlay.type === "rocket") return null

  // lastPlay 是炸弹：只能用更大的炸弹或火箭压
  if (lastPlay.type === "bomb") {
    const biggerBomb = findBomb(hand, lastPlay.size)
    if (biggerBomb) return biggerBomb
    return findRocket(hand)
  }

  // 先尝试同类型压制
  const sameType = findSameType(hand, lastPlay)
  if (sameType) return sameType

  // 同类型压不了，考虑用炸弹/火箭（手牌少时更积极）
  if (hand.length <= 6) {
    const bomb = findBomb(hand, 0)
    if (bomb) return bomb
    const rocket = findRocket(hand)
    if (rocket) return rocket
  }

  return null
}

/** AI 领出策略：出最小的单张（简化版） */
function findLeadPlay(hand: Card[]): PlayResult | null {
  if (hand.length === 0) return null
  const sorted = sortHand(hand)
  // 若手牌仅剩 1 张，直接出
  if (sorted.length === 1) {
    return { type: "single", size: sorted[0].rank, cards: [sorted[0]] }
  }
  // 默认出最小单张
  return { type: "single", size: sorted[0].rank, cards: [sorted[0]] }
}

// ============================================================
// 单词题生成
// ============================================================

/**
 * 从统一词库生成一道选择题（1 正确 + 3 干扰项）
 */
function generateWordQuestion(pool: VocabWord[], used: Set<string>): WordQuestion | null {
  if (pool.length < 4) return null

  // 优先未出过的词
  let candidates = pool.filter(w => !used.has(w.word))
  if (candidates.length < 4) {
    // 不够则重置已用集合
    used.clear()
    candidates = pool
  }
  if (candidates.length < 4) return null

  // 随机选正确答案
  const correctIdx = Math.floor(Math.random() * candidates.length)
  const correct = candidates[correctIdx]

  // 选 3 个不重复的干扰项
  const distractorPool = candidates.filter((_, i) => i !== correctIdx)
  const distractors: VocabWord[] = []
  const usedMeanings = new Set<string>([correct.meaning])
  const poolCopy = [...distractorPool]
  while (distractors.length < 3 && poolCopy.length > 0) {
    const idx = Math.floor(Math.random() * poolCopy.length)
    const w = poolCopy[idx]
    if (!usedMeanings.has(w.meaning)) {
      distractors.push(w)
      usedMeanings.add(w.meaning)
    }
    poolCopy.splice(idx, 1)
  }
  if (distractors.length < 3) return null

  // 构建选项并打乱
  const allOptions = [correct.meaning, ...distractors.map(d => d.meaning)]
  for (let i = allOptions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[allOptions[i], allOptions[j]] = [allOptions[j], allOptions[i]]
  }

  return {
    word: correct.word,
    meaning: correct.meaning,
    emoji: correct.emoji,
    options: allOptions,
    answerIndex: allOptions.indexOf(correct.meaning),
  }
}

// ============================================================
// 主组件
// ============================================================

export default function LandlordPage() {
  const router = useRouter()
  const { language } = useLanguage()
  const lang = language as "en" | "ko"

  // 词库缓存
  const wordPoolRef = useRef<VocabWord[]>([])
  const usedWordsRef = useRef<Set<string>>(new Set())

  // 游戏状态
  const [phase, setPhase] = useState<Phase>("dealing")
  const [hands, setHands] = useState<Card[][]>([[], [], []])
  const [bottomCards, setBottomCards] = useState<Card[]>([])
  const [bottomRevealed, setBottomRevealed] = useState(false)
  const [landlord, setLandlord] = useState<Player | null>(null)
  const [currentTurn, setCurrentTurn] = useState<Player>(0)
  const [lastPlay, setLastPlay] = useState<PlayResult | null>(null)
  const [lastPlayer, setLastPlayer] = useState<Player | null>(null)
  const [selectedIndices, setSelectedIndices] = useState<number[]>([])
  const [winner, setWinner] = useState<Player | null>(null)
  const [message, setMessage] = useState<string>("")

  // 单词题
  const [wordQuestion, setWordQuestion] = useState<WordQuestion | null>(null)
  const [pendingPlay, setPendingPlay] = useState<PlayResult | null>(null)

  // 统计
  const [stats, setStats] = useState({
    correctAnswers: 0,
    wrongAnswers: 0,
    wordsLearned: [] as string[],
  })

  // 初始化词库（一次性）
  useEffect(() => {
    wordPoolRef.current = getWordsByLevel("all")
  }, [])

  // 初始化发牌
  const dealNewGame = useCallback(() => {
    const deck = shuffle(buildDeck())
    const h0 = sortHand(deck.slice(0, 17))
    const h1 = sortHand(deck.slice(17, 34))
    const h2 = sortHand(deck.slice(34, 51))
    const bottom = deck.slice(51, 54)
    setHands([h0, h1, h2])
    setBottomCards(bottom)
    setBottomRevealed(false)
    setLandlord(null)
    setCurrentTurn(0)
    setLastPlay(null)
    setLastPlayer(null)
    setSelectedIndices([])
    setWinner(null)
    setMessage("")
    setWordQuestion(null)
    setPendingPlay(null)
    setStats({ correctAnswers: 0, wrongAnswers: 0, wordsLearned: [] })
    usedWordsRef.current = new Set()
    setPhase("bidding")
  }, [])

  // 首次挂载发牌
  useEffect(() => {
    dealNewGame()
  }, [dealNewGame])

  // 判断人类是否赢得游戏
  const humanWon = winner !== null && (winner === 0 || (landlord !== 0 && landlord !== null && winner !== landlord))

  // 当前玩家是否领出
  const isLeading = lastPlay === null || lastPlayer === currentTurn

  // ---- 人类玩家操作 ----

  /** 点击手牌切换选中 */
  const handleCardClick = (index: number) => {
    if (phase !== "playing" || currentTurn !== 0 || wordQuestion) return
    setSelectedIndices(prev =>
      prev.includes(index)
        ? prev.filter(i => i !== index)
        : [...prev, index]
    )
    setMessage("")
  }

  /** 玩家点击出牌 */
  const handlePlayClick = () => {
    if (phase !== "playing" || currentTurn !== 0 || wordQuestion) return
    if (selectedIndices.length === 0) {
      setMessage(lang === "en" ? "Select cards first" : "카드를 먼저 선택하세요")
      return
    }
    const selected = selectedIndices.map(i => hands[0][i])
    const result = validateCardType(selected)
    if (!result) {
      setMessage(lang === "en" ? "Invalid card combination" : "잘못된 카드 조합")
      return
    }
    if (!isLeading && !canBeat(result, lastPlay)) {
      setMessage(lang === "en" ? "Can't beat the last play" : "이전 패를 이길 수 없습니다")
      return
    }
    // 弹出单词题
    const question = generateWordQuestion(wordPoolRef.current, usedWordsRef.current)
    if (!question) {
      // 词库不足，直接出牌
      executeHumanPlay(result)
      return
    }
    setPendingPlay(result)
    setWordQuestion(question)
    setMessage("")
  }

  /** 玩家点击不要 */
  const handlePass = () => {
    if (phase !== "playing" || currentTurn !== 0 || wordQuestion) return
    if (isLeading) {
      setMessage(lang === "en" ? "You must play (leading)" : "선수는 패를 내야 합니다")
      return
    }
    setSelectedIndices([])
    setMessage("")
    setCurrentTurn(((0 + 1) % 3) as Player)
  }

  /** 执行人类出牌 */
  const executeHumanPlay = (play: PlayResult) => {
    const newHands = [...hands]
    newHands[0] = hands[0].filter(c => !play.cards.includes(c))
    setHands(newHands)
    setLastPlay(play)
    setLastPlayer(0)
    setSelectedIndices([])

    if (newHands[0].length === 0) {
      setWinner(0)
      setPhase("ended")
      return
    }
    setCurrentTurn(1)
  }

  /** 单词题答题回调 */
  const handleQuizResult = (correct: boolean) => {
    const play = pendingPlay
    const question = wordQuestion
    setWordQuestion(null)
    setPendingPlay(null)

    if (question) {
      usedWordsRef.current.add(question.word)
      setStats(prev => ({
        ...prev,
        correctAnswers: prev.correctAnswers + (correct ? 1 : 0),
        wrongAnswers: prev.wrongAnswers + (correct ? 0 : 1),
        wordsLearned: correct && !prev.wordsLearned.includes(question.word)
          ? [...prev.wordsLearned, question.word]
          : prev.wordsLearned,
      }))
    }

    if (correct && play) {
      executeHumanPlay(play)
    } else {
      // 答错跳过回合
      setSelectedIndices([])
      setCurrentTurn(1)
    }
  }

  // ---- 叫地主阶段 ----

  const handleBid = (bid: boolean) => {
    let newLandlord: Player
    if (bid) {
      newLandlord = 0
    } else {
      // 玩家不叫，随机选一个 AI 当地主
      newLandlord = Math.random() < 0.5 ? 1 : 2
    }

    // 给地主发底牌
    const newHands = [...hands]
    newHands[newLandlord] = sortHand([...newHands[newLandlord], ...bottomCards])
    setHands(newHands)
    setBottomRevealed(true)
    setLandlord(newLandlord)
    setCurrentTurn(newLandlord)
    setLastPlay(null)
    setLastPlayer(null)

    // 短暂展示底牌后进入出牌阶段
    setTimeout(() => {
      setPhase("playing")
    }, 1500)
  }

  // ---- AI 回合 ----

  useEffect(() => {
    if (phase !== "playing") return
    if (currentTurn === 0) return
    if (wordQuestion) return

    const timer = setTimeout(() => {
      const player = currentTurn
      const hand = hands[player]
      const leading = lastPlay === null || lastPlayer === player

      let play: PlayResult | null = null
      if (leading) {
        play = findLeadPlay(hand)
      } else {
        // 队友领出（农民配合），70% 概率 pass
        const isTeammateLast =
          landlord !== null &&
          landlord !== player &&
          landlord !== lastPlayer
        if (isTeammateLast && Math.random() < 0.7) {
          play = null
        } else {
          play = findBeatingPlay(hand, lastPlay!)
        }
      }

      if (play) {
        const newHands = [...hands]
        newHands[player] = hand.filter(c => !play!.cards.includes(c))
        setHands(newHands)
        setLastPlay(play)
        setLastPlayer(player)

        if (newHands[player].length === 0) {
          setWinner(player)
          setPhase("ended")
          return
        }
      }
      // 下一回合
      setCurrentTurn(((player + 1) % 3) as Player)
    }, 900)

    return () => clearTimeout(timer)
  }, [phase, currentTurn, wordQuestion, hands, lastPlay, lastPlayer, landlord])

  // ============================================================
  // 多语言文案
  // ============================================================
  const t = lang === "en" ? {
    title: "Word Landlord",
    subtitle: "Answer quiz to play your cards!",
    restart: "New Game",
    bidTitle: "Bidding Phase",
    bidPrompt: "Do you want to be the Landlord?",
    bid: "Bid (Landlord)",
    pass: "Pass",
    yourTurn: "Your Turn",
    aiTurn: "AI Thinking...",
    play: "Play",
    skip: "Pass",
    bottomCards: "Bottom Cards",
    landlord: "Landlord",
    farmer: "Farmer",
    you: "You",
    ai1: "AI Left",
    ai2: "AI Right",
    cardsLeft: "cards",
    lastPlay: "Last Play",
    won: "You Won!",
    lost: "You Lost",
    playAgain: "Play Again",
    home: "Lobby",
    wordsLearned: "Words Learned",
    accuracy: "Accuracy",
    questions: "Questions",
    quizTitle: "Answer to Play Your Cards",
    quizPrompt: "What does this word mean?",
    quizCorrect: "Correct! Cards played.",
    quizWrong: "Wrong! Turn skipped.",
    pronounce: "Pronounce",
    selectCards: "Select cards to play",
    mustPlay: "You must play a valid combination",
  } : {
    title: "단어 투쟁",
    subtitle: "퀴즈를 맞춰야 패를 낼 수 있어요!",
    restart: "새 게임",
    bidTitle: "부름 단계",
    bidPrompt: "지주가 되시겠습니까?",
    bid: "부름 (지주)",
    pass: "패스",
    yourTurn: "내 차례",
    aiTurn: "AI 생각 중...",
    play: "출판",
    skip: "통과",
    bottomCards: "바닥 패",
    landlord: "지주",
    farmer: "농민",
    you: "나",
    ai1: "AI 왼쪽",
    ai2: "AI 오른쪽",
    cardsLeft: "장",
    lastPlay: "마지막 패",
    won: "승리!",
    lost: "패배",
    playAgain: "다시 하기",
    home: "로비",
    wordsLearned: "배운 단어",
    accuracy: "정확도",
    questions: "문제 수",
    quizTitle: "맞춰야 패를 낼 수 있어요",
    quizPrompt: "이 단어의 뜻은?",
    quizCorrect: "정답! 패를 냈습니다.",
    quizWrong: "틀렸어요! 차례를 넘깁니다.",
    pronounce: "발음 듣기",
    selectCards: "낼 패를 선택하세요",
    mustPlay: "유효한 패 조합을 내야 합니다",
  }

  const accuracy = (stats.correctAnswers + stats.wrongAnswers) > 0
    ? Math.round((stats.correctAnswers / (stats.correctAnswers + stats.wrongAnswers)) * 100)
    : 0

  return (
    <div className="min-h-screen pb-8" style={{ backgroundColor: "#0f5132" }}>
      <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/mini-game")}
              className="p-1.5 rounded-lg transition-colors hover:bg-white/10"
            >
              <ChevronLeft className="h-5 w-5 text-white" />
            </button>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2 text-white">
                <Spade className="h-5 w-5" style={{ color: "#fbbf24" }} />
                {t.title}
              </h1>
              <p className="text-xs text-white/70">{t.subtitle}</p>
            </div>
          </div>
          <button
            onClick={dealNewGame}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all hover:opacity-90"
            style={{ backgroundColor: "#fbbf24", color: "#1a1a1a" }}
          >
            <RotateCcw className="h-4 w-4" />
            {t.restart}
          </button>
        </div>

        {/* AI 对手信息 */}
        <div className="grid grid-cols-2 gap-3">
          <AiInfoCard
            name={t.ai1}
            count={hands[1].length}
            isLandlord={landlord === 1}
            isTurn={currentTurn === 1 && phase === "playing"}
            label={landlord === 1 ? t.landlord : t.farmer}
          />
          <AiInfoCard
            name={t.ai2}
            count={hands[2].length}
            isLandlord={landlord === 2}
            isTurn={currentTurn === 2 && phase === "playing"}
            label={landlord === 2 ? t.landlord : t.farmer}
          />
        </div>

        {/* 中间区域：底牌/出牌 */}
        <div
          className="rounded-2xl p-5 min-h-[180px] flex flex-col items-center justify-center"
          style={{
            backgroundColor: "#0a3d24",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          {phase === "bidding" && (
            <BiddingArea
              bottomCards={bottomCards}
              bottomRevealed={bottomRevealed}
              bidPrompt={t.bidPrompt}
              bidTitle={t.bidTitle}
              onBid={handleBid}
              lang={lang}
            />
          )}

          {phase === "playing" && (
            <PlayArea
              lastPlay={lastPlay}
              lastPlayer={lastPlayer}
              labels={[t.you, t.ai1, t.ai2]}
              isLeading={isLeading}
              currentTurn={currentTurn}
              yourTurnLabel={t.yourTurn}
              aiTurnLabel={t.aiTurn}
              lang={lang}
            />
          )}

          {phase === "dealing" && (
            <div className="flex items-center gap-2 text-white/70">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>{lang === "en" ? "Dealing..." : "패 돌리는 중..."}</span>
            </div>
          )}
        </div>

        {/* 玩家手牌区 */}
        <div
          className="rounded-2xl p-4"
          style={{
            backgroundColor: "#0a3d24",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-white" />
              <span className="text-sm font-bold text-white">
                {t.you}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{
                backgroundColor: landlord === 0 ? "#fbbf24" : "rgba(255,255,255,0.15)",
                color: landlord === 0 ? "#1a1a1a" : "#fff",
              }}>
                {landlord === 0 ? t.landlord : landlord !== null ? t.farmer : "-"}
              </span>
              <span className="text-xs text-white/60">
                {hands[0].length} {t.cardsLeft}
              </span>
            </div>
            {currentTurn === 0 && phase === "playing" && !wordQuestion && (
              <div
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold"
                style={{ backgroundColor: "#fbbf24", color: "#1a1a1a" }}
              >
                {t.yourTurn}
              </div>
            )}
          </div>

          {/* 手牌列表 */}
          {hands[0].length > 0 ? (
            <div className="flex flex-wrap gap-1 justify-center">
              {hands[0].map((card, idx) => (
                <CardView
                  key={card.id}
                  card={card}
                  selected={selectedIndices.includes(idx)}
                  onClick={() => handleCardClick(idx)}
                  disabled={phase !== "playing" || currentTurn !== 0 || !!wordQuestion}
                />
              ))}
            </div>
          ) : (
            <div className="text-center text-white/50 text-sm py-4">
              {lang === "en" ? "No cards" : "패 없음"}
            </div>
          )}

          {/* 操作按钮 */}
          {phase === "playing" && currentTurn === 0 && !wordQuestion && (
            <div className="flex justify-center gap-3 mt-4">
              <button
                onClick={handlePass}
                disabled={isLeading}
                className="px-5 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: "rgba(255,255,255,0.1)",
                  color: "#fff",
                  border: "1px solid rgba(255,255,255,0.2)",
                }}
              >
                {t.skip}
              </button>
              <button
                onClick={handlePlayClick}
                disabled={selectedIndices.length === 0}
                className="px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ backgroundColor: "#fbbf24", color: "#1a1a1a" }}
              >
                {t.play}
              </button>
            </div>
          )}

          {/* 提示消息 */}
          {message && (
            <div
              className="mt-3 text-center text-sm font-medium"
              style={{ color: "#fca5a5" }}
            >
              {message}
            </div>
          )}
        </div>
      </div>

      {/* 单词题弹窗 */}
      <WordQuizModal
        question={wordQuestion}
        onResult={handleQuizResult}
        lang={lang}
        titleText={t.quizTitle}
        promptText={t.quizPrompt}
        correctText={t.quizCorrect}
        wrongText={t.quizWrong}
        pronounceText={t.pronounce}
      />

      {/* 结算面板 */}
      {phase === "ended" && winner !== null && (
        <GameResultPanel
          humanWon={humanWon}
          stats={stats}
          accuracy={accuracy}
          lang={lang}
          onRestart={dealNewGame}
          onHome={() => router.push("/mini-game")}
        />
      )}
    </div>
  )
}

// ============================================================
// 子组件：AI 信息卡
// ============================================================

function AiInfoCard({
  name,
  count,
  isLandlord,
  isTurn,
  label,
}: {
  name: string
  count: number
  isLandlord: boolean
  isTurn: boolean
  label: string
}) {
  return (
    <div
      className="rounded-2xl p-3 flex items-center justify-between transition-all"
      style={{
        backgroundColor: isTurn ? "rgba(251,191,36,0.15)" : "#0a3d24",
        border: isTurn ? "2px solid #fbbf24" : "1px solid rgba(255,255,255,0.1)",
      }}
    >
      <div className="flex items-center gap-2">
        {isLandlord ? (
          <Crown className="h-4 w-4" style={{ color: "#fbbf24" }} />
        ) : (
          <Users className="h-4 w-4 text-white/70" />
        )}
        <div>
          <p className="text-sm font-bold text-white">{name}</p>
          <p className="text-[10px] text-white/60">{label}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex gap-0.5">
          {/* 牌背图标 */}
          {Array.from({ length: Math.min(3, count) }).map((_, i) => (
            <div
              key={i}
              className="w-3 h-4 rounded-sm"
              style={{ backgroundColor: "#dc2626", border: "1px solid rgba(255,255,255,0.3)" }}
            />
          ))}
        </div>
        <span className="text-sm font-bold text-white">{count}</span>
      </div>
    </div>
  )
}

// ============================================================
// 子组件：叫地主
// ============================================================

function BiddingArea({
  bottomCards,
  bottomRevealed,
  bidPrompt,
  bidTitle,
  onBid,
  lang,
}: {
  bottomCards: Card[]
  bottomRevealed: boolean
  bidPrompt: string
  bidTitle: string
  onBid: (bid: boolean) => void
  lang: "en" | "ko"
}) {
  return (
    <div className="text-center space-y-4">
      <h3 className="text-sm font-bold text-white/80">{bidTitle}</h3>

      {/* 底牌 */}
      <div className="flex justify-center gap-2">
        {bottomCards.map((card, i) => (
          <div
            key={card.id}
            className="w-12 h-16 rounded-lg flex items-center justify-center"
            style={{
              backgroundColor: bottomRevealed ? "#fff" : "#dc2626",
              border: "2px solid rgba(255,255,255,0.4)",
              color: bottomRevealed ? cardColor(card) : "#fff",
              animation: bottomRevealed ? "flipIn 0.4s ease-out" : undefined,
            }}
          >
            {bottomRevealed ? (
              <div className="text-center">
                <div className="text-xs font-bold leading-none">{rankLabel(card.rank)}</div>
                <div className="text-base leading-none mt-0.5">
                  {card.rank >= 16 ? "🃏" : card.suit}
                </div>
              </div>
            ) : (
              <span className="text-xl">🂠</span>
            )}
          </div>
        ))}
      </div>

      <p className="text-sm text-white/80">{bidPrompt}</p>

      {!bottomRevealed && (
        <div className="flex justify-center gap-3">
          <button
            onClick={() => onBid(true)}
            className="px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90"
            style={{ backgroundColor: "#fbbf24", color: "#1a1a1a" }}
          >
            <Crown className="h-4 w-4 inline mr-1" />
            {lang === "en" ? "Bid (Landlord)" : "부름 (지주)"}
          </button>
          <button
            onClick={() => onBid(false)}
            className="px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90"
            style={{
              backgroundColor: "rgba(255,255,255,0.1)",
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.2)",
            }}
          >
            {lang === "en" ? "Pass" : "패스"}
          </button>
        </div>
      )}
    </div>
  )
}

// ============================================================
// 子组件：出牌区
// ============================================================

function PlayArea({
  lastPlay,
  lastPlayer,
  labels,
  isLeading,
  currentTurn,
  yourTurnLabel,
  aiTurnLabel,
  lang,
}: {
  lastPlay: PlayResult | null
  lastPlayer: Player | null
  labels: [string, string, string]
  isLeading: boolean
  currentTurn: Player
  yourTurnLabel: string
  aiTurnLabel: string
  lang: "en" | "ko"
}) {
  return (
    <div className="w-full text-center space-y-3">
      {/* 回合提示 */}
      <div
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold"
        style={{
          backgroundColor: currentTurn === 0 ? "#fbbf24" : "rgba(255,255,255,0.1)",
          color: currentTurn === 0 ? "#1a1a1a" : "#fff",
        }}
      >
        {currentTurn === 0 ? (
          <>{yourTurnLabel}</>
        ) : (
          <>
            <Loader2 className="h-3 w-3 animate-spin" />
            {aiTurnLabel}
          </>
        )}
      </div>

      {/* 上家出的牌 */}
      {lastPlay && lastPlayer !== null ? (
        <div className="space-y-2">
          <p className="text-xs text-white/60">
            {lang === "en" ? "Last Play by" : "마지막 출판자"}{" "}
            <span className="font-bold text-white">{labels[lastPlayer]}</span>
          </p>
          <div className="flex flex-wrap justify-center gap-1">
            {lastPlay.cards.map(card => (
              <CardView key={card.id} card={card} />
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-white/50">
          {isLeading
            ? (lang === "en" ? "Lead a new round" : "새 라운드 선수")
            : (lang === "en" ? "Waiting..." : "대기 중...")}
        </p>
      )}
    </div>
  )
}

// ============================================================
// 子组件：扑克牌视图
// ============================================================

function CardView({
  card,
  selected = false,
  onClick,
  disabled = false,
}: {
  card: Card
  selected?: boolean
  onClick?: () => void
  disabled?: boolean
}) {
  const color = cardColor(card)
  const label = rankLabel(card.rank)
  const isJoker = card.rank >= 16

  const content = (
    <div className="text-center">
      <div className="text-[10px] font-bold leading-none">{label}</div>
      <div className="text-lg leading-none mt-1">
        {isJoker ? "🃏" : card.suit}
      </div>
      {isJoker && (
        <div className="text-[7px] font-bold mt-0.5">
          {card.rank === 17 ? "BIG" : "SMALL"}
        </div>
      )}
    </div>
  )

  if (onClick) {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        className="w-11 h-15 rounded-lg flex items-center justify-center transition-all disabled:cursor-default"
        style={{
          backgroundColor: "#fff",
          border: selected ? "2px solid #fbbf24" : "1px solid rgba(0,0,0,0.15)",
          color,
          transform: selected ? "translateY(-12px)" : "translateY(0)",
          boxShadow: selected ? "0 4px 8px rgba(0,0,0,0.3)" : "0 1px 2px rgba(0,0,0,0.2)",
          height: "60px",
          width: "44px",
        }}
      >
        {content}
      </button>
    )
  }

  return (
    <div
      className="rounded-lg flex items-center justify-center"
      style={{
        backgroundColor: "#fff",
        border: "1px solid rgba(0,0,0,0.15)",
        color,
        height: "60px",
        width: "44px",
        boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
      }}
    >
      {content}
    </div>
  )
}

// ============================================================
// 子组件：单词题弹窗
// ============================================================

function WordQuizModal({
  question,
  onResult,
  lang,
  titleText,
  promptText,
  correctText,
  wrongText,
  pronounceText,
}: {
  question: WordQuestion | null
  onResult: (correct: boolean) => void
  lang: "en" | "ko"
  titleText: string
  promptText: string
  correctText: string
  wrongText: string
  pronounceText: string
}) {
  const [selected, setSelected] = useState<number | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [isCorrect, setIsCorrect] = useState(false)
  const [speaking, setSpeaking] = useState(false)

  // 题目变化时重置
  useEffect(() => {
    setSelected(null)
    setShowResult(false)
    setIsCorrect(false)
  }, [question])

  const speakWord = useCallback(async () => {
    if (!question) return
    setSpeaking(true)
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: question.word, lang: "en" }),
      })
      if (!res.ok) return
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audio.onended = () => {
        URL.revokeObjectURL(url)
        setSpeaking(false)
      }
      audio.play()
    } catch {
      setSpeaking(false)
    }
  }, [question])

  const handleSelect = useCallback((index: number) => {
    if (showResult || !question) return
    setSelected(index)
    const correct = index === question.answerIndex
    setIsCorrect(correct)
    setShowResult(true)
    // 1.5 秒后回调，让玩家看到对错反馈
    setTimeout(() => onResult(correct), 1500)
  }, [showResult, question, onResult])

  if (!question) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div
        className="w-full max-w-md rounded-3xl p-6 shadow-2xl"
        style={{
          backgroundColor: "var(--card)",
          border: "1px solid var(--border)",
          animation: "quizPopIn 0.25s ease-out",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold" style={{ color: "var(--accent)" }}>
            {titleText}
          </h3>
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: "var(--surface-subtle)",
              color: "var(--text-muted)",
            }}
          >
            {lang === "en" ? "Quiz" : "퀴즈"}
          </span>
        </div>

        {/* Word display */}
        <div className="flex items-center gap-3 mb-5">
          <span className="text-4xl">{question.emoji}</span>
          <div className="flex-1">
            <p className="text-2xl font-bold tracking-wide">{question.word}</p>
            <p className="text-xs text-[var(--text-muted)]">{promptText}</p>
          </div>
          <button
            onClick={speakWord}
            disabled={speaking}
            className="p-2.5 rounded-xl transition-colors hover:bg-[var(--surface-subtle)] disabled:opacity-50"
            style={{ color: "var(--accent)" }}
            title={pronounceText}
          >
            {speaking ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Volume2 className="h-5 w-5" />
            )}
          </button>
        </div>

        {/* Options */}
        <div className="grid grid-cols-1 gap-2.5">
          {question.options.map((option, index) => {
            const isSelected = selected === index
            const isAnswer = index === question.answerIndex

            let bg = "var(--surface-subtle)"
            let border = "1px solid var(--border)"
            let textColor = "var(--text)"

            if (showResult) {
              if (isAnswer) {
                bg = "#dcfce7"
                border = "2px solid #22c55e"
                textColor = "#15803d"
              } else if (isSelected) {
                bg = "#fef2f2"
                border = "2px solid #ef4444"
                textColor = "#dc2626"
              }
            } else if (isSelected) {
              bg = "var(--accent-secondary)"
              border = "2px solid var(--accent)"
              textColor = "var(--accent)"
            }

            return (
              <button
                key={index}
                onClick={() => handleSelect(index)}
                disabled={showResult}
                className="flex items-center justify-between rounded-xl px-4 py-3 text-left font-medium transition-all hover:scale-[1.02] disabled:hover:scale-100"
                style={{ backgroundColor: bg, border, color: textColor }}
              >
                <span>{option}</span>
                {showResult && isAnswer && <Check className="h-4 w-4 flex-shrink-0" />}
                {showResult && isSelected && !isAnswer && <X className="h-4 w-4 flex-shrink-0" />}
              </button>
            )
          })}
        </div>

        {/* Result feedback */}
        {showResult && (
          <div
            className="mt-4 flex items-center gap-2 rounded-xl p-3 text-sm font-medium"
            style={{
              backgroundColor: isCorrect ? "#dcfce7" : "#fef2f2",
              color: isCorrect ? "#15803d" : "#dc2626",
            }}
          >
            {isCorrect ? (
              <Check className="h-4 w-4 flex-shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
            )}
            {isCorrect ? correctText : wrongText}
            {!isCorrect && (
              <span className="text-xs ml-1 opacity-80">
                {question.word} = {question.meaning}
              </span>
            )}
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes quizPopIn {
          from { opacity: 0; transform: scale(0.9) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  )
}

// ============================================================
// 子组件：游戏结算面板
// ============================================================

function GameResultPanel({
  humanWon,
  stats,
  accuracy,
  lang,
  onRestart,
  onHome,
}: {
  humanWon: boolean
  stats: { correctAnswers: number; wrongAnswers: number; wordsLearned: string[] }
  accuracy: number
  lang: "en" | "ko"
  onRestart: () => void
  onHome: () => void
}) {
  const t = lang === "en" ? {
    won: "You Won!",
    lost: "You Lost",
    wordsLearned: "Words Learned",
    accuracy: "Accuracy",
    questions: "Questions Answered",
    playAgain: "Play Again",
    home: "Lobby",
  } : {
    won: "승리!",
    lost: "패배",
    wordsLearned: "배운 단어",
    accuracy: "정확도",
    questions: "푼 문제",
    playAgain: "다시 하기",
    home: "로비",
  }

  const title = humanWon ? t.won : t.lost
  const titleColor = humanWon ? "#22c55e" : "#ef4444"
  const icon = humanWon ? "🏆" : "🤖"

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        className="w-full max-w-md rounded-3xl p-6 shadow-2xl"
        style={{
          backgroundColor: "var(--card)",
          border: "1px solid var(--border)",
          animation: "resultPopIn 0.3s ease-out",
        }}
      >
        <div className="text-center mb-5">
          <div className="text-5xl mb-2">{icon}</div>
          <h2 className="text-2xl font-black" style={{ color: titleColor }}>
            {title}
          </h2>
        </div>

        {/* 词汇学习统计 */}
        <div
          className="rounded-2xl p-4 mb-4"
          style={{ backgroundColor: "var(--accent-secondary)" }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="h-4 w-4" style={{ color: "var(--accent)" }} />
            <h3 className="text-sm font-bold" style={{ color: "var(--accent)" }}>
              {t.wordsLearned}: {stats.wordsLearned.length}
            </h3>
          </div>

          {stats.wordsLearned.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {stats.wordsLearned.slice(-12).map((word, i) => (
                <span
                  key={`${word}-${i}`}
                  className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium"
                  style={{
                    backgroundColor: "var(--card)",
                    color: "var(--accent)",
                    border: "1px solid var(--accent-border)",
                  }}
                >
                  {word}
                </span>
              ))}
              {stats.wordsLearned.length > 12 && (
                <span className="text-xs text-[var(--text-muted)] self-center">
                  +{stats.wordsLearned.length - 12}
                </span>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className="text-center rounded-lg p-2" style={{ backgroundColor: "var(--card)" }}>
              <p className="text-lg font-black" style={{ color: "var(--accent)" }}>
                {stats.correctAnswers + stats.wrongAnswers}
              </p>
              <p className="text-[10px] text-[var(--text-muted)]">{t.questions}</p>
            </div>
            <div className="text-center rounded-lg p-2" style={{ backgroundColor: "var(--card)" }}>
              <p className="text-lg font-black" style={{ color: "var(--accent)" }}>{accuracy}%</p>
              <p className="text-[10px] text-[var(--text-muted)]">{t.accuracy}</p>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onRestart}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90"
            style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}
          >
            <RotateCcw className="h-4 w-4" />
            {t.playAgain}
          </button>
          <button
            onClick={onHome}
            className="px-4 py-2.5 rounded-xl text-sm font-medium border transition-all hover:bg-[var(--surface-subtle)]"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
          >
            {t.home}
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes resultPopIn {
          from { opacity: 0; transform: scale(0.85) translateY(20px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  )
}
