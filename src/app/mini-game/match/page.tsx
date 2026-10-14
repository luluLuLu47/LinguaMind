"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { useLanguage } from "@/lib/language-context"
import { ChevronLeft, RotateCcw, Check, Trophy, HelpCircle, X, Loader2, BookOpen, Shuffle, Volume2, RefreshCw } from "lucide-react"
import { createCards, shuffleCards, checkMatch, pickRandomPairs, type GameCard, type WordPair } from "../game-logic"
import { getRandomTheme, type WordTheme } from "../word-banks"

const PAIRS_PER_GAME = 8

// Fallback pairs 使用 CET-4 核心词汇，不再使用小学级词汇
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

interface VocabWord {
  word: string
  meaning: string
  language: string
}

export default function MatchPage() {
  const router = useRouter()
  const { language } = useLanguage()
  const lang = language as "en" | "ko"

  const [cards, setCards] = useState<GameCard[]>([])
  const [flippedIndex, setFlippedIndex] = useState<number | null>(null)
  const [matchedCount, setMatchedCount] = useState(0)
  const [attempts, setAttempts] = useState(0)
  const [gameComplete, setGameComplete] = useState(false)
  const [wrongPair, setWrongPair] = useState<[number, number] | null>(null)
  const [showHelp, setShowHelp] = useState(false)
  const [loading, setLoading] = useState(true)
  const [currentTheme, setCurrentTheme] = useState<WordTheme | null>(null)
  const [vocabSource, setVocabSource] = useState<"db" | "theme" | "fallback">("fallback")
  const [showReview, setShowReview] = useState(false)
  const [failedPairs, setFailedPairs] = useState<WordPair[]>([])

  // Track matched/failed words for review logic
  const matchedWordsRef = useRef<Set<string>>(new Set())
  const failedWordsRef = useRef<Set<string>>(new Set())
  const pairWordMap = useRef<Map<number, string>>(new Map())
  const pairsRef = useRef<WordPair[]>([])

  // Fetch vocabulary words from API
  const fetchVocabulary = useCallback(async () => {
    try {
      const res = await fetch(`/api/vocabulary/list?lang=en`)
      if (!res.ok) return []
      const data = await res.json()
      return (data.words || []) as VocabWord[]
    } catch {
      return []
    }
  }, [])

  // Build WordPair[] for game
  const buildPairs = useCallback((vocab: VocabWord[]): { pairs: WordPair[]; source: "db" | "theme" | "fallback"; theme: WordTheme | null } => {
    // If user has ≥4 vocab words, use them (mixed with a random theme for variety)
    if (vocab.length >= 4) {
      const theme = getRandomTheme()
      const shuffled = [...vocab].sort(() => Math.random() - 0.5)
      const selected = shuffled.slice(0, Math.min(PAIRS_PER_GAME, shuffled.length))
      const pairs: WordPair[] = selected.map((v) => ({
        en: v.word,
        zh: v.meaning,
        emoji: getEmojiForWord(v.word),
      }))
      // Fill remaining slots with theme words if vocab had fewer than 8
      if (pairs.length < PAIRS_PER_GAME) {
        const themeFill = pickRandomPairs(theme.words, PAIRS_PER_GAME - pairs.length)
          .filter(tw => !pairs.some(p => p.en === tw.en))
        pairs.push(...themeFill)
      }
      return { pairs, source: "db", theme }
    }

    // Otherwise pick a random theme
    const theme = getRandomTheme(currentTheme?.id)
    const pairs = pickRandomPairs(theme.words, PAIRS_PER_GAME)
    return { pairs, source: "theme", theme }
  }, [currentTheme?.id])

  const startNewGame = useCallback(async () => {
    setLoading(true)
    setGameComplete(false)
    setMatchedCount(0)
    setAttempts(0)
    setFlippedIndex(null)
    setWrongPair(null)
    matchedWordsRef.current = new Set()
    failedWordsRef.current = new Set()
    pairWordMap.current = new Map()

    const vocab = await fetchVocabulary()
    const { pairs, source, theme } = buildPairs(vocab)

    setVocabSource(source)
    setCurrentTheme(theme)
    pairsRef.current = pairs

    // Build pairId → word map for review tracking
    pairs.forEach((p, idx) => {
      pairWordMap.current.set(idx, p.en)
    })

    const base = createCards(pairs)
    setCards(shuffleCards(base))
    setLoading(false)
  }, [fetchVocabulary, buildPairs])

  useEffect(() => {
    startNewGame()
  }, [startNewGame])

  const handleCardClick = (index: number) => {
    if (wrongPair || loading) return

    if (flippedIndex === null) {
      setFlippedIndex(index)
      return
    }

    if (flippedIndex === index) {
      setFlippedIndex(null)
      return
    }

    const isMatch = checkMatch(cards, flippedIndex, index)
    const pairId = cards[flippedIndex].pairId
    const word = pairWordMap.current.get(pairId) || ""

    if (isMatch) {
      const newCards = [...cards]
      newCards[flippedIndex] = { ...newCards[flippedIndex], matched: true }
      newCards[index] = { ...newCards[index], matched: true }
      setCards(newCards)
      setMatchedCount(prev => prev + 1)
      setFlippedIndex(null)
      setAttempts(prev => prev + 1)
      matchedWordsRef.current.add(word)
      failedWordsRef.current.delete(word)

      if (matchedCount + 1 === pairsCount()) {
        setGameComplete(true)
        saveGameResult(matchedWordsRef.current, failedWordsRef.current)
        const failedWords = Array.from(failedWordsRef.current).filter(w => !matchedWordsRef.current.has(w))
        const failed = pairsRef.current.filter(p => failedWords.includes(p.en))
        setFailedPairs(failed)
      }
    } else {
      const firstPairId = cards[flippedIndex].pairId
      const secondPairId = cards[index].pairId
      const firstWord = pairWordMap.current.get(firstPairId) || ""
      const secondWord = pairWordMap.current.get(secondPairId) || ""
      if (!matchedWordsRef.current.has(firstWord)) failedWordsRef.current.add(firstWord)
      if (!matchedWordsRef.current.has(secondWord)) failedWordsRef.current.add(secondWord)

      setWrongPair([flippedIndex, index])
      setAttempts(prev => prev + 1)
      setTimeout(() => {
        setFlippedIndex(null)
        setWrongPair(null)
      }, 700)
    }
  }

  const pairsCount = () => cards.length / 2

  const saveGameResult = (matched: Set<string>, failed: Set<string>) => {
    const matchedArr = Array.from(matched)
    const failedArr = Array.from(failed).filter(w => !matched.has(w))
    const acc = attempts > 0 ? Math.round((matched.size / attempts) * 100) : 0

    fetch("/api/game/result", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language: lang,
        pairs: matchedArr.length,
        attempts,
        accuracy: acc,
        wordsMatched: matchedArr,
        wordsFailed: failedArr,
      }),
    }).catch(() => {})
  }

  const accuracy = attempts > 0 ? Math.round((matchedCount / attempts) * 100) : 0

  // 调 TTS API 播放单词发音
  const speakWord = useCallback(async (text: string) => {
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, lang: "en" }),
      })
      if (!res.ok) return
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audio.onended = () => URL.revokeObjectURL(url)
      audio.play()
    } catch (err) {
      console.error("[TTS] play error:", err)
    }
  }, [])

  return (
    <div className="space-y-5 pb-8 relative">
      {/* Header with Help button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/mini-game")}
            className="p-1.5 rounded-lg hover:bg-neutral-100 transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="text-2xl font-bold">
            {lang === "en" ? "Word Match" : "단어 짝맞추기"}
          </h1>
        </div>
        <button
          onClick={() => setShowHelp(!showHelp)}
          className="p-2 rounded-full transition-colors hover:bg-[var(--surface-subtle)]"
          style={{ color: "var(--accent)" }}
          aria-label="Game instructions"
        >
          <HelpCircle className="h-5 w-5" />
        </button>
      </div>

      {/* Help panel */}
      {showHelp && (
        <div
          className="absolute right-0 top-14 z-20 w-72 rounded-2xl p-4 shadow-lg"
          style={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-md)",
            animation: "fadeInSlide 0.2s ease-out",
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold" style={{ color: "var(--accent)" }}>
              {lang === "en" ? "How to Play" : "게임 방법"}
            </span>
            <button
              onClick={() => setShowHelp(false)}
              className="p-0.5 rounded hover:bg-[var(--surface-subtle)] transition-colors"
            >
              <X className="h-4 w-4 text-[var(--text-muted)]" />
            </button>
          </div>
          <ul className="space-y-2 text-xs text-[var(--text-secondary)]">
            <li className="flex gap-2">
              <span className="font-bold" style={{ color: "var(--accent)" }}>1.</span>
              <span>{lang === "en" ? "Click two cards to flip them." : "카드 두 장을 클릭하여 뒤집으세요."}</span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold" style={{ color: "var(--accent)" }}>2.</span>
              <span>{lang === "en" ? "Match each English word with its translation." : "영어 단어와 번역을 짝지으세요."}</span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold" style={{ color: "var(--accent)" }}>3.</span>
              <span>{lang === "en" ? "Wrong pairs flip back after 0.7s." : "틀린 짝은 0.7초 후 뒤집힙니다."}</span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold" style={{ color: "var(--accent)" }}>4.</span>
              <span>{lang === "en" ? "Themes: CET-4, CET-6, Postgraduate." : "주제: CET-4, CET-6, 대학원."}</span>
            </li>
          </ul>
        </div>
      )}

      {/* Theme badge */}
      {currentTheme && !loading && (
        <div className="flex items-center gap-2 flex-wrap">
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
            style={{
              backgroundColor: "var(--accent-secondary)",
              color: "var(--accent)",
            }}
          >
            <span className="text-sm">{currentTheme.emoji}</span>
            {lang === "en" ? currentTheme.nameEn : currentTheme.nameZh}
          </div>
          {vocabSource === "db" && (
            <div
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
              style={{ backgroundColor: "var(--accent-secondary)", color: "var(--accent)" }}
            >
              <BookOpen className="h-3 w-3" />
              {lang === "en" ? "Your words" : "내 단어"}
            </div>
          )}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-4 animate-spin" style={{ color: "var(--accent)" }} />
          <span className="ml-2 text-sm text-[var(--text-muted)]">
            {lang === "en" ? "Loading words..." : "단어 로딩 중..."}
          </span>
        </div>
      )}

      {/* Stats bar */}
      {!loading && (
        <div className="flex items-center justify-center gap-6">
          <div className="flex items-center gap-1.5">
            <Check className="h-4 w-4" style={{ color: "var(--accent)" }} />
            <span className="text-sm font-medium">{matchedCount}/{pairsCount()}</span>
            <span className="text-xs text-[var(--text-muted)]">
              {lang === "en" ? "matched" : "맞춤"}
            </span>
          </div>
          <div className="w-px h-4 bg-[var(--border)]" />
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium">{attempts}</span>
            <span className="text-xs text-[var(--text-muted)]">
              {lang === "en" ? "tries" : "시도"}
            </span>
          </div>
          <div className="w-px h-4 bg-[var(--border)]" />
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium">{accuracy}%</span>
            <span className="text-xs text-[var(--text-muted)]">
              {lang === "en" ? "accuracy" : "정확도"}
            </span>
          </div>
        </div>
      )}

      {/* Progress bar */}
      {!loading && (
        <div className="h-2 rounded-full bg-[var(--surface-subtle)] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${pairsCount() > 0 ? (matchedCount / pairsCount()) * 100 : 0}%`,
              backgroundColor: "var(--accent)",
            }}
          />
        </div>
      )}

      {/* Game complete banner */}
      {!loading && gameComplete && (
        <>
          <div
            className="rounded-2xl p-5 flex items-center gap-4"
            style={{
              backgroundColor: "var(--accent-secondary)",
              border: "1px solid var(--accent-border)",
              animation: "matchPulse 0.6s ease-out",
            }}
          >
            <Trophy className="h-8 w-8 flex-shrink-0" style={{ color: "var(--accent)" }} />
            <div className="flex-1">
              <p className="text-lg font-bold" style={{ color: "var(--accent)" }}>
                {lang === "en" ? "Complete!" : "완료!"}
              </p>
              <p className="text-sm text-[var(--text-secondary)]">
                {lang === "en" ? `${attempts} tries, ${accuracy}% accuracy` : `${attempts}회 시도, 정확도 ${accuracy}%`}
              </p>
              {failedPairs.length > 0 && (
                <button
                  onClick={() => setShowReview(!showReview)}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-90"
                  style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  {lang === "en"
                    ? `Review ${failedPairs.length} failed word(s)`
                    : `틀린 단어 ${failedPairs.length}개 복습`}
                </button>
              )}
            </div>
          </div>

          {!loading && gameComplete && showReview && failedPairs.length > 0 && (
            <div
              className="rounded-2xl p-5 space-y-3"
              style={{
                backgroundColor: "var(--card)",
                border: "1px solid var(--border)",
              }}
            >
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4" style={{ color: "var(--accent)" }} />
                <h3 className="text-sm font-semibold">
                  {lang === "en" ? "Words to Review" : "복습할 단어"}
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {failedPairs.map((pair) => (
                  <div
                    key={pair.en}
                    className="flex items-center gap-3 rounded-xl p-3"
                    style={{ backgroundColor: "var(--surface-subtle)" }}
                  >
                    <span className="text-2xl flex-shrink-0">{pair.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{pair.en}</p>
                      <p className="text-xs text-[var(--text-muted)] truncate">{pair.zh}</p>
                    </div>
                    <button
                      onClick={() => speakWord(pair.en)}
                      className="flex-shrink-0 p-2 rounded-lg transition-colors hover:bg-[var(--accent-secondary)]"
                      style={{ color: "var(--accent)" }}
                    >
                      <Volume2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Card grid */}
      {!loading && (
        <div className="grid grid-cols-4 gap-3 max-w-sm mx-auto">
          {cards.map((card, index) => {
            const isFlipped = flippedIndex === index || card.matched
            const isWrong = wrongPair?.includes(index)

            return (
              <button
                key={card.id}
                onClick={() => handleCardClick(index)}
                disabled={card.matched || isWrong}
                className="aspect-square rounded-2xl text-sm font-medium flex flex-col items-center justify-center gap-1 transition-all duration-200"
                style={
                  card.matched
                    ? {
                        backgroundColor: "var(--accent-secondary)",
                        color: "var(--accent)",
                        opacity: 0.7,
                      }
                    : isFlipped
                      ? isWrong
                        ? {
                            backgroundColor: "#fef2f2",
                            color: "#ef4444",
                            borderColor: "#fca5a5",
                            transform: "scale(1.05)",
                          }
                        : {
                            backgroundColor: "var(--accent)",
                            color: "var(--accent-foreground)",
                            transform: "scale(1.05)",
                            boxShadow: "var(--shadow-md)",
                          }
                      : {
                          backgroundColor: "var(--card)",
                          border: "1px solid var(--border)",
                          color: "var(--text-secondary)",
                        }
                }
              >
                {isFlipped ? (
                  <span className="text-2xl">{card.emoji}</span>
                ) : (
                  <span className="text-2xl opacity-30">?</span>
                )}
                {isFlipped && <span className="text-xs">{card.word}</span>}
              </button>
            )
          })}
        </div>
      )}

      {/* Restart button */}
      {!loading && (
        <div className="text-center">
          <button
            onClick={startNewGame}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ backgroundColor: "var(--accent)" }}
          >
            <Shuffle className="h-4 w-4" />
            {lang === "en" ? "New Game (New Theme)" : "새 게임 (새 주제)"}
          </button>
        </div>
      )}

      <style jsx>{`
        @keyframes fadeInSlide {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes matchPulse {
          0% { transform: scale(0.95); opacity: 0; }
          50% { transform: scale(1.02); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  )
}

function getEmojiForWord(word: string): string {
  const genericEmojis = ["📝", "💎", "🔷", "🔶", "🔺", "🔻", "♦️", "♠️", "🎯", "🏆", "⭐", "🌟"]
  let hash = 0
  for (let i = 0; i < word.length; i++) {
    hash = ((hash << 5) - hash + word.charCodeAt(i)) | 0
  }
  return genericEmojis[Math.abs(hash) % genericEmojis.length]
}
