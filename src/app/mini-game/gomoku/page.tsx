"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { useLanguage } from "@/lib/language-context"
import { ChevronLeft, RotateCcw, Trophy, Loader2, Zap, Target, BookOpen, Volume2, Brain, Swords } from "lucide-react"
import {
  createBoard, checkWinner, isBoardFull, smartAiMove,
  BOARD_SIZE, type Board, type Move, type GameStats,
} from "../gomoku-engine"
import { generateMixedQuestions, type WordQuestion } from "../word-quiz"
import { WordQuizModal } from "../word-quiz-modal"

type GameState = "playing" | "won" | "lost" | "draw"
type Turn = "player" | "ai"

interface VocabWord {
  word: string
  meaning: string
  language: string
}

export default function GomokuPage() {
  const router = useRouter()
  const { language } = useLanguage()
  const lang = language as "en" | "ko"

  // 游戏状态
  const [board, setBoard] = useState<Board>(() => createBoard())
  const [turn, setTurn] = useState<Turn>("player")
  const [gameState, setGameState] = useState<GameState>("playing")
  const [lastMove, setLastMove] = useState<Move | null>(null)

  // 单词题库
  const [currentQuestion, setCurrentQuestion] = useState<WordQuestion | null>(null)
  const [pendingMove, setPendingMove] = useState<Move | null>(null)
  const [vocabWords, setVocabWords] = useState<VocabWord[]>([])
  const [loading, setLoading] = useState(true)

  // 词汇统计
  const statsRef = useRef<GameStats>({
    correctAnswers: 0,
    wrongAnswers: 0,
    totalQuestions: 0,
    maxCombo: 0,
    wordsLearned: [],
  })
  const [currentCombo, setCurrentCombo] = useState(0)
  const [usedWords, setUsedWords] = useState<Set<string>>(new Set())

  // 加载用户词汇
  useEffect(() => {
    fetchVocab()
  }, [])

  const fetchVocab = async () => {
    try {
      const res = await fetch("/api/vocabulary/list?lang=en")
      if (res.ok) {
        const data = await res.json()
        setVocabWords(data.words || [])
      }
    } catch {
      // 忽略错误，用主题词库
    } finally {
      setLoading(false)
    }
  }

  // AI 回合
  useEffect(() => {
    if (turn !== "ai" || gameState !== "playing") return

    // 延迟 500ms 让玩家看到 AI 在"思考"
    const timer = setTimeout(() => {
      const aiMv = smartAiMove(board)
      const newBoard = board.map(row => [...row])
      newBoard[aiMv.row][aiMv.col] = 2
      setBoard(newBoard)
      setLastMove(aiMv)

      const winner = checkWinner(newBoard)
      if (winner === 2) {
        setGameState("lost")
      } else if (isBoardFull(newBoard)) {
        setGameState("draw")
      } else {
        setTurn("player")
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [turn, board, gameState])

  // 玩家点击棋盘格子
  const handleCellClick = useCallback((row: number, col: number) => {
    if (turn !== "player" || gameState !== "playing") return
    if (board[row][col] !== 0) return
    if (currentQuestion) return // 正在答题，不能点

    // 劫持落子：生成题目
    const question = generateMixedQuestions(vocabWords, 1, usedWords)[0]
    if (!question) return

    setPendingMove({ row, col })
    setCurrentQuestion(question)
  }, [turn, gameState, board, currentQuestion, vocabWords, usedWords])

  // 答题结果回调
  const handleQuizResult = useCallback((correct: boolean) => {
    const move = pendingMove
    if (!move) return

    // 更新统计
    statsRef.current.totalQuestions++
    if (correct) {
      statsRef.current.correctAnswers++
      setCurrentCombo(prev => {
        const newCombo = prev + 1
        if (newCombo > statsRef.current.maxCombo) {
          statsRef.current.maxCombo = newCombo
        }
        return newCombo
      })
      if (currentQuestion) {
        statsRef.current.wordsLearned.push(currentQuestion.word)
        setUsedWords(prev => new Set([...prev, currentQuestion.word]))
      }

      // 答对 → 允许落子
      const newBoard = board.map(row => [...row])
      newBoard[move.row][move.col] = 1
      setBoard(newBoard)
      setLastMove(move)

      const winner = checkWinner(newBoard)
      if (winner === 1) {
        setGameState("won")
      } else if (isBoardFull(newBoard)) {
        setGameState("draw")
      } else {
        setTurn("ai")
      }
    } else {
      // 答错 → 跳过回合
      statsRef.current.wrongAnswers++
      setCurrentCombo(0)
      setTurn("ai")
    }

    setCurrentQuestion(null)
    setPendingMove(null)
  }, [pendingMove, board, currentQuestion])

  // 重新开始
  const handleRestart = useCallback(() => {
    setBoard(createBoard())
    setTurn("player")
    setGameState("playing")
    setLastMove(null)
    setCurrentQuestion(null)
    setPendingMove(null)
    setCurrentCombo(0)
    setUsedWords(new Set())
    statsRef.current = {
      correctAnswers: 0,
      wrongAnswers: 0,
      totalQuestions: 0,
      maxCombo: 0,
      wordsLearned: [],
    }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--accent)" }} />
      </div>
    )
  }

  const t = lang === "en" ? {
    title: "Word Gomoku",
    subtitle: "Answer correctly to place your stone!",
    yourTurn: "Your Turn (Black)",
    aiTurn: "AI Thinking...",
    combo: "Combo",
    won: "You Won!",
    lost: "AI Won",
    draw: "Draw",
    restart: "New Game",
    wordsLearned: "Words Learned",
    accuracy: "Accuracy",
    questions: "Questions",
    bestCombo: "Best Combo",
  } : {
    title: "단어 오목",
    subtitle: "맞춰야 돌을 놓을 수 있어요!",
    yourTurn: "내 차례 (흑)",
    aiTurn: "AI 생각 중...",
    combo: "연속",
    won: "승리!",
    lost: "AI 승리",
    draw: "무승부",
    restart: "새 게임",
    wordsLearned: "배운 단어",
    accuracy: "정확도",
    questions: "문제 수",
    bestCombo: "최고 연속",
  }

  return (
    <div className="space-y-5 pb-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/mini-game")}
            className="p-1.5 rounded-lg hover:bg-neutral-100 transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Brain className="h-6 w-6" style={{ color: "var(--accent)" }} />
              {t.title}
            </h1>
            <p className="text-xs text-[var(--text-muted)]">{t.subtitle}</p>
          </div>
        </div>
        <button
          onClick={handleRestart}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all hover:opacity-90"
          style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}
        >
          <RotateCcw className="h-4 w-4" />
          {t.restart}
        </button>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-center gap-4 flex-wrap">
        <div
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium"
          style={{
            backgroundColor: turn === "player" ? "var(--accent)" : "var(--surface-subtle)",
            color: turn === "player" ? "var(--accent-foreground)" : "var(--text-muted)",
          }}
        >
          {turn === "player" ? (
            <>
              <span className="w-3 h-3 rounded-full bg-black" />
              {t.yourTurn}
            </>
          ) : (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {t.aiTurn}
            </>
          )}
        </div>

        {currentCombo >= 2 && (
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
            style={{
              backgroundColor: "#fef3c7",
              color: "#b45309",
              animation: "comboPulse 0.4s ease-out",
            }}
          >
            <Zap className="h-3.5 w-3.5" />
            {t.combo} {currentCombo}x
          </div>
        )}
      </div>

      {/* Board */}
      <div className="flex justify-center">
        <div
          className="inline-block rounded-2xl p-3 shadow-lg"
          style={{
            backgroundColor: "#dc9b3c",
            backgroundImage: "linear-gradient(135deg, #e8b755 0%, #d4a035 100%)",
          }}
        >
          <div
            className="grid gap-0"
            style={{
              gridTemplateColumns: `repeat(${BOARD_SIZE}, minmax(0, 1fr))`,
              width: "min(90vw, 540px)",
              aspectRatio: "1",
            }}
          >
            {board.map((rowArr, r) =>
              rowArr.map((cell, c) => {
                const isLast = lastMove?.row === r && lastMove?.col === c
                const isEmpty = cell === 0

                return (
                  <button
                    key={`${r}-${c}`}
                    onClick={() => handleCellClick(r, c)}
                    disabled={turn !== "player" || gameState !== "playing" || !isEmpty || !!currentQuestion}
                    className="flex items-center justify-center transition-all hover:z-10 disabled:cursor-default"
                    style={{
                      position: "relative",
                      border: "1px solid rgba(0,0,0,0.1)",
                    }}
                  >
                    {/* 棋子 */}
                    {cell !== 0 && (
                      <div
                        className="rounded-full transition-all"
                        style={{
                          width: "80%",
                          height: "80%",
                          backgroundColor: cell === 1 ? "#1a1a1a" : "#f5f5f5",
                          border: cell === 1 ? "1px solid #333" : "1px solid #ccc",
                          boxShadow: isLast
                            ? "0 0 0 2px #ef4444, 0 2px 4px rgba(0,0,0,0.3)"
                            : "0 2px 4px rgba(0,0,0,0.3)",
                        }}
                      />
                    )}
                    {/* 空位 hover 指示 */}
                    {isEmpty && turn === "player" && gameState === "playing" && !currentQuestion && (
                      <div
                        className="rounded-full opacity-0 hover:opacity-30 transition-opacity"
                        style={{
                          width: "60%",
                          height: "60%",
                          backgroundColor: "#1a1a1a",
                        }}
                      />
                    )}
                  </button>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Game result overlay */}
      {gameState !== "playing" && (
        <GameResultPanel
          gameState={gameState}
          stats={statsRef.current}
          lang={lang}
          onRestart={handleRestart}
          onHome={() => router.push("/mini-game")}
        />
      )}

      {/* Word quiz modal */}
      <WordQuizModal
        question={currentQuestion}
        onResult={handleQuizResult}
        lang={lang}
      />

      <style jsx>{`
        @keyframes comboPulse {
          0% { transform: scale(0.8); }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  )
}

// ========================================
// 游戏结算面板
// ========================================
function GameResultPanel({
  gameState,
  stats,
  lang,
  onRestart,
  onHome,
}: {
  gameState: GameState
  stats: GameStats
  lang: "en" | "ko"
  onRestart: () => void
  onHome: () => void
}) {
  const t = lang === "en" ? {
    won: "You Won!",
    lost: "AI Won",
    draw: "Draw",
    wordsLearned: "Words Learned",
    accuracy: "Accuracy",
    questions: "Questions Answered",
    bestCombo: "Best Combo",
    playAgain: "Play Again",
    home: "Home",
    you: "You",
    ai: "AI",
  } : {
    won: "승리!",
    lost: "AI 승리",
    draw: "무승부",
    wordsLearned: "배운 단어",
    accuracy: "정확도",
    questions: "푼 문제",
    bestCombo: "최고 연속",
    playAgain: "다시 하기",
    home: "홈",
    you: "나",
    ai: "AI",
  }

  const accuracy = stats.totalQuestions > 0
    ? Math.round((stats.correctAnswers / stats.totalQuestions) * 100)
    : 0

  const title = gameState === "won" ? t.won : gameState === "lost" ? t.lost : t.draw
  const titleColor = gameState === "won" ? "#22c55e" : gameState === "lost" ? "#ef4444" : "#f59e0b"
  const icon = gameState === "won" ? "🏆" : gameState === "lost" ? "🤖" : "🤝"

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div
        className="w-full max-w-md rounded-3xl p-6 shadow-2xl"
        style={{
          backgroundColor: "var(--card)",
          border: "1px solid var(--border)",
          animation: "resultPopIn 0.3s ease-out",
        }}
      >
        {/* 标题 */}
        <div className="text-center mb-5">
          <div className="text-5xl mb-2">{icon}</div>
          <h2 className="text-2xl font-black" style={{ color: titleColor }}>
            {title}
          </h2>
        </div>

        {/* 词汇学习统计 — 核心亮点 */}
        <div
          className="rounded-2xl p-4 mb-4"
          style={{ backgroundColor: "var(--accent-secondary)" }}
        >
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="h-4 w-4" style={{ color: "var(--accent)" }} />
            <h3 className="text-sm font-bold" style={{ color: "var(--accent)" }}>
              {t.wordsLearned}: {stats.wordsLearned.length}
            </h3>
          </div>

          {/* 单词标签 */}
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

          {/* 3 格统计 */}
          <div className="grid grid-cols-3 gap-2">
            <StatBox label={t.questions} value={`${stats.totalQuestions}`} icon={<Target className="h-3 w-3" />} />
            <StatBox label={t.accuracy} value={`${accuracy}%`} icon={<Zap className="h-3 w-3" />} />
            <StatBox label={t.bestCombo} value={`${stats.maxCombo}x`} icon={<Swords className="h-3 w-3" />} />
          </div>
        </div>

        {/* 按钮 */}
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

function StatBox({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="text-center rounded-lg p-2" style={{ backgroundColor: "var(--card)" }}>
      <div className="flex items-center justify-center gap-1 mb-0.5" style={{ color: "var(--accent)" }}>
        {icon}
      </div>
      <p className="text-lg font-black" style={{ color: "var(--accent)" }}>{value}</p>
      <p className="text-[10px] text-[var(--text-muted)]">{label}</p>
    </div>
  )
}
